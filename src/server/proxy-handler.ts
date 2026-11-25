import type { ServerProxyOptions } from '../types.js';
import { DEFAULT_TARGET_DOMAINS, DEFAULT_HEADER_NAME, DEFAULT_PROXY_ENDPOINT } from '../defaults.js';
import { isServerBot } from '../bot-detector.js';
import { PiiRedactor } from '../pii-redactor.js';
import { unaliasParamsFromAdBlockers } from './unaliaser.js';
import { matchesAllowlist } from './ssrf-guard.js';
import { handleMorphedGtmRequest } from './morphed-gtm-handler.js';
import { forwardUpstreamRequest } from './proxy-forwarder.js';
import { extractTargetUrl, decodeTargetUrl } from './target-extractor.js';

export function createProxyHandler(options: ServerProxyOptions = {}) {
  const headerName = (options.targetHeaderName ?? DEFAULT_HEADER_NAME).toLowerCase();
  const allowedDomains = options.allowedDomains ?? DEFAULT_TARGET_DOMAINS;
  const timeoutMs = options.timeoutMs ?? 10000;
  const relayEndpoint = DEFAULT_PROXY_ENDPOINT;
  const piiRedactor = new PiiRedactor(options.piiRedaction);
  const stripHeaders = new Set(
    (options.stripHeaders ?? ['host', 'authorization', 'connection']).map((h) => h.toLowerCase())
  );

  return async function handleProxyRequest(request: Request): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const reqUrl = new URL(request.url);

      if (reqUrl.searchParams.has('_telemetry') || reqUrl.pathname.includes('/a?') || reqUrl.pathname.endsWith('/a')) {
        return new Response(null, {
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        });
      }

      const isPreviewMode =
        request.headers.has('x-gtm-server-preview') ||
        reqUrl.searchParams.has('gtm_debug') ||
        reqUrl.searchParams.has('_gtm_server_preview');

      const botCheck = !isPreviewMode ? isServerBot(request, options.botDetection) : { isBot: false };
      if (botCheck.isBot && botCheck.utm && typeof console !== 'undefined' && console.info) {
        console.info(
          `[Tatvic Proxy] 🤖 Bot/LLM Agent detected: ${botCheck.reason}. Attributing with utm_source=${botCheck.utm.utm_source}, utm_medium=${botCheck.utm.utm_medium}.`
        );
      }

      const pathname = reqUrl.pathname;
      if (
        pathname.endsWith('/gtm.js') || pathname.endsWith('/loader.js') || pathname.endsWith('/core.js') || pathname.endsWith('/loader') ||
        pathname.includes('/_tatvic/loader.js') || pathname.includes('/_tatvic/gtm.js') || pathname.includes('/_tatvic/core.js') ||
        ((pathname.includes('/relay') || pathname.includes('/_tatvic/relay')) &&
          (reqUrl.searchParams.has('cid') || reqUrl.searchParams.has('_id') || (reqUrl.searchParams.has('id') && /^(GTM|G)-/i.test(reqUrl.searchParams.get('id')!))) &&
          !reqUrl.searchParams.has('tid') && !reqUrl.searchParams.has('en'))
      ) {
        return handleMorphedGtmRequest(request, reqUrl, relayEndpoint, botCheck);
      }

      let targetUrlStr = extractTargetUrl(request, reqUrl, headerName, options.serverContainerUrl);
      if (!targetUrlStr) {
        return new Response(JSON.stringify({ error: 'Missing target destination' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        });
      }

      if (options.obfuscateTarget || (targetUrlStr && !targetUrlStr.startsWith('http://') && !targetUrlStr.startsWith('https://'))) {
        const decoded = decodeTargetUrl(targetUrlStr);
        if (decoded) {
          targetUrlStr = decoded;
        } else if (options.obfuscateTarget) {
          return new Response(JSON.stringify({ error: 'Invalid obfuscated target' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
          });
        }
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(targetUrlStr);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed target URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        });
      }

      if (reqUrl.search) {
        reqUrl.searchParams.forEach((val, key) => {
          if (key !== '_tgt' && !targetUrl.searchParams.has(key)) {
            targetUrl.searchParams.set(key, val);
          }
        });
      }

      unaliasParamsFromAdBlockers(targetUrl.searchParams);

      const botUtmSource = botCheck.utm?.utm_source || request.headers.get('x-tatvic-bot-source') || reqUrl.searchParams.get('utm_source');
      const botUtmMedium = botCheck.utm?.utm_medium || request.headers.get('x-tatvic-bot-medium') || reqUrl.searchParams.get('utm_medium');
      if (botCheck.isBot || botUtmSource || botUtmMedium) {
        const source = botUtmSource || 'bot';
        const medium = botUtmMedium || 'agent';
        if (!targetUrl.searchParams.has('cs')) targetUrl.searchParams.set('cs', source);
        if (!targetUrl.searchParams.has('cm')) targetUrl.searchParams.set('cm', medium);
        if (!targetUrl.searchParams.has('ep.utm_source')) targetUrl.searchParams.set('ep.utm_source', source);
        if (!targetUrl.searchParams.has('ep.utm_medium')) targetUrl.searchParams.set('ep.utm_medium', medium);
        if (!targetUrl.searchParams.has('ep.bot_detected')) targetUrl.searchParams.set('ep.bot_detected', 'true');
      }

      if (piiRedactor.isEnabled()) {
        piiRedactor.redactSearchParams(targetUrl.searchParams);
      }

      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        });
      }

      if (!matchesAllowlist(targetUrl.hostname, allowedDomains)) {
        return new Response(JSON.stringify({ error: 'Target host is not permitted' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
        });
      }

      return forwardUpstreamRequest({
        request,
        targetUrl,
        timeoutMs,
        relayEndpoint,
        headerName,
        stripHeaders,
        botCheck,
        botUtmSource,
        botUtmMedium,
        serverOptions: options,
        piiRedactor,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Proxy forwarding failed';
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      });
    }
  };
}

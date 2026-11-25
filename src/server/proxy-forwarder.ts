import type { ServerProxyOptions, BotDetectionResult } from '../types.js';
import { morphGtmScript } from '../morph-gtm.js';
import type { PiiRedactor } from '../pii-redactor.js';

export interface ForwardOptions {
  request: Request;
  targetUrl: URL;
  timeoutMs: number;
  relayEndpoint: string;
  headerName: string;
  stripHeaders: Set<string>;
  botCheck: BotDetectionResult;
  botUtmSource: string | null;
  botUtmMedium: string | null;
  serverOptions: ServerProxyOptions;
  piiRedactor: PiiRedactor;
}

/**
 * Forwards an incoming client telemetry hit to the upstream service or sGTM container.
 */
export async function forwardUpstreamRequest(opts: ForwardOptions): Promise<Response> {
  const {
    request,
    targetUrl,
    timeoutMs,
    relayEndpoint,
    headerName,
    stripHeaders,
    botCheck,
    botUtmSource,
    botUtmMedium,
    serverOptions,
    piiRedactor,
  } = opts;

  // Optional Server Container Routing:
  // If serverContainerUrl is configured, redirect google-analytics.com requests to sGTM container
  if (
    serverOptions.serverContainerUrl &&
    (targetUrl.hostname.includes('google-analytics.com') || targetUrl.hostname.includes('analytics.google.com'))
  ) {
    try {
      const serverBase = new URL(serverOptions.serverContainerUrl);
      targetUrl.protocol = serverBase.protocol;
      targetUrl.host = serverBase.host;
      targetUrl.port = serverBase.port;
    } catch {}
  }

  // Build clean upstream headers
  const forwardHeaders = new Headers();
  request.headers.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (!stripHeaders.has(lowerKey) && lowerKey !== headerName && lowerKey !== 'x-tatvic-target') {
      forwardHeaders.set(key, val);
    }
  });

  // Extract sGTM preview token with priority for active incoming request session
  let cookieToken: string | undefined;
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:_gtm_server_preview|gtm_server_preview|gtm_preview)=([^;]+)/);
    if (match && match[1]) {
      try {
        cookieToken = decodeURIComponent(match[1]);
      } catch {
        cookieToken = match[1];
      }
    }
  }

  const previewToken =
    request.headers.get('x-gtm-server-preview') ||
    targetUrl.searchParams.get('gtm_server_preview') ||
    targetUrl.searchParams.get('_gtm_server_preview') ||
    cookieToken ||
    serverOptions.serverPreviewToken;

  if (previewToken) {
    forwardHeaders.set('x-gtm-server-preview', previewToken);
    if (!targetUrl.searchParams.has('gtm_server_preview') && !targetUrl.searchParams.has('_gtm_server_preview')) {
      targetUrl.searchParams.set('_gtm_server_preview', previewToken);
    }
  }

  // Forward client IP
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (clientIp) {
    forwardHeaders.set('x-forwarded-for', clientIp);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchInit: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    signal: controller.signal,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (piiRedactor.isEnabled()) {
      const contentType = request.headers.get('content-type') || '';
      const rawText = await request.text();
      fetchInit.body = piiRedactor.redactBody(rawText, contentType);
      forwardHeaders.delete('content-length');
    } else {
      fetchInit.body = await request.arrayBuffer();
    }
  }

  const upstreamResponse = await fetch(targetUrl.toString(), fetchInit);
  clearTimeout(timer);

  // If fetching a GTM container script via relay, morph it before returning!
  if (targetUrl.hostname.includes('googletagmanager.com') && targetUrl.pathname.includes('/gtm.js')) {
    const rawCode = await upstreamResponse.text();
    const morphedCode = morphGtmScript(
      rawCode,
      relayEndpoint,
      targetUrl.searchParams.get('id') || targetUrl.searchParams.get('cid') || targetUrl.searchParams.get('_id') || 'GTM-T32XGF8F'
    );
    const isDebug = targetUrl.searchParams.has('gtm_debug');

    return new Response(morphedCode, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': 'application/javascript; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': isDebug ? 'no-cache, no-store, must-revalidate' : 'public, max-age=900',
      },
    });
  }

  // Return standard upstream response back to the client
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Headers', `*, ${headerName}`);

  if (botCheck.isBot || botUtmSource || botUtmMedium) {
    const source = botUtmSource || 'bot';
    const medium = botUtmMedium || 'agent';
    responseHeaders.set('X-Tatvic-Bot-Detected', 'true');
    responseHeaders.set('X-Tatvic-Bot-Source', source);
    responseHeaders.set('X-Tatvic-Bot-Medium', medium);
    responseHeaders.set(
      'Access-Control-Expose-Headers',
      `*, ${headerName}, X-Tatvic-Bot-Detected, X-Tatvic-Bot-Source, X-Tatvic-Bot-Medium`
    );
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

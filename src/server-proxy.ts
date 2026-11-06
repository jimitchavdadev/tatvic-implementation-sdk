import type { ServerProxyOptions } from './types.js';
import { DEFAULT_TARGET_DOMAINS, DEFAULT_HEADER_NAME, DEFAULT_PROXY_ENDPOINT } from './defaults.js';
import { morphGtmScript } from './morph-gtm.js';

/**
 * Creates a server-side proxy handler that receives proxied first-party requests
 * from the client SDK, validates them, safely forwards them to upstream targets,
 * and morphs GTM container scripts to bypass ad blockers while preserving Tag Assistant preview mode.
 */
export function createProxyHandler(options: ServerProxyOptions = {}) {
  const headerName = (options.targetHeaderName ?? DEFAULT_HEADER_NAME).toLowerCase();
  const allowedDomains = options.allowedDomains ?? DEFAULT_TARGET_DOMAINS;
  const timeoutMs = options.timeoutMs ?? 10000;
  const relayEndpoint = DEFAULT_PROXY_ENDPOINT;
  const stripHeaders = new Set(
    (options.stripHeaders ?? ['host', 'authorization', 'connection']).map((h) =>
      h.toLowerCase()
    )
  );

  return async function handleProxyRequest(request: Request): Promise<Response> {
    try {
      const reqUrl = new URL(request.url);

      // 0. Handle Morphed GTM loader (/gtm.js, /loader.js, /core.js, etc.)
      const pathname = reqUrl.pathname;
      if (
        pathname.endsWith('/gtm.js') ||
        pathname.endsWith('/loader.js') ||
        pathname.endsWith('/core.js') ||
        pathname.endsWith('/loader') ||
        pathname.includes('/_tatvic/loader.js') ||
        pathname.includes('/_tatvic/gtm.js') ||
        pathname.includes('/_tatvic/core.js')
      ) {
        return handleMorphedGtmRequest(request, reqUrl);
      }

      // 1. Extract target URL from header or query parameter
      let targetUrlStr: string | null = request.headers.get(headerName);

      if (!targetUrlStr) {
        targetUrlStr = reqUrl.searchParams.get('_tgt');
      }

      if (!targetUrlStr) {
        return new Response(JSON.stringify({ error: 'Missing target destination' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 2. Decode target URL if obfuscated
      if (options.obfuscateTarget) {
        try {
          if (typeof atob !== 'undefined') {
            targetUrlStr = atob(targetUrlStr);
          } else {
            targetUrlStr = Buffer.from(targetUrlStr, 'base64').toString('utf-8');
          }
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid obfuscated target' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // 3. Parse and validate target URL
      let targetUrl: URL;
      try {
        targetUrl = new URL(targetUrlStr);
      } catch {
        return new Response(JSON.stringify({ error: 'Malformed target URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Only allow HTTP/HTTPS
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'Unsupported protocol' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 4. SSRF Defense: Verify hostname is on the strict allowlist
      const isAllowed = matchesAllowlist(targetUrl.hostname, allowedDomains);
      if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Target host is not permitted' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Optional Server Container Routing:
      // If serverContainerUrl is configured, redirect google-analytics.com requests to sGTM container
      if (
        options.serverContainerUrl &&
        (targetUrl.hostname.includes('google-analytics.com') || targetUrl.hostname.includes('analytics.google.com'))
      ) {
        try {
          const sGtmOrigin = new URL(options.serverContainerUrl);
          targetUrl.protocol = sGtmOrigin.protocol;
          targetUrl.host = sGtmOrigin.host;
          targetUrl.port = sGtmOrigin.port;
        } catch {}
      }

      // 5. Prepare upstream headers
      const upstreamHeaders = new Headers();
      request.headers.forEach((val, key) => {
        const lowerKey = key.toLowerCase();
        if (!stripHeaders.has(lowerKey) && lowerKey !== headerName) {
          upstreamHeaders.set(key, val);
        }
      });

      // Forward server preview token if provided via header, query, or option
      const serverPreviewToken =
        request.headers.get('x-gtm-server-preview') ||
        reqUrl.searchParams.get('_gtm_server_preview') ||
        options.serverPreviewToken;
      if (serverPreviewToken) {
        upstreamHeaders.set('x-gtm-server-preview', serverPreviewToken);

        // When debugging in preview mode, ensure GA4 collect requests have debug signals (_dbg=1, ep.debug_mode=true)
        // so that the device immediately registers and displays in GA4 DebugView.
        if (targetUrl.pathname.includes('/collect') || targetUrl.pathname.includes('/g/collect')) {
          if (!targetUrl.searchParams.has('_dbg')) {
            targetUrl.searchParams.set('_dbg', '1');
          }
          if (!targetUrl.searchParams.has('ep.debug_mode')) {
            targetUrl.searchParams.set('ep.debug_mode', 'true');
          }
        }
      }

      // Preserve or set client IP headers if available
      const clientIp =
        request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip');
      if (clientIp) {
        upstreamHeaders.set('x-forwarded-for', clientIp);
      }

      // 6. Forward the request to the upstream target
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
      const body = hasBody ? await request.arrayBuffer() : undefined;

      const upstreamResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body,
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timer);

      // If fetching a GTM container script via relay, morph it before returning!
      if (targetUrl.hostname.includes('googletagmanager.com') && targetUrl.pathname.includes('/gtm.js')) {
        const rawCode = await upstreamResponse.text();
        const morphedCode = morphGtmScript(rawCode, relayEndpoint);
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

      // 7. Return standard upstream response back to the client
      const responseHeaders = new Headers(upstreamResponse.headers);

      // Clean up hop-by-hop headers that should not be forwarded
      responseHeaders.delete('transfer-encoding');
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');

      // Enable CORS for first-party domain
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set(
        'Access-Control-Allow-Headers',
        `*, ${headerName}`
      );

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Proxy forwarding failed';
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  async function handleMorphedGtmRequest(request: Request, reqUrl: URL): Promise<Response> {
    // Support stealth query parameter 'cid', 'container', 'tag' to bypass ad blocker '.js?id=GTM-' rules, as well as classic 'id'
    const containerId =
      reqUrl.searchParams.get('cid') ||
      reqUrl.searchParams.get('container') ||
      reqUrl.searchParams.get('tag') ||
      reqUrl.searchParams.get('id');

    if (!containerId || !/^[A-Z0-9-_]+$/i.test(containerId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing container id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build upstream GTM url with 'id' parameter and all other query parameters preserved
    const upstreamUrl = new URL('https://www.googletagmanager.com/gtm.js');
    upstreamUrl.searchParams.set('id', containerId);

    reqUrl.searchParams.forEach((val, key) => {
      if (key !== 'cid' && key !== 'container' && key !== 'tag' && key !== 'id') {
        upstreamUrl.searchParams.set(key, val);
      }
    });

    try {
      const upstreamRes = await fetch(upstreamUrl.toString(), {
        headers: {
          'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
          'Accept': 'application/javascript, */*',
        },
      });

      if (!upstreamRes.ok) {
        return new Response(JSON.stringify({ error: `Upstream GTM returned ${upstreamRes.status}` }), {
          status: upstreamRes.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rawCode = await upstreamRes.text();
      const morphedCode = morphGtmScript(rawCode, relayEndpoint);
      const isDebug = reqUrl.searchParams.has('gtm_debug');

      return new Response(morphedCode, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=UTF-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Cache-Control': isDebug
            ? 'no-cache, no-store, must-revalidate'
            : 'public, max-age=900',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch upstream GTM';
      return new Response(JSON.stringify({ error: msg }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

function matchesAllowlist(hostname: string, allowlist: (string | RegExp)[]): boolean {
  const cleanHost = hostname.toLowerCase();
  for (const rule of allowlist) {
    if (rule instanceof RegExp) {
      if (rule.test(cleanHost)) return true;
    } else {
      const cleanRule = rule.toLowerCase().trim();
      if (cleanHost === cleanRule || cleanHost.endsWith(`.${cleanRule}`)) {
        return true;
      }
    }
  }
  return false;
}

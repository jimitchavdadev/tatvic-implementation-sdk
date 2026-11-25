import type { BotDetectionResult } from '../types.js';
import { morphGtmScript } from '../morph-gtm.js';

/**
 * Handles fetching, morphing, and serving GTM/gtag container scripts through the first-party proxy.
 */
export async function handleMorphedGtmRequest(
  request: Request,
  reqUrl: URL,
  relayEndpoint: string,
  botCheck?: BotDetectionResult
): Promise<Response> {
  const containerId =
    reqUrl.searchParams.get('cid') ||
    reqUrl.searchParams.get('container') ||
    reqUrl.searchParams.get('tag') ||
    reqUrl.searchParams.get('_id') ||
    reqUrl.searchParams.get('id');

  if (!containerId || !/^[A-Z0-9-_]+$/i.test(containerId)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing container id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isGtag = reqUrl.searchParams.get('_type') === 'gtag' || containerId.startsWith('G-');
  const upstreamUrl = isGtag
    ? new URL('https://www.googletagmanager.com/gtag/js')
    : new URL('https://www.googletagmanager.com/gtm.js');

  upstreamUrl.searchParams.set('id', containerId);

  reqUrl.searchParams.forEach((val, key) => {
    if (key === 'cid' || key === 'container' || key === 'tag' || key === 'id' || key === '_id' || key === '_type') return;
    if (key === '_cx') upstreamUrl.searchParams.set('cx', val);
    else if (key === '_gtm') upstreamUrl.searchParams.set('gtm', val);
    else if (key === '_tag_exp') upstreamUrl.searchParams.set('tag_exp', val);
    else if (key === '_l') upstreamUrl.searchParams.set('l', val);
    else upstreamUrl.searchParams.set(key, val);
  });

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refUrl = new URL(referer);
      for (const flag of ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win']) {
        if (!upstreamUrl.searchParams.has(flag) && refUrl.searchParams.has(flag)) {
          upstreamUrl.searchParams.set(flag, refUrl.searchParams.get(flag)!);
        }
      }
    } catch {}
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0',
      'Accept': 'application/javascript, */*',
    };
    if (request.headers.get('cookie')) {
      upstreamHeaders['Cookie'] = request.headers.get('cookie')!;
    }

    const upstreamRes = await fetch(upstreamUrl.toString(), {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ error: `Upstream GTM returned ${upstreamRes.status}` }), {
        status: upstreamRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawCode = await upstreamRes.text();
    const morphedCode = morphGtmScript(rawCode, relayEndpoint, containerId);
    const isDebug =
      reqUrl.searchParams.has('gtm_debug') ||
      reqUrl.searchParams.has('gtm_preview') ||
      reqUrl.searchParams.has('gtm_auth') ||
      upstreamUrl.searchParams.has('gtm_debug') ||
      upstreamUrl.searchParams.has('gtm_preview');

    let finalCode = morphedCode;

    if (!isGtag) {
      const gtmInit = `if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
  var _hasStart = false;
  for (var _i = 0; _i < window.dataLayer.length; _i++) {
    if (window.dataLayer[_i] && window.dataLayer[_i]['gtm.start']) {
      _hasStart = true;
      break;
    }
  }
  if (!_hasStart) {
    window.dataLayer.unshift({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    });
  }
}\n`;
      finalCode = gtmInit + finalCode;
    }

    if (botCheck?.isBot && botCheck.utm) {
      const botInjection = `/* [Tatvic SDK] 🤖 Bot detected: ${(botCheck.reason || 'Automated agent').replace(/[\r\n"']/g, ' ')} */
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'bot_detected',
    utm_source: '${botCheck.utm.utm_source}',
    utm_medium: '${botCheck.utm.utm_medium}',
    bot_reason: '${(botCheck.reason || '').replace(/[\r\n"']/g, ' ')}'
  });
}
`;
      finalCode = botInjection + finalCode;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': isDebug
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=900',
    };

    if (botCheck?.isBot && botCheck.utm) {
      headers['X-Tatvic-Bot-Detected'] = 'true';
      headers['X-Tatvic-Bot-Source'] = botCheck.utm.utm_source;
      headers['X-Tatvic-Bot-Medium'] = botCheck.utm.utm_medium;
      headers['X-Tatvic-Bot-Reason'] = botCheck.reason ?? 'Automated agent';
      headers['Access-Control-Expose-Headers'] =
        'X-Tatvic-Bot-Detected, X-Tatvic-Bot-Source, X-Tatvic-Bot-Medium, X-Tatvic-Bot-Reason';
    }

    return new Response(finalCode, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch upstream GTM';
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

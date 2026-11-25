import type { PatchContext } from './patch-fetch.js';
import { appendBotUtmToUrl, appendBotUtmHeaders } from './bot-utm.js';
import { detectPreviewToken } from './token-detector.js';

/**
 * Patches navigator.sendBeacon to route through the first-party proxy with keepalive or query routing.
 */
export function patchSendBeacon(ctx: PatchContext): typeof navigator.sendBeacon | undefined {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return undefined;

  const originalSendBeacon = navigator.sendBeacon.bind(navigator);
  const { matcher, piiRedactor, options } = ctx;
  const polyfillWithKeepalive = options.polyfillBeaconWithKeepalive !== false;

  navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
    const targetUrl = url.toString();

    // Suppress GTM internal diagnostic telemetry pings (/a?)
    if (targetUrl.includes('/a?') || targetUrl.includes('_telemetry=gtm')) {
      matcher.log('Suppressed GTM telemetry beacon:', targetUrl);
      return true;
    }

    const parsed = matcher.parseUrl(targetUrl);
    const isAlreadyProxy =
      parsed &&
      typeof window !== 'undefined' &&
      window.location?.origin &&
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith(matcher.getProxyEndpoint());

    if (!matcher.shouldProxy(targetUrl) && !isAlreadyProxy) {
      return originalSendBeacon(url, data);
    }

    matcher.log('Intercepted sendBeacon:', targetUrl);

    let beaconData = data;
    if (typeof beaconData === 'string' && piiRedactor.isEnabled()) {
      beaconData = piiRedactor.redactBody(beaconData);
    }

    if (polyfillWithKeepalive && typeof window.fetch === 'function') {
      const info = matcher.getProxiedRequestInfo(targetUrl);
      let proxyUrl = isAlreadyProxy ? matcher.sanitizeUrl(targetUrl) : info.proxyUrl;
      proxyUrl = appendBotUtmToUrl(proxyUrl, ctx.botUtm);
      if (piiRedactor.isEnabled()) {
        proxyUrl = piiRedactor.redactUrl(proxyUrl);
      }
      const previewToken = options.serverPreviewToken || detectPreviewToken();
      const headers = new Headers();
      if (info.headerName && info.headerValue) {
        headers.set(info.headerName, info.headerValue);
      }
      if (previewToken) {
        headers.set('x-gtm-server-preview', previewToken);
      }
      appendBotUtmHeaders(headers, ctx.botUtm);

      try {
        window.fetch(proxyUrl, {
          method: 'POST',
          body: beaconData,
          headers,
          keepalive: true,
          mode: 'cors',
        }).catch((err) => {
          matcher.log('Async sendBeacon keepalive fetch error:', err);
        });
        return true;
      } catch {}
    }

    let destinationUrl: string;
    if (isAlreadyProxy) {
      destinationUrl = matcher.sanitizeUrl(targetUrl);
    } else {
      const queryInfo = matcher.getProxiedRequestInfo(targetUrl, 'query');
      destinationUrl = queryInfo.proxyUrl;
    }

    destinationUrl = appendBotUtmToUrl(destinationUrl, ctx.botUtm);
    if (piiRedactor.isEnabled()) {
      destinationUrl = piiRedactor.redactUrl(destinationUrl);
    }

    const previewToken = options.serverPreviewToken || detectPreviewToken();
    if (previewToken && !destinationUrl.includes('_gtm_server_preview=')) {
      destinationUrl += (destinationUrl.includes('?') ? '&' : '?') + '_gtm_server_preview=' + encodeURIComponent(previewToken);
    }

    try {
      return originalSendBeacon(destinationUrl, beaconData);
    } catch {
      try {
        window.fetch(destinationUrl, {
          method: 'POST',
          body: beaconData,
          keepalive: true,
          mode: 'no-cors',
        }).catch(() => {});
        return true;
      } catch {
        return false;
      }
    }
  };

  return originalSendBeacon;
}

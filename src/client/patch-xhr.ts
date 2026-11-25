import type { PatchContext } from './patch-fetch.js';
import { appendBotUtmToUrl } from './bot-utm.js';
import { detectPreviewToken } from './token-detector.js';
import './types.js';

export interface XhrPatchResult {
  originalOpen: typeof XMLHttpRequest.prototype.open;
  originalSend: typeof XMLHttpRequest.prototype.send;
}

/**
 * Patches XMLHttpRequest.prototype.open and send to route tracking requests through the first-party relay.
 */
export function patchXhr(ctx: PatchContext): XhrPatchResult | undefined {
  if (typeof XMLHttpRequest === 'undefined') return undefined;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const { matcher, piiRedactor, options } = ctx;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ): void {
    const targetUrl = url.toString();

    const parsed = matcher.parseUrl(targetUrl);
    const isAlreadyProxy =
      parsed &&
      typeof window !== 'undefined' &&
      window.location?.origin &&
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith(matcher.getProxyEndpoint());

    if (matcher.shouldProxy(targetUrl) || isAlreadyProxy) {
      matcher.log('Intercepted XHR:', targetUrl);
      let proxyUrl: string;
      let headerName: string | undefined;
      let headerValue: string | undefined;

      if (isAlreadyProxy) {
        proxyUrl = matcher.sanitizeUrl(targetUrl);
      } else {
        const info = matcher.getProxiedRequestInfo(targetUrl);
        proxyUrl = info.proxyUrl;
        headerName = info.headerName;
        headerValue = info.headerValue;
      }

      proxyUrl = appendBotUtmToUrl(proxyUrl, ctx.botUtm);

      if (piiRedactor.isEnabled()) {
        proxyUrl = piiRedactor.redactUrl(proxyUrl);
      }
      const previewToken = options.serverPreviewToken || detectPreviewToken();

      this.__tatvicMeta = {
        isProxied: true,
        originalUrl: targetUrl,
        headerName,
        headerValue,
        previewToken,
        botUtm: ctx.botUtm,
      };

      return originalOpen.call(this, method, proxyUrl, async, username, password);
    }

    this.__tatvicMeta = { isProxied: false };
    return originalOpen.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    if (this.__tatvicMeta?.isProxied) {
      const { headerName, headerValue, previewToken, botUtm } = this.__tatvicMeta;
      if (headerName && headerValue) {
        try {
          this.setRequestHeader(headerName, headerValue);
        } catch (e) {
          matcher.log('Failed to set proxy header on XHR:', e);
        }
      }
      if (previewToken) {
        try {
          this.setRequestHeader('x-gtm-server-preview', previewToken);
        } catch (e) {
          matcher.log('Failed to set preview header on XHR:', e);
        }
      }
      if (botUtm) {
        try {
          this.setRequestHeader('x-tatvic-bot-source', botUtm.utm_source);
          this.setRequestHeader('x-tatvic-bot-medium', botUtm.utm_medium);
        } catch {}
      }
    }

    let sendBody = body;
    if (typeof sendBody === 'string' && piiRedactor.isEnabled()) {
      sendBody = piiRedactor.redactBody(sendBody);
    }
    return originalSend.call(this, sendBody);
  };

  return { originalOpen, originalSend };
}

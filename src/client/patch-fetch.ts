import type { ProxySdkOptions, BotUtmParams } from '../types.js';
import type { UrlMatcher } from '../url-matcher.js';
import type { PiiRedactor } from '../pii-redactor.js';
import { appendBotUtmToUrl, appendBotUtmHeaders } from './bot-utm.js';
import { detectPreviewToken } from './token-detector.js';

export interface PatchContext {
  matcher: UrlMatcher;
  piiRedactor: PiiRedactor;
  options: ProxySdkOptions;
  botUtm?: BotUtmParams;
}

/**
 * Patches window.fetch to route tracking requests through the first-party relay.
 */
export function patchFetch(ctx: PatchContext): typeof window.fetch | undefined {
  if (typeof window === 'undefined' || !window.fetch) return undefined;

  const originalFetch = window.fetch.bind(window);
  const { matcher, piiRedactor, options } = ctx;

  const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let targetUrl: string;

    if (typeof input === 'string') {
      targetUrl = input;
    } else if (input instanceof URL) {
      targetUrl = input.toString();
    } else if (typeof Request !== 'undefined' && input instanceof Request) {
      targetUrl = input.url;
    } else {
      targetUrl = String(input);
    }

    const parsed = matcher.parseUrl(targetUrl);
    const isAlreadyProxy =
      parsed &&
      typeof window !== 'undefined' &&
      window.location?.origin &&
      parsed.origin === window.location.origin &&
      parsed.pathname.startsWith(matcher.getProxyEndpoint());

    if (!matcher.shouldProxy(targetUrl) && !isAlreadyProxy) {
      return originalFetch(input, init);
    }

    matcher.log('Intercepted fetch:', targetUrl);
    const isNoCors = init?.mode === 'no-cors' || (typeof Request !== 'undefined' && input instanceof Request && input.mode === 'no-cors');
    const previewToken = options.serverPreviewToken || detectPreviewToken();

    let proxyUrl: string;
    let headerName: string | undefined;
    let headerValue: string | undefined;

    if (isAlreadyProxy) {
      proxyUrl = matcher.sanitizeUrl(targetUrl);
    } else {
      const info = matcher.getProxiedRequestInfo(targetUrl, isNoCors ? 'query' : undefined);
      proxyUrl = info.proxyUrl;
      headerName = info.headerName;
      headerValue = info.headerValue;
    }

    proxyUrl = appendBotUtmToUrl(proxyUrl, ctx.botUtm);

    if (piiRedactor.isEnabled()) {
      proxyUrl = piiRedactor.redactUrl(proxyUrl);
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      const headers = new Headers(input.headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((val, key) => headers.set(key, val));
      }
      if (headerName && headerValue && !isNoCors) {
        headers.set(headerName, headerValue);
      }
      if (previewToken && !headers.has('x-gtm-server-preview')) {
        headers.set('x-gtm-server-preview', previewToken);
      }
      appendBotUtmHeaders(headers, ctx.botUtm);

      const proxiedRequest = new Request(proxyUrl, {
        method: init?.method ?? input.method,
        headers,
        body: init?.body ?? input.body,
        mode: isNoCors ? 'cors' : (init?.mode ?? input.mode ?? 'cors'),
        credentials: init?.credentials ?? input.credentials,
        cache: init?.cache ?? input.cache,
        redirect: init?.redirect ?? input.redirect,
        referrer: init?.referrer ?? input.referrer,
        integrity: init?.integrity ?? input.integrity,
        keepalive: init?.keepalive ?? input.keepalive,
        signal: init?.signal ?? input.signal,
      });

      return originalFetch(proxiedRequest);
    }

    const headers = new Headers(init?.headers);
    if (headerName && headerValue && !isNoCors) {
      headers.set(headerName, headerValue);
    }
    if (previewToken && !headers.has('x-gtm-server-preview')) {
      headers.set('x-gtm-server-preview', previewToken);
    }
    appendBotUtmHeaders(headers, ctx.botUtm);

    let reqBody = init?.body;
    if (typeof reqBody === 'string' && piiRedactor.isEnabled()) {
      const cType = headers.get('content-type') || '';
      reqBody = piiRedactor.redactBody(reqBody, cType);
    }

    const modifiedInit: RequestInit = {
      ...init,
      body: reqBody,
      headers,
      mode: isNoCors ? 'cors' : (init?.mode ?? 'cors'),
    };

    return originalFetch(proxyUrl, modifiedInit);
  };

  Object.assign(patchedFetch, originalFetch);
  window.fetch = patchedFetch as typeof window.fetch;
  return originalFetch;
}

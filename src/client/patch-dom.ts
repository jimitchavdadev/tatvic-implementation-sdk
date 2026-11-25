import type { PatchContext } from './patch-fetch.js';
import { appendBotUtmToUrl } from './bot-utm.js';

export interface DomPatchResult {
  originalScriptDesc?: PropertyDescriptor;
  originalImageDesc?: PropertyDescriptor;
}

/**
 * Patches HTMLScriptElement.prototype.src for dynamically injected scripts.
 */
export function patchScriptElements(ctx: PatchContext): PropertyDescriptor | undefined {
  if (typeof HTMLScriptElement === 'undefined') return undefined;

  const desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  if (!desc || !desc.set || !desc.get) return undefined;

  const matcher = ctx.matcher;
  const originalSet = desc.set;
  const originalGet = desc.get;

  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    set(this: HTMLScriptElement, val: string) {
      if (
        typeof val === 'string' &&
        !val.includes('/debug/') &&
        !val.includes('debug/bootstrap') &&
        !val.includes('tagassistant.google.com') &&
        !val.includes('/taggy/') &&
        (val.includes('googletagmanager.com/gtm.js') ||
          val.includes('googletagmanager.com/gtag/js') ||
          val.includes('/gtag/js') ||
          val.includes('/_tatvic/gtm.js') ||
          val.includes('/_tatvic/loader.js') ||
          (val.includes('googletagmanager.com') && (val.includes('id=GTM-') || val.includes('id=G-'))))
      ) {
        try {
          const pageSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
          const pageParams = new URLSearchParams(pageSearch);
          const targetUrl = new URL(val, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

          const isGtag = val.includes('/gtag/js') || (targetUrl.searchParams.get('id') || '').startsWith('G-');
          const containerId =
            targetUrl.searchParams.get('cid') ||
            targetUrl.searchParams.get('container') ||
            targetUrl.searchParams.get('tag') ||
            targetUrl.searchParams.get('id') ||
            targetUrl.searchParams.get('_id') ||
            (isGtag ? 'G-VVBCZC9JSW' : 'GTM-T32XGF8F');

          const morphedParams = new URLSearchParams();
          morphedParams.set('cid', containerId);
          if (isGtag) {
            morphedParams.set('_type', 'gtag');
          }

          targetUrl.searchParams.forEach((v, k) => {
            if (k === 'id' || k === 'cid' || k === 'container' || k === 'tag' || k === '_id') return;
            if (k === 'cx') morphedParams.set('_cx', v);
            else if (k === 'gtm') morphedParams.set('_gtm', v);
            else if (k === 'tag_exp') morphedParams.set('_tag_exp', v);
            else if (k === 'l' && (v === 'dataLayer' || v.includes('Layer'))) morphedParams.set('_l', v);
            else morphedParams.set(k, v);
          });

          for (const param of ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win']) {
            if (pageParams.has(param) && !morphedParams.has(param)) {
              morphedParams.set(param, pageParams.get(param)!);
            }
          }

          const morphedUrl = `/_tatvic/loader.js?${morphedParams.toString()}`;
          matcher.log('Morphed script element to stealth loader:', val, '->', morphedUrl);
          return originalSet.call(this, morphedUrl);
        } catch {}
      }

      const parsed = matcher.parseUrl(val);
      const isAlreadyProxy =
        parsed &&
        typeof window !== 'undefined' &&
        window.location?.origin &&
        parsed.origin === window.location.origin &&
        parsed.pathname.startsWith(matcher.getProxyEndpoint());

      if (matcher.shouldProxy(val) || isAlreadyProxy) {
        const proxyUrl = isAlreadyProxy
          ? matcher.sanitizeUrl(val)
          : matcher.getProxiedRequestInfo(val, 'query').proxyUrl;
        matcher.log('Intercepted dynamic script element:', val, '->', proxyUrl);
        return originalSet.call(this, proxyUrl);
      }
      return originalSet.call(this, val);
    },
    get(this: HTMLScriptElement) {
      return originalGet.call(this);
    },
    configurable: true,
    enumerable: true,
  });

  return desc;
}

/**
 * Patches HTMLImageElement.prototype.src for tracking pixels (<img src="...">)
 */
export function patchImageElements(ctx: PatchContext): PropertyDescriptor | undefined {
  if (typeof HTMLImageElement === 'undefined') return undefined;

  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (!desc || !desc.set || !desc.get) return undefined;

  const matcher = ctx.matcher;
  const originalSet = desc.set;
  const originalGet = desc.get;

  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set(this: HTMLImageElement, val: string) {
      const parsed = matcher.parseUrl(val);
      const isAlreadyProxy =
        parsed &&
        typeof window !== 'undefined' &&
        window.location?.origin &&
        parsed.origin === window.location.origin &&
        parsed.pathname.startsWith(matcher.getProxyEndpoint());

      if (matcher.shouldProxy(val) || isAlreadyProxy) {
        let proxyUrl = isAlreadyProxy
          ? matcher.sanitizeUrl(val)
          : matcher.getProxiedRequestInfo(val, 'query').proxyUrl;

        proxyUrl = appendBotUtmToUrl(proxyUrl, ctx.botUtm);
        if (ctx.piiRedactor.isEnabled()) {
          proxyUrl = ctx.piiRedactor.redactUrl(proxyUrl);
        }
        matcher.log('Intercepted tracking pixel image:', val, '->', proxyUrl);
        return originalSet.call(this, proxyUrl);
      }
      return originalSet.call(this, val);
    },
    get(this: HTMLImageElement) {
      return originalGet.call(this);
    },
    configurable: true,
    enumerable: true,
  });

  return desc;
}

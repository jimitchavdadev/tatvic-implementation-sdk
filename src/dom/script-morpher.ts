import type { ProxySdkOptions } from '../types.js';

/**
 * Scans a DOM element or container and morphs tracking scripts to use first-party stealth endpoints.
 */
export function morphDomScripts(container: Element, options: ProxySdkOptions = {}): void {
  try {
    if (!container.querySelectorAll || typeof document === 'undefined') return;

    const scripts = container.querySelectorAll('script[src]');
    scripts.forEach((s) => {
      const src = s.getAttribute('src');
      if (!src) return;

      // 1. Detect GTM script tags and morph to first-party stealth loader with preview params
      if (
        !src.includes('/debug/') &&
        !src.includes('debug/bootstrap') &&
        !src.includes('tagassistant.google.com') &&
        !src.includes('/taggy/') &&
        (src.includes('googletagmanager.com/gtm.js') ||
          src.includes('googletagmanager.com/gtag/js') ||
          src.includes('/gtag/js') ||
          src.includes('/_tatvic/gtm.js') ||
          src.includes('/_tatvic/loader.js') ||
          (src.includes('googletagmanager.com') && (src.includes('id=GTM-') || src.includes('id=G-'))))
      ) {
        const pageSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
        const pageParams = new URLSearchParams(pageSearch);
        const targetUrl = new URL(src, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

        const isGtag = src.includes('/gtag/js') || (targetUrl.searchParams.get('id') || '').startsWith('G-');
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
          if (k !== 'id' && k !== 'cid' && k !== 'container' && k !== 'tag' && k !== '_id' && k !== '_type') {
            if (k === 'cx') morphedParams.set('_cx', v);
            else if (k === 'gtm') morphedParams.set('_gtm', v);
            else if (k === 'tag_exp') morphedParams.set('_tag_exp', v);
            else if (k === 'l' && (v === 'dataLayer' || v.includes('Layer'))) morphedParams.set('_l', v);
            else morphedParams.set(k, v);
          }
        });

        for (const param of ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win']) {
          if (pageParams.has(param) && !morphedParams.has(param)) {
            morphedParams.set(param, pageParams.get(param)!);
          }
        }

        const morphedUrl = `/_tatvic/loader.js?${morphedParams.toString()}`;
        if (s.getAttribute('src') !== morphedUrl) {
          s.setAttribute('src', morphedUrl);

          const replacement = document.createElement('script');
          replacement.async = s.hasAttribute('async');
          replacement.src = morphedUrl;
          s.parentNode?.replaceChild(replacement, s);
        }
        return;
      }

      // 2. Generic tracking scripts
      if (!src.startsWith('/_tatvic/')) {
        const separator = (options.proxyEndpoint || '/_tatvic/relay').includes('?') ? '&' : '?';
        const proxied = `${options.proxyEndpoint || '/_tatvic/relay'}${separator}_tgt=${encodeURIComponent(src)}`;
        s.setAttribute('src', proxied);
      }
    });
  } catch {}
}

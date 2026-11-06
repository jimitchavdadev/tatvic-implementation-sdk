import { initFirstPartyWrapper } from './index.js';
import type { ProxySdkOptions } from './types.js';

/**
 * Standard Web Component: <tatvic-wrapper>
 *
 * Allows wrapping the entire application in any framework or plain HTML/PHP:
 *
 * <tatvic-wrapper>
 *   <app>...</app>
 * </tatvic-wrapper>
 */
export class TatvicWrapperElement extends (typeof HTMLElement !== 'undefined' ? HTMLElement : (Object as unknown as typeof HTMLElement)) {
  connectedCallback(): void {
    if (typeof window === 'undefined') return;

    // Ensure it doesn't affect page layout or CSS grids/flex
    if (this.style) {
      this.style.display = 'contents';
    }

    const endpoint = this.getAttribute ? this.getAttribute('endpoint') ?? undefined : undefined;
    const debug = this.getAttribute ? this.getAttribute('debug') === 'true' : false;
    const serverPreview = this.getAttribute
      ? (this.getAttribute('server-preview') || this.getAttribute('server-preview-token') || undefined)
      : undefined;

    const options: ProxySdkOptions = {};
    if (endpoint) options.proxyEndpoint = endpoint;
    if (debug) options.debug = true;
    if (serverPreview) options.serverPreviewToken = serverPreview;

    initFirstPartyWrapper(options);

    // Automatically detect and morph any GTM or tracking scripts inside the wrapper
    const morphScripts = () => {
      try {
        if (this.querySelectorAll && typeof document !== 'undefined') {
          const scripts = this.querySelectorAll('script[src]');
          scripts.forEach((s) => {
            const src = s.getAttribute('src');
            if (!src) return;

            // 1. Detect GTM script tags and morph to first-party stealth loader with preview params
            if (
              src.includes('googletagmanager.com/gtm.js') ||
              src.includes('/_tatvic/gtm.js') ||
              src.includes('/_tatvic/loader.js')
            ) {
              const pageSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
              const pageParams = new URLSearchParams(pageSearch);
              const targetUrl = new URL(src, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

              const containerId =
                targetUrl.searchParams.get('cid') ||
                targetUrl.searchParams.get('container') ||
                targetUrl.searchParams.get('tag') ||
                targetUrl.searchParams.get('id') ||
                'GTM-T32XGF8F';

              const morphedParams = new URLSearchParams();
              // Evade EasyPrivacy '.js?id=GTM-' and '/gtm.js' rules with stealth parameter 'cid'
              morphedParams.set('cid', containerId);

              targetUrl.searchParams.forEach((v, k) => {
                if (k !== 'id' && k !== 'cid' && k !== 'container' && k !== 'tag') {
                  morphedParams.set(k, v);
                }
              });

              // Pass through Tag Assistant preview flags (gtm_debug, gtm_auth, gtm_preview)
              for (const param of ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win']) {
                if (pageParams.has(param) && !morphedParams.has(param)) {
                  morphedParams.set(param, pageParams.get(param)!);
                }
              }

              const morphedUrl = `/_tatvic/loader.js?${morphedParams.toString()}`;
              if (s.getAttribute('src') !== morphedUrl) {
                s.setAttribute('src', morphedUrl);

                // Replace element to force first-party fetch from morphed loader
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
        }
      } catch {
        // Ignore if DOM querySelectorAll is not available
      }
    };

    morphScripts();
    if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(morphScripts);
    } else if (typeof setTimeout !== 'undefined') {
      setTimeout(morphScripts, 0);
    }
  }
}

// Auto-register custom element if in browser context
if (typeof window !== 'undefined' && typeof customElements !== 'undefined' && !customElements.get('tatvic-wrapper')) {
  try {
    customElements.define('tatvic-wrapper', TatvicWrapperElement as unknown as CustomElementConstructor);
  } catch {
    // In case of duplicate registration
  }
}

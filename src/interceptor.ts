import type { ProxySdkOptions } from './types.js';
import { UrlMatcher } from './url-matcher.js';
import { isClientBot } from './bot-detector.js';
import { PiiRedactor } from './pii-redactor.js';

interface TatvicXhrMetadata {
  isProxied?: boolean;
  isBypassedBot?: boolean;
  originalUrl?: string;
  headerName?: string;
  headerValue?: string;
  previewToken?: string;
}

declare global {
  interface XMLHttpRequest {
    __tatvicMeta?: TatvicXhrMetadata;
  }
}

export class RequestInterceptor {
  private matcher: UrlMatcher;
  private piiRedactor: PiiRedactor;
  private options: ProxySdkOptions;
  private isInstalled: boolean = false;

  private originalFetch?: typeof window.fetch;
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend?: typeof XMLHttpRequest.prototype.send;
  private originalSendBeacon?: typeof navigator.sendBeacon;
  private originalScriptSrcDesc?: PropertyDescriptor;
  private originalImageSrcDesc?: PropertyDescriptor;
  private isBotDetected: boolean = false;

  constructor(options: ProxySdkOptions = {}) {
    this.options = options;
    this.matcher = new UrlMatcher(options);
    this.piiRedactor = new PiiRedactor(options.piiRedaction);
  }

  /**
   * Installs monkey-patches on fetch, XMLHttpRequest, sendBeacon, <script src>, and <img src>.
   */
  public install(): void {
    if (this.isInstalled || typeof window === 'undefined') {
      return;
    }

    if (this.options.enabled === false) {
      this.matcher.log('SDK disabled via configuration.');
      return;
    }

    const isPreview = this.options.serverPreviewToken || this.detectPreviewToken();
    if (!isPreview && this.options.botDetection !== false) {
      const botCheck = isClientBot(this.options.botDetection);
      if (botCheck.isBot) {
        this.isBotDetected = true;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[Tatvic SDK] 🤖 Bot detected: ${botCheck.reason}. Request interceptor is muting outgoing analytics telemetry.`
          );
        }
        this.matcher.log(`Bot environment detected (${botCheck.reason}). Telemetry requests will be suppressed.`);
      }
    }

    this.patchFetch();
    this.patchXhr();
    this.patchSendBeacon();
    this.patchScriptElements();
    this.patchImageElements();

    this.isInstalled = true;
    this.matcher.log('First-party request interceptor active.');
  }

  /**
   * Restores all patched browser APIs to their original native implementations.
   */
  public uninstall(): void {
    if (!this.isInstalled || typeof window === 'undefined') {
      return;
    }

    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = undefined;
    }

    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = undefined;
    }

    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = undefined;
    }

    if (this.originalSendBeacon && navigator.sendBeacon) {
      navigator.sendBeacon = this.originalSendBeacon;
      this.originalSendBeacon = undefined;
    }

    if (this.originalScriptSrcDesc && typeof HTMLScriptElement !== 'undefined') {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', this.originalScriptSrcDesc);
      this.originalScriptSrcDesc = undefined;
    }

    if (this.originalImageSrcDesc && typeof HTMLImageElement !== 'undefined') {
      Object.defineProperty(HTMLImageElement.prototype, 'src', this.originalImageSrcDesc);
      this.originalImageSrcDesc = undefined;
    }

    this.isInstalled = false;
    this.matcher.log('First-party request interceptor uninstalled.');
  }

  /**
   * Patch window.fetch
   */
  private patchFetch(): void {
    if (!window.fetch) return;
    this.originalFetch = window.fetch.bind(window);
    const originalFetch = this.originalFetch;
    const matcher = this.matcher;
    const isBot = () => this.isBotDetected;

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

      if (!matcher.shouldProxy(targetUrl)) {
        return originalFetch(input, init);
      }

      // If running inside an automated bot environment, suppress network fetch
      if (isBot()) {
        matcher.log('Suppressed fetch for automated bot:', targetUrl);
        return new Response(null, {
          status: 204,
          statusText: 'No Content (Bot Bypassed)',
          headers: { 'X-Tatvic-Bot-Bypass': 'true' },
        });
      }

      matcher.log('Intercepted fetch:', targetUrl);
      const isNoCors = init?.mode === 'no-cors' || (typeof Request !== 'undefined' && input instanceof Request && input.mode === 'no-cors');
      const info = matcher.getProxiedRequestInfo(targetUrl, isNoCors ? 'query' : undefined);
      let proxyUrl = info.proxyUrl;
      if (this.piiRedactor.isEnabled()) {
        proxyUrl = this.piiRedactor.redactUrl(proxyUrl);
      }
      const previewToken = this.options.serverPreviewToken || this.detectPreviewToken();

      // Handle Request object input vs (url, init)
      if (typeof Request !== 'undefined' && input instanceof Request) {
        const headers = new Headers(input.headers);
        if (init?.headers) {
          new Headers(init.headers).forEach((val, key) => headers.set(key, val));
        }
        if (info.headerName && info.headerValue && !isNoCors) {
          headers.set(info.headerName, info.headerValue);
        }
        if (previewToken && !headers.has('x-gtm-server-preview')) {
          headers.set('x-gtm-server-preview', previewToken);
        }

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

      // Handle string / URL input
      const headers = new Headers(init?.headers);
      if (info.headerName && info.headerValue && !isNoCors) {
        headers.set(info.headerName, info.headerValue);
      }
      if (previewToken && !headers.has('x-gtm-server-preview')) {
        headers.set('x-gtm-server-preview', previewToken);
      }

      let reqBody = init?.body;
      if (typeof reqBody === 'string' && this.piiRedactor.isEnabled()) {
        const cType = headers.get('content-type') || '';
        reqBody = this.piiRedactor.redactBody(reqBody, cType);
      }

      const modifiedInit: RequestInit = {
        ...init,
        body: reqBody,
        headers,
        mode: isNoCors ? 'cors' : (init?.mode ?? 'cors'),
      };

      return originalFetch(proxyUrl, modifiedInit);
    };

    // Preserve any static properties on fetch (e.g. Bun preconnect)
    Object.assign(patchedFetch, originalFetch);
    window.fetch = patchedFetch as typeof window.fetch;
  }

  /**
   * Patch XMLHttpRequest
   */
  private patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const originalOpen = this.originalXhrOpen;
    const originalSend = this.originalXhrSend;
    const matcher = this.matcher;
    const piiRedactor = this.piiRedactor;
    const isBot = () => this.isBotDetected;
    const getPreviewToken = () => this.options.serverPreviewToken || this.detectPreviewToken();

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null
    ): void {
      const targetUrl = url.toString();

      if (matcher.shouldProxy(targetUrl)) {
        if (isBot()) {
          matcher.log('Suppressed XHR for automated bot:', targetUrl);
          this.__tatvicMeta = {
            isProxied: false,
            isBypassedBot: true,
            originalUrl: targetUrl,
          };
          // Don't issue actual network call; assign dummy data URI
          return originalOpen.call(this, method, 'data:application/json,{}', async, username, password);
        }

        matcher.log('Intercepted XHR:', targetUrl);
        const info = matcher.getProxiedRequestInfo(targetUrl);
        let proxyUrl = info.proxyUrl;
        if (piiRedactor.isEnabled()) {
          proxyUrl = piiRedactor.redactUrl(proxyUrl);
        }
        const previewToken = getPreviewToken();

        this.__tatvicMeta = {
          isProxied: true,
          originalUrl: targetUrl,
          headerName: info.headerName,
          headerValue: info.headerValue,
          previewToken,
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
      if (this.__tatvicMeta?.isBypassedBot) {
        matcher.log('Bypassed XHR send for automated bot');
        try {
          Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
          Object.defineProperty(this, 'status', { value: 204, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'No Content (Bot Bypassed)', configurable: true });
          this.dispatchEvent(new Event('readystatechange'));
          this.dispatchEvent(new Event('load'));
          this.dispatchEvent(new Event('loadend'));
        } catch {}
        return;
      }

      if (this.__tatvicMeta?.isProxied) {
        const { headerName, headerValue, previewToken } = this.__tatvicMeta;
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
      }

      let sendBody = body;
      if (typeof sendBody === 'string' && piiRedactor.isEnabled()) {
        sendBody = piiRedactor.redactBody(sendBody);
      }
      return originalSend.call(this, sendBody);
    };
  }

  /**
   * Patch navigator.sendBeacon
   */
  private patchSendBeacon(): void {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;

    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const originalSendBeacon = this.originalSendBeacon;
    const matcher = this.matcher;
    const isBot = () => this.isBotDetected;
    const polyfillWithKeepalive = this.options.polyfillBeaconWithKeepalive !== false;

    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      const targetUrl = url.toString();

      if (!matcher.shouldProxy(targetUrl)) {
        return originalSendBeacon(url, data);
      }

      if (isBot()) {
        matcher.log('Suppressed sendBeacon for automated bot:', targetUrl);
        return true;
      }

      matcher.log('Intercepted sendBeacon:', targetUrl);

      let beaconData = data;
      if (typeof beaconData === 'string' && this.piiRedactor.isEnabled()) {
        beaconData = this.piiRedactor.redactBody(beaconData);
      }

      // Preferred: fetch with keepalive: true (supports custom proxy headers)
      if (polyfillWithKeepalive && typeof window.fetch === 'function') {
        const info = matcher.getProxiedRequestInfo(targetUrl);
        let proxyUrl = info.proxyUrl;
        if (this.piiRedactor.isEnabled()) {
          proxyUrl = this.piiRedactor.redactUrl(proxyUrl);
        }
        const previewToken = this.options.serverPreviewToken || this.detectPreviewToken();
        const headers = new Headers();
        if (info.headerName && info.headerValue) {
          headers.set(info.headerName, info.headerValue);
        }
        if (previewToken) {
          headers.set('x-gtm-server-preview', previewToken);
        }

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
        } catch {
          // Fall through to standard sendBeacon using query param routing
        }
      }

      // Fallback: sendBeacon with target in query parameter
      const queryInfo = matcher.getProxiedRequestInfo(targetUrl, 'query');
      let fallbackUrl = queryInfo.proxyUrl;
      if (this.piiRedactor.isEnabled()) {
        fallbackUrl = this.piiRedactor.redactUrl(fallbackUrl);
      }
      const previewToken = this.options.serverPreviewToken || this.detectPreviewToken();
      if (previewToken) {
        fallbackUrl += (fallbackUrl.includes('?') ? '&' : '?') + '_gtm_server_preview=' + encodeURIComponent(previewToken);
      }
      return originalSendBeacon(fallbackUrl, beaconData);
    };
  }

  /**
   * Patch HTMLScriptElement.prototype.src for dynamically injected scripts (GTM, pixels)
   */
  private patchScriptElements(): void {
    if (typeof HTMLScriptElement === 'undefined') return;

    const desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (!desc || !desc.set || !desc.get) return;

    this.originalScriptSrcDesc = desc;
    const matcher = this.matcher;
    const originalSet = desc.set;
    const originalGet = desc.get;
    const isBot = () => this.isBotDetected;

    Object.defineProperty(HTMLScriptElement.prototype, 'src', {
      set(this: HTMLScriptElement, val: string) {
        if (isBot()) {
          const isGtm =
            typeof val === 'string' &&
            (val.includes('googletagmanager.com') ||
              val.includes('/_tatvic/gtm.js') ||
              val.includes('/_tatvic/loader.js'));
          if (isGtm || matcher.shouldProxy(val)) {
            matcher.log('Suppressed dynamic script element for automated bot:', val);
            return originalSet.call(this, 'data:text/javascript,/*[Tatvic] Bot bypassed*/');
          }
        }

        if (
          typeof val === 'string' &&
          (val.includes('googletagmanager.com/gtm.js') || val.includes('/_tatvic/gtm.js') || val.includes('/_tatvic/loader.js'))
        ) {
          try {
            const pageSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
            const pageParams = new URLSearchParams(pageSearch);
            const targetUrl = new URL(val, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

            const containerId =
              targetUrl.searchParams.get('cid') ||
              targetUrl.searchParams.get('container') ||
              targetUrl.searchParams.get('tag') ||
              targetUrl.searchParams.get('id') ||
              'GTM-T32XGF8F';

            const morphedParams = new URLSearchParams();
            // Use stealth param 'cid' to evade EasyPrivacy's '.js?id=GTM-' and '/gtm.js' rules
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
            matcher.log('Morphed GTM script element to stealth loader:', val, '->', morphedUrl);
            return originalSet.call(this, morphedUrl);
          } catch {
            // Fallback to standard proxying
          }
        }

        if (matcher.shouldProxy(val)) {
          const info = matcher.getProxiedRequestInfo(val, 'query');
          matcher.log('Intercepted dynamic script element:', val, '->', info.proxyUrl);
          return originalSet.call(this, info.proxyUrl);
        }
        return originalSet.call(this, val);
      },
      get(this: HTMLScriptElement) {
        return originalGet.call(this);
      },
      configurable: true,
      enumerable: true,
    });
  }

  /**
   * Patch HTMLImageElement.prototype.src for tracking pixels (<img src="...">)
   */
  private patchImageElements(): void {
    if (typeof HTMLImageElement === 'undefined') return;

    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!desc || !desc.set || !desc.get) return;

    this.originalImageSrcDesc = desc;
    const matcher = this.matcher;
    const originalSet = desc.set;
    const originalGet = desc.get;
    const isBot = () => this.isBotDetected;

    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set(this: HTMLImageElement, val: string) {
        if (isBot() && matcher.shouldProxy(val)) {
          matcher.log('Suppressed tracking pixel image for automated bot:', val);
          return originalSet.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }

        if (matcher.shouldProxy(val)) {
          const info = matcher.getProxiedRequestInfo(val, 'query');
          matcher.log('Intercepted tracking pixel image:', val, '->', info.proxyUrl);
          return originalSet.call(this, info.proxyUrl);
        }
        return originalSet.call(this, val);
      },
      get(this: HTMLImageElement) {
        return originalGet.call(this);
      },
      configurable: true,
      enumerable: true,
    });
  }

  /**
   * Helper to detect active Server-Side GTM Preview & Debug tokens from current URL.
   */
  private detectPreviewToken(): string | undefined {
    if (typeof window === 'undefined' || !window.location) return undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('gtm_server_preview') || undefined;
    } catch {
      return undefined;
    }
  }
}

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
  private originalDataLayerDesc?: PropertyDescriptor;
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
    this.patchDataLayer();

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

    const dataLayerKey = this.options.dataLayerName || 'dataLayer';
    if (this.originalDataLayerDesc && typeof window !== 'undefined') {
      try {
        Object.defineProperty(window, dataLayerKey, this.originalDataLayerDesc);
      } catch {}
      this.originalDataLayerDesc = undefined;
    }
    if (typeof window !== 'undefined' && (window as any)[dataLayerKey]) {
      try {
        delete (window as any)[dataLayerKey].push;
      } catch {}
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
      const previewToken = this.options.serverPreviewToken || this.detectPreviewToken();

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

      if (this.piiRedactor.isEnabled()) {
        proxyUrl = this.piiRedactor.redactUrl(proxyUrl);
      }

      // Handle Request object input vs (url, init)
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
      if (headerName && headerValue && !isNoCors) {
        headers.set(headerName, headerValue);
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

      const parsed = matcher.parseUrl(targetUrl);
      const isAlreadyProxy =
        parsed &&
        typeof window !== 'undefined' &&
        window.location?.origin &&
        parsed.origin === window.location.origin &&
        parsed.pathname.startsWith(matcher.getProxyEndpoint());

      if (matcher.shouldProxy(targetUrl) || isAlreadyProxy) {
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

        if (piiRedactor.isEnabled()) {
          proxyUrl = piiRedactor.redactUrl(proxyUrl);
        }
        const previewToken = getPreviewToken();

        this.__tatvicMeta = {
          isProxied: true,
          originalUrl: targetUrl,
          headerName,
          headerValue,
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

      if (isBot()) {
        matcher.log('Suppressed sendBeacon for automated bot:', targetUrl);
        return true;
      }

      matcher.log('Intercepted sendBeacon:', targetUrl);

      let beaconData = data;
      if (typeof beaconData === 'string' && this.piiRedactor.isEnabled()) {
        beaconData = this.piiRedactor.redactBody(beaconData);
      }

      // If polyfillWithKeepalive is enabled, use fetch with keepalive: true (supports custom proxy headers)
      if (polyfillWithKeepalive && typeof window.fetch === 'function') {
        const info = matcher.getProxiedRequestInfo(targetUrl);
        let proxyUrl = isAlreadyProxy ? matcher.sanitizeUrl(targetUrl) : info.proxyUrl;
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

      let destinationUrl: string;
      if (isAlreadyProxy) {
        destinationUrl = matcher.sanitizeUrl(targetUrl);
      } else {
        const queryInfo = matcher.getProxiedRequestInfo(targetUrl, 'query');
        destinationUrl = queryInfo.proxyUrl;
      }

      if (this.piiRedactor.isEnabled()) {
        destinationUrl = this.piiRedactor.redactUrl(destinationUrl);
      }

      const previewToken = this.options.serverPreviewToken || this.detectPreviewToken();
      if (previewToken && !destinationUrl.includes('_gtm_server_preview=')) {
        destinationUrl += (destinationUrl.includes('?') ? '&' : '?') + '_gtm_server_preview=' + encodeURIComponent(previewToken);
      }

      // Native sendBeacon never triggers a CORS preflight and is never blocked by Chromium/Blink
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
  }

  /**
   * Patch HTMLScriptElement.prototype.src for dynamically injected scripts (GTM, gtag, pixels)
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
          (val.includes('googletagmanager.com/gtm.js') ||
            val.includes('googletagmanager.com/gtag/js') ||
            val.includes('/gtag/js') ||
            val.includes('/_tatvic/gtm.js') ||
            val.includes('/_tatvic/loader.js'))
        ) {
          try {
            const pageSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
            const pageParams = new URLSearchParams(pageSearch);
            const targetUrl = new URL(val, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');

            const isGtag = val.includes('/gtag/js');
            const containerId =
              targetUrl.searchParams.get('cid') ||
              targetUrl.searchParams.get('container') ||
              targetUrl.searchParams.get('tag') ||
              targetUrl.searchParams.get('id') ||
              (isGtag ? 'G-VVBCZC9JSW' : 'GTM-T32XGF8F');

            const morphedParams = new URLSearchParams();
            // Use stealth param 'cid' to evade EasyPrivacy's '.js?id=GTM-' rule
            morphedParams.set('cid', containerId);
            if (isGtag) {
              morphedParams.set('_type', 'gtag');
            }

            // Copy other query parameters, aliasing any that trigger EasyPrivacy rules
            targetUrl.searchParams.forEach((v, k) => {
              if (k === 'id' || k === 'cid' || k === 'container' || k === 'tag') return;
              if (k === 'cx') {
                morphedParams.set('_cx', v);
              } else if (k === 'gtm') {
                morphedParams.set('_gtm', v);
              } else if (k === 'tag_exp') {
                morphedParams.set('_tag_exp', v);
              } else if (k === 'l' && (v === 'dataLayer' || v.includes('Layer'))) {
                morphedParams.set('_l', v);
              } else {
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
            matcher.log('Morphed script element to stealth loader:', val, '->', morphedUrl);
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
   * Patches window.dataLayer to automatically redact Personally Identifiable Information (PII)
   * such as email addresses and phone numbers from all pushed objects and variables.
   */
  private patchDataLayer(): void {
    if (typeof window === 'undefined' || !this.piiRedactor.isEnabled()) {
      return;
    }

    const dataLayerKey = this.options.dataLayerName || 'dataLayer';
    const piiRedactor = this.piiRedactor;
    const matcher = this.matcher;

    try {
      this.originalDataLayerDesc = Object.getOwnPropertyDescriptor(window, dataLayerKey);
    } catch {}

    const patchArrayPush = (arr: any[]) => {
      if (!arr || typeof arr !== 'object') return;

      // 1. Redact any existing elements currently in dataLayer
      for (let i = 0; i < arr.length; i++) {
        arr[i] = piiRedactor.redactJsonObject(arr[i]);
      }

      // 2. Intercept arr.push via property getter/setter so subsequent assignments (by GTM or user) are preserved
      // Uses a recursion guard (isSanitizing) so GTM internal push re-delegation never triggers a call stack overflow
      let targetPush = typeof arr.push === 'function' ? arr.push.bind(arr) : Array.prototype.push.bind(arr);
      let isSanitizing = false;

      const wrapPush = (fn: Function) => {
        return function (this: any, ...args: any[]) {
          if (!isSanitizing) {
            isSanitizing = true;
            try {
              for (let i = 0; i < args.length; i++) {
                args[i] = piiRedactor.redactJsonObject(args[i]);
              }
              matcher.log(`Sanitized ${dataLayerKey}.push:`, args);
            } finally {
              isSanitizing = false;
            }
          }
          return fn.apply(this === arr ? arr : this, args);
        };
      };

      try {
        Object.defineProperty(arr, 'push', {
          get() {
            return wrapPush(targetPush);
          },
          set(newPushFn: any) {
            targetPush = typeof newPushFn === 'function' ? newPushFn : targetPush;
          },
          configurable: true,
          enumerable: false,
        });
      } catch {
        // Fallback to direct method wrapper
        const prevPush = arr.push;
        arr.push = wrapPush(prevPush);
      }
    };

    let _dataLayer: any = (window as any)[dataLayerKey];
    if (Array.isArray(_dataLayer)) {
      patchArrayPush(_dataLayer);
    } else if (_dataLayer === undefined) {
      _dataLayer = [];
      patchArrayPush(_dataLayer);
    }

    try {
      Object.defineProperty(window, dataLayerKey, {
        get() {
          return _dataLayer;
        },
        set(newVal: any) {
          if (Array.isArray(newVal)) {
            patchArrayPush(newVal);
          }
          _dataLayer = newVal;
        },
        configurable: true,
        enumerable: true,
      });
    } catch {
      (window as any)[dataLayerKey] = _dataLayer;
    }

    matcher.log(`First-party dataLayer PII protection active on window.${dataLayerKey}`);
  }

  /**
   * Helper to detect active Server-Side GTM Preview & Debug tokens from current URL,
   * sessionStorage, cookies, or wrapper configuration.
   */
  private detectPreviewToken(): string | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
      // 1. Check window.__TATVIC_PREVIEW_TOKEN set by wrapper element
      if ((window as any).__TATVIC_PREVIEW_TOKEN) {
        return (window as any).__TATVIC_PREVIEW_TOKEN;
      }

      // 2. Check URL search parameters
      if (window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const token =
          params.get('gtm_server_preview') ||
          params.get('_gtm_server_preview') ||
          params.get('server_preview') ||
          params.get('gtm_preview');
        if (token) {
          try {
            sessionStorage.setItem('_tatvic_preview_token', token);
          } catch {}
          return token;
        }
      }

      // 3. Check sessionStorage (persists across page navigations in preview session)
      try {
        const saved = sessionStorage.getItem('_tatvic_preview_token');
        if (saved) return saved;
      } catch {}

      // 4. Check document.cookie for GTM preview cookies
      if (typeof document !== 'undefined' && document.cookie) {
        const match = document.cookie.match(/(?:^|;\s*)(?:_gtm_server_preview|gtm_server_preview)=([^;]+)/);
        if (match && match[1]) return decodeURIComponent(match[1]);
      }

      return undefined;
    } catch {
      return undefined;
    }
  }
}

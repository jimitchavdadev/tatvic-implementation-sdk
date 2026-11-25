/**
 * ============================================================================
 * TATVIC FIRST-PARTY RELAY & AD BLOCKER INTERCEPTOR (GTM CJS TEMPLATE)
 * ============================================================================
 *
 * HOW TO USE IN GOOGLE TAG MANAGER (GTM):
 * ----------------------------------------------------------------------------
 * OPTION 1: Custom HTML Tag (Recommended - Fires Earliest)
 *   1. In GTM, go to Tags -> New -> Tag Type: "Custom HTML".
 *   2. Wrap this code in <script>...</script> tags and paste it into the editor:
 *        <script>
 *          // Paste this entire file contents here
 *        </script>
 *   3. Under Triggering, select: "Consent Initialization - All Pages"
 *      (or "Initialization - All Pages").
 *   4. Save and Publish / Preview.
 *
 * OPTION 2: Custom JavaScript (CJS) Variable
 *   1. In GTM, go to Variables -> User-Defined Variables -> New.
 *   2. Select Variable Type: "Custom JavaScript".
 *   3. Paste this entire function directly into the variable editor.
 *   4. Name the variable: "CJS - Tatvic First Party Interceptor".
 *   5. In your Google Tag / GA4 Config Tag (or any tag fired on Initialization),
 *      add a field or trigger that references {{CJS - Tatvic First Party Interceptor}}.
 *      The function automatically installs the interceptor on window and returns true.
 * ============================================================================
 */

function tatvicFirstPartyInterceptor() {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONFIGURATION (Customize for your website)
  // --------------------------------------------------------------------------
  var CONFIG = {
    // Relative or absolute URL of your first-party proxy relay
    // Default: '/_tatvic/relay' or 'https://yourdomain.com/_tatvic/relay'
    proxyEndpoint: '/_tatvic/relay',

    // Header sent to the proxy containing the original upstream target URL
    headerName: 'x-tatvic-target',

    // Server-Side GTM Preview Header Token (optional, for sGTM preview mode)
    // If you are debugging in sGTM, paste your X-Gtm-Server-Preview header token here:
    // e.g. 'ZW52LTd8a2RuTVd2blg4aVJsUkR3cmdGcHBPUXwxYTFhYjllMDdlNWIxNTI3ODQ3NDY='
    serverPreviewToken: '',

    // Automatically inject GA4 debug flags (_dbg=1, ep.debug_mode=true) when preview is active
    autoDebugFlags: true,

    // Enable verbose console logging for debugging
    debug: false,

    // Additional tracking domains you want to route through the first-party proxy
    customTargetDomains: [
      // 'custom-pixel.example.com',
      // 'telemetry.partner.com'
    ],

    // Sensitive domains that must NEVER be intercepted (payments, auth, core cloud)
    customExcludeDomains: []
  };

  // --------------------------------------------------------------------------
  // 2. IDEMPOTENCY GUARD (Ensure interceptor installs only once)
  // --------------------------------------------------------------------------
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.__tatvic_gtm_interceptor_installed) {
    if (CONFIG.debug) {
      console.log('[Tatvic CJS] Interceptor already installed. Skipping.');
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // 3. TARGET & EXCLUDE DOMAIN LISTS
  // --------------------------------------------------------------------------
  var DEFAULT_TARGET_DOMAINS = [
    // Google Analytics & Google Tag Manager
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com',
    'stats.g.doubleclick.net',
    'googleadservices.com',
    'googleads.g.doubleclick.net',
    'pagead2.googlesyndication.com',
    'doubleclick.net',

    // Server-Side GTM Providers (Stape, Cloud Run, App Engine)
    'stape.io',
    'stape.net',
    'a.run.app',
    'appspot.com',

    // Meta / Facebook Pixel
    'connect.facebook.net',
    'facebook.com',
    'graph.facebook.com',
    'facebook.net',

    // Microsoft Clarity & Bing Ads
    'clarity.ms',
    'c.bing.com',
    'bat.bing.com',

    // TikTok Pixel
    'analytics.tiktok.com',
    'tiktok.com',

    // Hotjar
    'static.hotjar.com',
    'script.hotjar.com',
    'in.hotjar.com',

    // Twitter / X Ads
    'static.ads-twitter.com',
    'ads-twitter.com',

    // LinkedIn Insight Tag
    'snap.licdn.com',
    'px.ads.linkedin.com',

    // Pinterest Tag
    'ct.pinterest.com',
    'pintrk.com',

    // Snapchat Pixel
    'sc-static.net',
    'tr.snapchat.com',

    // Criteo
    'static.criteo.net',
    'sslwidget.criteo.com',

    // Product Analytics & CDPs
    'segment.io',
    'api.segment.io',
    'cdn.segment.com',
    'mixpanel.com',
    'api-js.mixpanel.com',
    'amplitude.com',
    'api.amplitude.com',
    'heapanalytics.com',
    'cdn.heapanalytics.com',
    'posthog.com'
  ];

  var DEFAULT_EXCLUDE_DOMAINS = [
    // Payment Gateways
    'api.stripe.com',
    'js.stripe.com',
    'm.stripe.network',
    'paypal.com',
    'sandbox.paypal.com',
    'razorpay.com',
    'checkout.razorpay.com',
    'square.com',
    'squareup.com',

    // Auth & Identity
    'auth0.com',
    'clerk.dev',
    'clerk.com',
    'supabase.co',
    'firebaseio.com',
    'accounts.google.com',
    'appleid.apple.com',

    // Core Cloud & CDNs
    'amazonaws.com',
    'googleapis.com',
    'cloudflare.com',
    'tagassistant.google.com' // Preserve Tag Assistant preview handshake
  ];

  var allTargetDomains = DEFAULT_TARGET_DOMAINS.concat(CONFIG.customTargetDomains || []);
  var allExcludeDomains = DEFAULT_EXCLUDE_DOMAINS.concat(CONFIG.customExcludeDomains || []);

  // --------------------------------------------------------------------------
  // 4. HELPER UTILITIES
  // --------------------------------------------------------------------------
  function log() {
    if (CONFIG.debug && typeof console !== 'undefined' && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[Tatvic CJS]');
      console.log.apply(console, args);
    }
  }

  function detectPreviewToken() {
    if (CONFIG.serverPreviewToken) {
      return CONFIG.serverPreviewToken;
    }
    try {
      if (window.location && window.location.search) {
        var params = new URLSearchParams(window.location.search);
        var token = params.get('gtm_server_preview') || params.get('x-gtm-server-preview');
        if (token) return token;
      }
      if (typeof sessionStorage !== 'undefined') {
        var stored = sessionStorage.getItem('__tatvic_server_preview');
        if (stored) return stored;
      }
    } catch (e) {}
    return '';
  }

  var activePreviewToken = detectPreviewToken();
  if (activePreviewToken && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem('__tatvic_server_preview', activePreviewToken);
    } catch (e) {}
  }

  function isDomainMatch(hostname, pattern) {
    if (!hostname || !pattern) return false;
    hostname = hostname.toLowerCase();
    pattern = pattern.toLowerCase();
    if (hostname === pattern) return true;
    if (hostname.endsWith('.' + pattern)) return true;
    return false;
  }

  function shouldProxy(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;

    // Do not proxy if already pointing to the proxy endpoint
    if (urlStr.indexOf(CONFIG.proxyEndpoint) !== -1 || urlStr.indexOf('/_tatvic/') !== -1) {
      return false;
    }

    try {
      var parsed = new URL(urlStr, window.location.origin);

      // Do not proxy same-origin assets (unless explicitly target domain)
      if (parsed.origin === window.location.origin) {
        return false;
      }

      var host = parsed.hostname;

      // Check exclude domains first
      for (var i = 0; i < allExcludeDomains.length; i++) {
        if (isDomainMatch(host, allExcludeDomains[i])) {
          return false;
        }
      }

      // Check target domains
      for (var j = 0; j < allTargetDomains.length; j++) {
        if (isDomainMatch(host, allTargetDomains[j])) {
          return true;
        }
      }
    } catch (e) {
      return false;
    }

    return false;
  }

  function getProxiedUrl(targetUrlStr) {
    // Append _tgt query parameter to preserve target URL safely across all browser transport modes
    var sep = CONFIG.proxyEndpoint.indexOf('?') === -1 ? '?' : '&';
    return CONFIG.proxyEndpoint + sep + '_tgt=' + encodeURIComponent(targetUrlStr);
  }

  // --------------------------------------------------------------------------
  // 5. INTERCEPT WINDOW.FETCH
  // --------------------------------------------------------------------------
  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;

    window.fetch = function(input, init) {
      var targetUrl;
      if (typeof input === 'string') {
        targetUrl = input;
      } else if (input && typeof input.url === 'string') {
        targetUrl = input.url;
      } else {
        targetUrl = String(input);
      }

      if (!shouldProxy(targetUrl)) {
        return originalFetch.apply(this, arguments);
      }

      log('Intercepted fetch:', targetUrl);
      var isNoCors = (init && init.mode === 'no-cors') || (input && input.mode === 'no-cors');
      var proxyUrl = getProxiedUrl(targetUrl);

      // Handle Request object input
      if (typeof Request !== 'undefined' && input instanceof Request) {
        var headers = new Headers(input.headers);
        if (init && init.headers) {
          new Headers(init.headers).forEach(function(val, key) {
            headers.set(key, val);
          });
        }
        if (!isNoCors) {
          headers.set(CONFIG.headerName, targetUrl);
        }
        if (activePreviewToken && !headers.has('x-gtm-server-preview')) {
          headers.set('x-gtm-server-preview', activePreviewToken);
        }

        var proxiedRequest = new Request(proxyUrl, {
          method: (init && init.method) || input.method,
          headers: headers,
          body: (init && init.body !== undefined) ? init.body : input.body,
          mode: isNoCors ? 'cors' : ((init && init.mode) || input.mode || 'cors'),
          credentials: (init && init.credentials) || input.credentials || 'include',
          cache: (init && init.cache) || input.cache,
          redirect: (init && init.redirect) || input.redirect,
          referrer: (init && init.referrer) || input.referrer,
          integrity: (init && init.integrity) || input.integrity,
          keepalive: (init && init.keepalive !== undefined) ? init.keepalive : input.keepalive,
          signal: (init && init.signal) || input.signal
        });

        return originalFetch.call(this, proxiedRequest);
      }

      // Handle URL string input
      var requestHeaders = new Headers(init && init.headers);
      if (!isNoCors) {
        requestHeaders.set(CONFIG.headerName, targetUrl);
      }
      if (activePreviewToken && !requestHeaders.has('x-gtm-server-preview')) {
        requestHeaders.set('x-gtm-server-preview', activePreviewToken);
      }

      var modifiedInit = Object.assign({}, init, {
        headers: requestHeaders,
        mode: isNoCors ? 'cors' : ((init && init.mode) || 'cors'),
        credentials: (init && init.credentials) || 'include'
      });

      return originalFetch.call(this, proxyUrl, modifiedInit);
    };

    // Preserve static methods on fetch
    Object.assign(window.fetch, originalFetch);
  }

  // --------------------------------------------------------------------------
  // 6. INTERCEPT XMLHTTPREQUEST
  // --------------------------------------------------------------------------
  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      var targetUrl = String(url);
      if (shouldProxy(targetUrl)) {
        log('Intercepted XHR:', targetUrl);
        this.__tatvic_is_proxied = true;
        this.__tatvic_target_url = targetUrl;
        var proxyUrl = getProxiedUrl(targetUrl);
        return originalOpen.call(this, method, proxyUrl, async !== false, user, password);
      }

      this.__tatvic_is_proxied = false;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      if (this.__tatvic_is_proxied) {
        try {
          this.setRequestHeader(CONFIG.headerName, this.__tatvic_target_url);
          if (activePreviewToken) {
            this.setRequestHeader('x-gtm-server-preview', activePreviewToken);
          }
        } catch (e) {
          log('XHR setRequestHeader failed:', e);
        }
      }
      return originalSend.apply(this, arguments);
    };
  }

  // --------------------------------------------------------------------------
  // 7. INTERCEPT NAVIGATOR.SENDBEACON
  // --------------------------------------------------------------------------
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    var originalSendBeacon = navigator.sendBeacon.bind(navigator);

    navigator.sendBeacon = function(url, data) {
      var targetUrl = String(url);
      if (!shouldProxy(targetUrl)) {
        return originalSendBeacon(url, data);
      }

      log('Intercepted sendBeacon:', targetUrl);
      var proxyUrl = getProxiedUrl(targetUrl);

      // Prefer fetch with keepalive: true (preserves custom headers and POST body)
      if (typeof window.fetch === 'function') {
        var headers = new Headers();
        headers.set(CONFIG.headerName, targetUrl);
        if (activePreviewToken) {
          headers.set('x-gtm-server-preview', activePreviewToken);
        }

        try {
          window.fetch(proxyUrl, {
            method: 'POST',
            body: data,
            headers: headers,
            keepalive: true,
            mode: 'cors',
            credentials: 'include'
          }).catch(function(err) {
            log('Async keepalive beacon fetch warning:', err);
          });
          return true;
        } catch (e) {
          // Fall through to query-param based sendBeacon fallback
        }
      }

      // Fallback to native sendBeacon with _tgt in URL
      return originalSendBeacon(proxyUrl, data);
    };
  }

  // --------------------------------------------------------------------------
  // 8. INTERCEPT DYNAMIC SCRIPTS (HTMLScriptElement.prototype.src)
  // --------------------------------------------------------------------------
  if (typeof HTMLScriptElement !== 'undefined') {
    var scriptSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (scriptSrcDesc && scriptSrcDesc.set && scriptSrcDesc.get) {
      var originalScriptSet = scriptSrcDesc.set;
      var originalScriptGet = scriptSrcDesc.get;

      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string') {
            // A. Detect Google Tag Manager container loading
            if (val.indexOf('googletagmanager.com/gtm.js') !== -1 || val.indexOf('/_tatvic/gtm.js') !== -1) {
              try {
                var targetUrl = new URL(val, window.location.origin);
                var containerId = targetUrl.searchParams.get('cid') ||
                                  targetUrl.searchParams.get('container') ||
                                  targetUrl.searchParams.get('tag') ||
                                  targetUrl.searchParams.get('id') ||
                                  'GTM-T32XGF8F';

                var morphedParams = new URLSearchParams();
                // Use stealth param 'cid' to bypass EasyPrivacy '.js?id=GTM-' and '/gtm.js' rules
                morphedParams.set('cid', containerId);

                targetUrl.searchParams.forEach(function(v, k) {
                  if (k !== 'id' && k !== 'cid' && k !== 'container' && k !== 'tag') {
                    morphedParams.set(k, v);
                  }
                });

                // Preserve Tag Assistant preview flags (gtm_debug, gtm_auth, gtm_preview)
                if (window.location && window.location.search) {
                  var pageParams = new URLSearchParams(window.location.search);
                  var previewFlags = ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win'];
                  for (var i = 0; i < previewFlags.length; i++) {
                    var flag = previewFlags[i];
                    if (pageParams.has(flag) && !morphedParams.has(flag)) {
                      morphedParams.set(flag, pageParams.get(flag));
                    }
                  }
                }

                var stealthLoaderUrl = '/_tatvic/loader.js?' + morphedParams.toString();
                log('Morphed GTM script src:', val, '->', stealthLoaderUrl);
                return originalScriptSet.call(this, stealthLoaderUrl);
              } catch (e) {
                // Fall through
              }
            }

            // B. Generic third-party tracking scripts
            if (shouldProxy(val)) {
              var proxiedScript = getProxiedUrl(val);
              log('Intercepted dynamic script element:', val, '->', proxiedScript);
              return originalScriptSet.call(this, proxiedScript);
            }
          }
          return originalScriptSet.call(this, val);
        },
        get: function() {
          return originalScriptGet.call(this);
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  // --------------------------------------------------------------------------
  // 9. INTERCEPT TRACKING PIXELS (HTMLImageElement.prototype.src)
  // --------------------------------------------------------------------------
  if (typeof HTMLImageElement !== 'undefined') {
    var imageSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (imageSrcDesc && imageSrcDesc.set && imageSrcDesc.get) {
      var originalImageSet = imageSrcDesc.set;
      var originalImageGet = imageSrcDesc.get;

      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && shouldProxy(val)) {
            var proxiedImg = getProxiedUrl(val);
            log('Intercepted pixel image element:', val, '->', proxiedImg);
            return originalImageSet.call(this, proxiedImg);
          }
          return originalImageSet.call(this, val);
        },
        get: function() {
          return originalImageGet.call(this);
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  // Mark as successfully installed
  window.__tatvic_gtm_interceptor_installed = true;
  log('Tatvic First-Party Interceptor successfully initialized via GTM.');

  // Invoke GTM Tag Template success callback if running within a GTM Custom Tag Template
  if (typeof data !== 'undefined' && data && typeof data.gtmOnSuccess === 'function') {
    data.gtmOnSuccess();
  }

  return true;
}

// Top-level fallback for GTM Tag Template static validator
if (typeof data !== 'undefined' && data && typeof data.gtmOnSuccess === 'function') {
  try {
    tatvicFirstPartyInterceptor();
  } catch (e) {
    if (typeof data.gtmOnFailure === 'function') {
      data.gtmOnFailure();
    }
  }
}

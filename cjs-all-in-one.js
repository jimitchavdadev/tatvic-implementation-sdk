function() {
  'use strict';

  var TARGET_CONTAINER_ID = 'GTM-T32XGF8F';
  var PROXY_ENDPOINT = '/_tatvic/relay';
  var HEADER_NAME = 'x-tatvic-target';
  var SERVER_PREVIEW_TOKEN = '';
  var DEBUG = true;

  if (typeof window === 'undefined') return false;
  if (window.__tatvic_all_in_one_installed) return true;

  function log() {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[Tatvic CJS]');
      console.log.apply(console, args);
    }
  }

  // --------------------------------------------------------------------------
  // 1. OVERWRITE & INJECT GTM-T32XGF8F
  // --------------------------------------------------------------------------
  if (typeof document !== 'undefined') {
    // A. Remove any competing GTM containers
    var existingScripts = document.querySelectorAll('script[src*="gtm.js"]');
    for (var i = 0; i < existingScripts.length; i++) {
      var s = existingScripts[i];
      var src = s.getAttribute('src');
      if (src && src.indexOf(TARGET_CONTAINER_ID) === -1) {
        log('Removing competing GTM script:', src);
        if (s.parentNode) s.parentNode.removeChild(s);
      }
    }

    // B. Initialize dataLayer & gtag
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    // C. Inject target container if not already in DOM
    var inDOM = document.querySelector('script[src*="' + TARGET_CONTAINER_ID + '"]');
    if (!inDOM) {
      var pageParams = new URLSearchParams(window.location.search);
      var gtmDebug = pageParams.get('gtm_debug');
      var targetUrl = 'https://www.googletagmanager.com/gtm.js?id=' + TARGET_CONTAINER_ID + (gtmDebug ? '&gtm_debug=' + gtmDebug : '');
      log('Injecting target container GTM-T32XGF8F:', targetUrl);
      var gtmScript = document.createElement('script');
      gtmScript.async = true;
      gtmScript.src = targetUrl;
      document.head.appendChild(gtmScript);
    }
  }

  // --------------------------------------------------------------------------
  // 2. FIRST-PARTY RELAY INTERCEPTOR (Fetch, XHR, sendBeacon, Script .src)
  // --------------------------------------------------------------------------
  var TARGET_DOMAINS = [
    'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
    'stats.g.doubleclick.net', 'googleadservices.com', 'doubleclick.net',
    'stape.io', 'stape.net', 'connect.facebook.net', 'clarity.ms', 'bat.bing.com'
  ];

  var EXCLUDE_DOMAINS = [
    'api.stripe.com', 'paypal.com', 'razorpay.com', 'square.com',
    'auth0.com', 'clerk.dev', 'supabase.co', 'tagassistant.google.com'
  ];

  function isMatch(host, pattern) {
    if (!host || !pattern) return false;
    host = host.toLowerCase(); pattern = pattern.toLowerCase();
    return host === pattern || host.endsWith('.' + pattern);
  }

  function shouldProxy(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    if (urlStr.indexOf(PROXY_ENDPOINT) !== -1 || urlStr.indexOf('/_tatvic/') !== -1) return false;
    try {
      var p = new URL(urlStr, window.location.origin);
      if (p.origin === window.location.origin) return false;
      for (var i = 0; i < EXCLUDE_DOMAINS.length; i++) {
        if (isMatch(p.hostname, EXCLUDE_DOMAINS[i])) return false;
      }
      for (var j = 0; j < TARGET_DOMAINS.length; j++) {
        if (isMatch(p.hostname, TARGET_DOMAINS[j])) return true;
      }
    } catch (e) {}
    return false;
  }

  function getProxiedUrl(targetUrlStr) {
    var sep = PROXY_ENDPOINT.indexOf('?') === -1 ? '?' : '&';
    return PROXY_ENDPOINT + sep + '_tgt=' + encodeURIComponent(targetUrlStr);
  }

  // Intercept fetch
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      var targetUrl = (typeof input === 'string') ? input : (input && input.url ? input.url : String(input));
      if (!shouldProxy(targetUrl)) return origFetch.apply(this, arguments);

      log('Intercepted fetch:', targetUrl);
      var isNoCors = (init && init.mode === 'no-cors') || (input && input.mode === 'no-cors');
      var proxyUrl = getProxiedUrl(targetUrl);

      if (typeof Request !== 'undefined' && input instanceof Request) {
        var headers = new Headers(input.headers);
        if (init && init.headers) new Headers(init.headers).forEach(function(v, k) { headers.set(k, v); });
        if (!isNoCors) headers.set(HEADER_NAME, targetUrl);
        if (SERVER_PREVIEW_TOKEN) headers.set('x-gtm-server-preview', SERVER_PREVIEW_TOKEN);

        return origFetch.call(this, new Request(proxyUrl, {
          method: (init && init.method) || input.method,
          headers: headers,
          body: (init && init.body !== undefined) ? init.body : input.body,
          mode: isNoCors ? 'cors' : ((init && init.mode) || input.mode || 'cors'),
          credentials: (init && init.credentials) || input.credentials || 'include',
          keepalive: (init && init.keepalive !== undefined) ? init.keepalive : input.keepalive
        }));
      }

      var h = new Headers(init && init.headers);
      if (!isNoCors) h.set(HEADER_NAME, targetUrl);
      if (SERVER_PREVIEW_TOKEN) h.set('x-gtm-server-preview', SERVER_PREVIEW_TOKEN);

      return origFetch.call(this, proxyUrl, Object.assign({}, init, {
        headers: h,
        mode: isNoCors ? 'cors' : ((init && init.mode) || 'cors'),
        credentials: (init && init.credentials) || 'include'
      }));
    };
    Object.assign(window.fetch, origFetch);
  }

  // Intercept XHR
  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, async, user, pass) {
      var t = String(url);
      if (shouldProxy(t)) {
        this.__tatvic_t = t;
        return origOpen.call(this, method, getProxiedUrl(t), async !== false, user, pass);
      }
      this.__tatvic_t = null;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      if (this.__tatvic_t) {
        try {
          this.setRequestHeader(HEADER_NAME, this.__tatvic_t);
          if (SERVER_PREVIEW_TOKEN) this.setRequestHeader('x-gtm-server-preview', SERVER_PREVIEW_TOKEN);
        } catch (e) {}
      }
      return origSend.apply(this, arguments);
    };
  }

  // Intercept sendBeacon
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      var t = String(url);
      if (!shouldProxy(t)) return origBeacon(url, data);
      log('Intercepted sendBeacon:', t);
      if (typeof window.fetch === 'function') {
        var h = new Headers();
        h.set(HEADER_NAME, t);
        if (SERVER_PREVIEW_TOKEN) h.set('x-gtm-server-preview', SERVER_PREVIEW_TOKEN);
        try {
          window.fetch(getProxiedUrl(t), { method: 'POST', body: data, headers: h, keepalive: true, mode: 'cors' }).catch(function(){});
          return true;
        } catch (e) {}
      }
      return origBeacon(getProxiedUrl(t), data);
    };
  }

  // Intercept HTMLScriptElement.src
  if (typeof HTMLScriptElement !== 'undefined') {
    var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (desc && desc.set) {
      var origSet = desc.set;
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && (val.indexOf('googletagmanager.com/gtm.js') !== -1 || val.indexOf('loader.js') !== -1 || val.indexOf('/gtm.js') !== -1)) {
            if (val.indexOf(TARGET_CONTAINER_ID) !== -1) return origSet.call(this, val);
            var pageParams = new URLSearchParams(window.location.search);
            var d = pageParams.get('gtm_debug');
            var targetSrc = 'https://www.googletagmanager.com/gtm.js?id=' + TARGET_CONTAINER_ID + (d ? '&gtm_debug=' + d : '');
            log('Forcing container GTM-T32XGF8F on script:', targetSrc);
            return origSet.call(this, targetSrc);
          }
          if (shouldProxy(val)) return origSet.call(this, getProxiedUrl(val));
          return origSet.call(this, val);
        },
        get: desc.get,
        configurable: true
      });
    }
  }

  window.__tatvic_all_in_one_installed = true;
  log('All-in-one CJS initialized for container:', TARGET_CONTAINER_ID);
  return true;
}

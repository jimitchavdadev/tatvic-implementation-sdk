function() {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONFIGURATION
  // --------------------------------------------------------------------------
  var CONFIG = {
    // Relative or absolute URL of your first-party proxy relay
    proxyEndpoint: '/_tatvic/relay',
    headerName: 'x-tatvic-target',
    serverPreviewToken: '',
    debug: true
  };

  if (typeof window === 'undefined') return false;
  if (window.__tatvic_interceptor_installed) return true;

  // --------------------------------------------------------------------------
  // 2. TARGET & EXCLUDE DOMAIN LISTS
  // --------------------------------------------------------------------------
  var TARGET_DOMAINS = [
    'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
    'stats.g.doubleclick.net', 'googleadservices.com', 'googleads.g.doubleclick.net',
    'pagead2.googlesyndication.com', 'doubleclick.net', 'stape.io', 'stape.net',
    'a.run.app', 'appspot.com', 'connect.facebook.net', 'facebook.com',
    'graph.facebook.com', 'facebook.net', 'clarity.ms', 'c.bing.com', 'bat.bing.com',
    'analytics.tiktok.com', 'tiktok.com', 'static.hotjar.com', 'snap.licdn.com',
    'ct.pinterest.com', 'tr.snapchat.com', 'static.criteo.net', 'segment.io'
  ];

  var EXCLUDE_DOMAINS = [
    'api.stripe.com', 'js.stripe.com', 'paypal.com', 'razorpay.com', 'square.com',
    'auth0.com', 'clerk.dev', 'clerk.com', 'supabase.co', 'accounts.google.com',
    'tagassistant.google.com'
  ];

  function log() {
    if (CONFIG.debug && typeof console !== 'undefined' && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[Tatvic CJS]');
      console.log.apply(console, args);
    }
  }

  function detectPreviewToken() {
    if (CONFIG.serverPreviewToken) return CONFIG.serverPreviewToken;
    try {
      if (window.location && window.location.search) {
        var p = new URLSearchParams(window.location.search);
        var t = p.get('gtm_server_preview') || p.get('x-gtm-server-preview');
        if (t) return t;
      }
      if (typeof sessionStorage !== 'undefined') {
        var s = sessionStorage.getItem('__tatvic_server_preview');
        if (s) return s;
      }
    } catch (e) {}
    return '';
  }

  var activePreviewToken = detectPreviewToken();
  if (activePreviewToken && typeof sessionStorage !== 'undefined') {
    try { sessionStorage.setItem('__tatvic_server_preview', activePreviewToken); } catch (e) {}
  }

  function isMatch(host, pattern) {
    if (!host || !pattern) return false;
    host = host.toLowerCase(); pattern = pattern.toLowerCase();
    return host === pattern || host.endsWith('.' + pattern);
  }

  function shouldProxy(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    if (urlStr.indexOf(CONFIG.proxyEndpoint) !== -1 || urlStr.indexOf('/_tatvic/') !== -1) return false;
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
    var sep = CONFIG.proxyEndpoint.indexOf('?') === -1 ? '?' : '&';
    return CONFIG.proxyEndpoint + sep + '_tgt=' + encodeURIComponent(targetUrlStr);
  }

  // --------------------------------------------------------------------------
  // 3. INTERCEPT FETCH
  // --------------------------------------------------------------------------
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
        if (!isNoCors) headers.set(CONFIG.headerName, targetUrl);
        if (activePreviewToken && !headers.has('x-gtm-server-preview')) {
          headers.set('x-gtm-server-preview', activePreviewToken);
        }

        var req = new Request(proxyUrl, {
          method: (init && init.method) || input.method,
          headers: headers,
          body: (init && init.body !== undefined) ? init.body : input.body,
          mode: isNoCors ? 'cors' : ((init && init.mode) || input.mode || 'cors'),
          credentials: (init && init.credentials) || input.credentials || 'include',
          keepalive: (init && init.keepalive !== undefined) ? init.keepalive : input.keepalive
        });
        return origFetch.call(this, req);
      }

      var h = new Headers(init && init.headers);
      if (!isNoCors) h.set(CONFIG.headerName, targetUrl);
      if (activePreviewToken && !h.has('x-gtm-server-preview')) {
        h.set('x-gtm-server-preview', activePreviewToken);
      }

      return origFetch.call(this, proxyUrl, Object.assign({}, init, {
        headers: h,
        mode: isNoCors ? 'cors' : ((init && init.mode) || 'cors'),
        credentials: (init && init.credentials) || 'include'
      }));
    };
    Object.assign(window.fetch, origFetch);
  }

  // --------------------------------------------------------------------------
  // 4. INTERCEPT XHR
  // --------------------------------------------------------------------------
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
          this.setRequestHeader(CONFIG.headerName, this.__tatvic_t);
          if (activePreviewToken) this.setRequestHeader('x-gtm-server-preview', activePreviewToken);
        } catch (e) {}
      }
      return origSend.apply(this, arguments);
    };
  }

  // --------------------------------------------------------------------------
  // 5. INTERCEPT SENDBEACON
  // --------------------------------------------------------------------------
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url, data) {
      var t = String(url);
      if (!shouldProxy(t)) return origBeacon(url, data);
      log('Intercepted sendBeacon:', t);
      if (typeof window.fetch === 'function') {
        var h = new Headers();
        h.set(CONFIG.headerName, t);
        if (activePreviewToken) h.set('x-gtm-server-preview', activePreviewToken);
        try {
          window.fetch(getProxiedUrl(t), { method: 'POST', body: data, headers: h, keepalive: true, mode: 'cors' }).catch(function(){});
          return true;
        } catch (e) {}
      }
      return origBeacon(getProxiedUrl(t), data);
    };
  }

  // --------------------------------------------------------------------------
  // 6. INTERCEPT DYNAMIC SCRIPTS (Stealth GTM loader)
  // --------------------------------------------------------------------------
  if (typeof HTMLScriptElement !== 'undefined') {
    var sDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (sDesc && sDesc.set) {
      var origSSet = sDesc.set;
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && (val.indexOf('googletagmanager.com/gtm.js') !== -1 || val.indexOf('/_tatvic/gtm.js') !== -1)) {
            try {
              var u = new URL(val, window.location.origin);
              var cid = u.searchParams.get('cid') || u.searchParams.get('id') || 'GTM-T32XGF8F';
              var p = new URLSearchParams(window.location.search);
              var d = p.get('gtm_debug') ? '&gtm_debug=' + p.get('gtm_debug') : '';
              return origSSet.call(this, '/_tatvic/loader.js?cid=' + encodeURIComponent(cid) + d);
            } catch (e) {}
          }
          if (shouldProxy(val)) return origSSet.call(this, getProxiedUrl(val));
          return origSSet.call(this, val);
        },
        get: sDesc.get,
        configurable: true
      });
    }
  }

  window.__tatvic_interceptor_installed = true;
  log('Installed successfully.');
  return true;
}

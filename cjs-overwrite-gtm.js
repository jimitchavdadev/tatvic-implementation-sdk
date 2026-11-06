function() {
  'use strict';

  var TARGET_ID = 'GTM-T32XGF8F';

  if (typeof window === 'undefined') return false;
  if (window.__tatvic_gtm_overwritten) return true;

  // 1. Intercept any future dynamic GTM script injection
  if (typeof HTMLScriptElement !== 'undefined') {
    var desc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (desc && desc.set) {
      var origSet = desc.set;
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && (val.indexOf('googletagmanager.com/gtm.js') !== -1 || val.indexOf('loader.js') !== -1 || val.indexOf('/gtm.js') !== -1)) {
            if (val.indexOf(TARGET_ID) !== -1) return origSet.call(this, val);
            var pageParams = new URLSearchParams(window.location.search);
            var d = pageParams.get('gtm_debug');
            var newUrl = 'https://www.googletagmanager.com/gtm.js?id=' + TARGET_ID + (d ? '&gtm_debug=' + d : '');
            return origSet.call(this, newUrl);
          }
          return origSet.call(this, val);
        },
        get: desc.get,
        configurable: true
      });
    }
  }

  // 2. Remove any other GTM scripts already in DOM
  if (typeof document !== 'undefined') {
    var scripts = document.querySelectorAll('script[src*="gtm.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s.getAttribute('src');
      if (src && src.indexOf(TARGET_ID) === -1) {
        if (s.parentNode) s.parentNode.removeChild(s);
      }
    }

    // 3. Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

    // 4. Inject GTM-T32XGF8F if not already in DOM
    var inDOM = document.querySelector('script[src*="' + TARGET_ID + '"]');
    if (!inDOM) {
      var pageParams = new URLSearchParams(window.location.search);
      var d = pageParams.get('gtm_debug');
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtm.js?id=' + TARGET_ID + (d ? '&gtm_debug=' + d : '');
      document.head.appendChild(script);
    }
  }

  window.__tatvic_gtm_overwritten = true;
  return true;
}

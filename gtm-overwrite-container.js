/**
 * ============================================================================
 * GTM CONTAINER OVERWRITE SCRIPT
 * ============================================================================
 * Target Container: GTM-T32XGF8F
 *
 * PURPOSE:
 * Forces any webpage to load and execute container 'GTM-T32XGF8F' instead of
 * any pre-existing or dynamically loaded GTM container (e.g. GTM-OLD...).
 *
 * HOW IT WORKS:
 * 1. Intercepts dynamic script creation: Any attempt to set .src to 'gtm.js'
 *    is intercepted and rewritten with container ID 'GTM-T32XGF8F'.
 * 2. Scans existing DOM: Disables / replaces any static <script src="...gtm.js">
 *    tags that loaded an old container ID.
 * 3. Injects target container: Automatically loads 'GTM-T32XGF8F' if not
 *    already loaded.
 * 4. Preserves Preview Mode: Forwards 'gtm_debug' & 'gtm_auth' flags from the
 *    URL so Tag Assistant preview mode works seamlessly.
 * 5. Stealth Mode Option: Can load via first-party stealth path '/_tatvic/loader.js'
 *    (to bypass uBlock Origin Lite & EasyPrivacy) or direct 'googletagmanager.com'.
 * ============================================================================
 */

(function() {
  'use strict';

  // --------------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------------
  var TARGET_CONTAINER_ID = 'GTM-T32XGF8F';

  // Choose loader source:
  // Option A (Stealth / Ad Blocker Proof): '/_tatvic/loader.js' (uses first-party proxy)
  // Option B (Direct Google): 'https://www.googletagmanager.com/gtm.js'
  var LOADER_ENDPOINT = '/_tatvic/loader.js';

  // Set to true to see debug logs in browser console
  var DEBUG = true;

  function log() {
    if (DEBUG && typeof console !== 'undefined' && console.log) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[GTM Overwrite]');
      console.log.apply(console, args);
    }
  }

  // --------------------------------------------------------------------------
  // 1. URL BUILDER (Preserves Tag Assistant flags & uses stealth 'cid' param)
  // --------------------------------------------------------------------------
  function buildTargetGtmUrl(originalSrc) {
    var pageSearch = (window.location && window.location.search) ? window.location.search : '';
    var pageParams = new URLSearchParams(pageSearch);

    var isStealth = LOADER_ENDPOINT.indexOf('/_tatvic/') !== -1 || LOADER_ENDPOINT.indexOf('loader.js') !== -1;
    var params = new URLSearchParams();

    // Use 'cid' for stealth loader to bypass EasyPrivacy '.js?id=GTM-' rule, or 'id' for direct GTM
    params.set(isStealth ? 'cid' : 'id', TARGET_CONTAINER_ID);

    // Copy any existing query parameters from the original request (if present)
    if (originalSrc) {
      try {
        var parsed = new URL(originalSrc, window.location.origin);
        parsed.searchParams.forEach(function(val, key) {
          if (key !== 'id' && key !== 'cid' && key !== 'container' && key !== 'tag') {
            params.set(key, val);
          }
        });
      } catch (e) {}
    }

    // Preserve Tag Assistant preview flags (gtm_debug, gtm_auth, gtm_preview)
    var previewFlags = ['gtm_debug', 'gtm_auth', 'gtm_preview', 'gtm_cookies_win'];
    for (var i = 0; i < previewFlags.length; i++) {
      var flag = previewFlags[i];
      if (pageParams.has(flag) && !params.has(flag)) {
        params.set(flag, pageParams.get(flag));
      }
    }

    var sep = LOADER_ENDPOINT.indexOf('?') === -1 ? '?' : '&';
    return LOADER_ENDPOINT + sep + params.toString();
  }

  // --------------------------------------------------------------------------
  // 2. INTERCEPT DYNAMIC SCRIPT CREATION (HTMLScriptElement.prototype.src)
  // --------------------------------------------------------------------------
  if (typeof HTMLScriptElement !== 'undefined') {
    var scriptDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (scriptDesc && scriptDesc.set) {
      var originalSet = scriptDesc.set;
      var originalGet = scriptDesc.get;

      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && (val.indexOf('googletagmanager.com/gtm.js') !== -1 || val.indexOf('loader.js') !== -1 || val.indexOf('/gtm.js') !== -1)) {
            // If already pointing to TARGET_CONTAINER_ID, proceed
            if (val.indexOf(TARGET_CONTAINER_ID) !== -1) {
              return originalSet.call(this, val);
            }

            log('Intercepted dynamic script loading other container:', val);
            var overwrittenUrl = buildTargetGtmUrl(val);
            log('Rewriting script src to target container:', overwrittenUrl);
            return originalSet.call(this, overwrittenUrl);
          }
          return originalSet.call(this, val);
        },
        get: function() {
          return originalGet.call(this);
        },
        configurable: true
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. SCAN & OVERWRITE EXISTING SCRIPTS IN THE DOM
  // --------------------------------------------------------------------------
  function overwriteExistingScripts() {
    var scripts = document.querySelectorAll('script[src*="gtm.js"], script[src*="loader.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s.getAttribute('src');
      if (src && src.indexOf(TARGET_CONTAINER_ID) === -1) {
        log('Found existing GTM script with different ID, removing:', src);
        if (s.parentNode) {
          s.parentNode.removeChild(s);
        }

        // Inject target container replacement
        var targetUrl = buildTargetGtmUrl(src);
        log('Injecting replacement script with ' + TARGET_CONTAINER_ID + ':', targetUrl);
        var replacement = document.createElement('script');
        replacement.async = true;
        replacement.src = targetUrl;
        document.head.appendChild(replacement);
      }
    }
  }

  overwriteExistingScripts();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', overwriteExistingScripts);
  }

  // --------------------------------------------------------------------------
  // 4. ENSURE DATALAYER & TARGET CONTAINER ARE LOADED
  // --------------------------------------------------------------------------
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function() {
    window.dataLayer.push(arguments);
  };

  // Check if TARGET_CONTAINER_ID is already present in document or google_tag_manager
  var hasTargetInDOM = document.querySelector('script[src*="' + TARGET_CONTAINER_ID + '"]');
  var hasTargetInGTM = window.google_tag_manager && window.google_tag_manager[TARGET_CONTAINER_ID];

  if (!hasTargetInDOM && !hasTargetInGTM) {
    var initialUrl = buildTargetGtmUrl('');
    log('Injecting target container (' + TARGET_CONTAINER_ID + '):', initialUrl);
    var targetScript = document.createElement('script');
    targetScript.async = true;
    targetScript.src = initialUrl;
    document.head.appendChild(targetScript);
  }

  log('Active. All GTM loading locked to:', TARGET_CONTAINER_ID);
})();

/**
 * ============================================================================
 * GTM CONTAINER DIAGNOSTIC & FORCE INJECTOR (Run in Browser Console)
 * ============================================================================
 * Target Container: GTM-T32XGF8F
 * ============================================================================
 */
(function() {
  console.group('🔍 [Tatvic] GTM Container Diagnostic for GTM-T32XGF8F');

  // 1. Check current URL for Tag Assistant preview flags
  var params = new URLSearchParams(window.location.search);
  var gtmDebug = params.get('gtm_debug');
  console.log('1. Tag Assistant Debug Param in URL:', gtmDebug ? ('Present (' + gtmDebug + ')') : '❌ Missing (?gtm_debug=...)');

  // 2. Check active containers in window.google_tag_manager
  var activeContainers = [];
  if (window.google_tag_manager) {
    activeContainers = Object.keys(window.google_tag_manager).filter(function(k) {
      return k.indexOf('GTM-') === 0 || k.indexOf('G-') === 0;
    });
  }
  console.log('2. Active Containers on Window:', activeContainers.length > 0 ? activeContainers : '❌ None found');

  // 3. Check GTM script elements in the DOM
  var gtmScripts = Array.prototype.slice.call(document.querySelectorAll('script[src*="gtm"], script[src*="loader"]'));
  console.log('3. Script Tags in DOM:', gtmScripts.map(function(s) { return s.src; }));

  var hasTarget = activeContainers.indexOf('GTM-T32XGF8F') !== -1;
  if (hasTarget) {
    console.log('✅ GTM-T32XGF8F is ALREADY active on this window!');
    console.groupEnd();
    return;
  }

  // 4. Test loading GTM-T32XGF8F directly to pinpoint failure (Ad Blocker vs 404 vs CSP)
  console.log('4. Attempting live fetch of GTM-T32XGF8F container script...');
  var targetUrl = 'https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F' + (gtmDebug ? '&gtm_debug=' + gtmDebug : '');

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  var testScript = document.createElement('script');
  testScript.async = true;
  testScript.src = targetUrl;
  testScript.onload = function() {
    console.log('🎉 SUCCESS! GTM-T32XGF8F loaded successfully. Tag Assistant will now connect!');
    console.groupEnd();
  };
  testScript.onerror = function(err) {
    console.error('❌ FAILED to load GTM-T32XGF8F from ' + targetUrl);
    console.warn('POSSIBLE REASONS:');
    console.warn('A) Ad Blocker (uBlock Origin Lite / Brave Shields) blocked googletagmanager.com.');
    console.warn('   -> Check DevTools Network tab for red net::ERR_BLOCKED_BY_CLIENT.');
    console.warn('   -> Temporarily toggle off your ad blocker for this site.');
    console.warn('B) Website Content Security Policy (CSP) blocked external scripts.');
    console.groupEnd();
  };
  document.head.appendChild(testScript);
})();

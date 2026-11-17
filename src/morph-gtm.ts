/**
 * Morphs Google Tag Manager (gtm.js) container script to route all third-party
 * ad and analytics tracking endpoints through your first-party relay, while
 * strictly preserving GTM core runtime, service worker bridge, and Tag Assistant
 * Preview & Debug mode capabilities.
 */
export function morphGtmScript(originalCode: string, relayEndpoint = '/_tatvic/relay'): string {
  let morphed = originalCode;

  // Derive the first-party base path (e.g. '/_tatvic' from '/_tatvic/relay')
  const collectBase = relayEndpoint.replace(/\/[^\/]+$/, '') || '/_tatvic';

  // 1. Rewrite Google Tag Manager dynamic GA4 collect constructors:
  // In gtm.js, Google builds URLs dynamically:
  //   function Qk(a){a=a===void 0?"g/collect":a;return"https://"+(Ok()||"www")+".google-analytics.com/"+a}
  //   function Rk(a){a=a===void 0?"g/collect":a;var b=Ok();return"https://"+(b?b+".":"")+"analytics.google.com/"+a}
  //   f="https://{ga4CollectionSubdomain.}google-analytics.com/g/s/collect".replace(...)
  // We rewrite these dynamic constructors directly to first-party endpoints so all collect requests
  // natively route to /_tatvic/g/collect, preserving clean query parameters in Chrome DevTools Payload tab.
  morphed = morphed.replace(
    /"https:\/\/"\s*\+([^\n;]{1,60})"\.google-analytics\.com\/"\s*\+\s*a/g,
    `"${collectBase}/"+a`
  );
  morphed = morphed.replace(
    /"https:\/\/"\s*\+([^\n;]{1,60})"analytics\.google\.com\/"\s*\+\s*a/g,
    `"${collectBase}/"+a`
  );
  morphed = morphed.replace(
    /"https:\/\/\{ga4CollectionSubdomain\.\}google-analytics\.com\/g\/s\/collect"/g,
    `"${collectBase}/g/s/collect"`
  );

  // 2. Rewrite external tracking & advertising endpoints into first-party relay calls.
  // NOTE: We deliberately do NOT rewrite 'googletagmanager.com' internally because GTM
  // relies on document.currentScript and new URL() calls with absolute origins.
  // The GTM container script itself is already loaded via first-party /_tatvic/gtm.js.
  const endpointReplacements: [RegExp, string][] = [
    // Google Ad Services & DoubleClick
    [/https:\/\/adservice\.google\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fadservice.google.com%2F`],
    [/https:\/\/www\.googleadservices\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fwww.googleadservices.com%2F`],
    [/https:\/\/pagead2\.googlesyndication\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fpagead2.googlesyndication.com%2F`],
    [/https:\/\/ad\.doubleclick\.net\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fad.doubleclick.net%2F`],
    // Google Analytics static collect endpoints fallback
    [/https:\/\/www\.google-analytics\.com\/g\/collect/g, `${collectBase}/g/collect`],
    [/https:\/\/analytics\.google\.com\/g\/collect/g, `${collectBase}/g/collect`],
    [/https:\/\/region1\.google-analytics\.com\/g\/collect/g, `${collectBase}/g/collect`],
    [/https:\/\/www\.google-analytics\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fwww.google-analytics.com%2F`],
    [/https:\/\/analytics\.google\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fanalytics.google.com%2F`],
    [/https:\/\/region1\.google-analytics\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fregion1.google-analytics.com%2F`],
  ];

  for (const [pattern, replacement] of endpointReplacements) {
    morphed = morphed.replace(pattern, replacement);
  }

  // CRITICAL FOR PREVIEW MODE:
  // Tag Assistant uses window.opener / postMessage with origin "https://tagassistant.google.com".
  // We explicitly preserve "tagassistant.google.com" without rewriting so the debug handshake succeeds.

  return morphed;
}

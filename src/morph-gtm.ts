/**
 * Morphs Google Tag Manager (gtm.js) container script to route all third-party
 * ad and analytics tracking endpoints through your first-party relay, while
 * strictly preserving GTM core runtime, service worker bridge, and Tag Assistant
 * Preview & Debug mode capabilities.
 */
export function morphGtmScript(originalCode: string, relayEndpoint = '/_tatvic/relay'): string {
  let morphed = originalCode;

  // 1. Rewrite Google Tag Manager dynamic GA4 collect constructors:
  // In gtm.js, Google builds URLs dynamically:
  //   function Qk(a){a=a===void 0?"g/collect":a;return"https://"+(Ok()||"www")+".google-analytics.com/"+a}
  //   function Rk(a){a=a===void 0?"g/collect":a;var b=Ok();return"https://"+(b?b+".":"")+"analytics.google.com/"+a}
  //   f="https://{ga4CollectionSubdomain.}google-analytics.com/g/s/collect".replace(...)
  // We rewrite these dynamic constructors directly to the first-party relay endpoint (/_tatvic/relay)
  // so all GA4 requests natively route to /_tatvic/relay?v=2&tid=...
  // This guarantees:
  // - ONLY the first-party relay endpoint is called (no '/g/collect' in the URL path).
  // - Brave Shields and ad blockers do NOT block it (avoiding '(blocked:other)').
  // - No duplicate requests / retry fallbacks ('&gaf=1') are triggered.
  // - Chrome DevTools parses all 25+ parameters natively in the "Payload" tab.
  morphed = morphed.replace(
    /"https:\/\/"\s*\+([^\n;]{1,60})"\.google-analytics\.com\/"\s*\+\s*a/g,
    `"${relayEndpoint}"`
  );
  morphed = morphed.replace(
    /"https:\/\/"\s*\+([^\n;]{1,60})"analytics\.google\.com\/"\s*\+\s*a/g,
    `"${relayEndpoint}"`
  );
  morphed = morphed.replace(
    /"https:\/\/\{ga4CollectionSubdomain\.\}google-analytics\.com\/g\/s\/collect"/g,
    `"${relayEndpoint}"`
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
    // Google Analytics static collect endpoints fallback (strictly using relayEndpoint)
    [/https:\/\/www\.google-analytics\.com\/g\/collect/g, `${relayEndpoint}`],
    [/https:\/\/analytics\.google\.com\/g\/collect/g, `${relayEndpoint}`],
    [/https:\/\/region1\.google-analytics\.com\/g\/collect/g, `${relayEndpoint}`],
    [/https:\/\/stats\.g\.doubleclick\.net\/g\/collect/g, `${relayEndpoint}`],
    [/https:\/\/www\.google-analytics\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fwww.google-analytics.com%2F`],
    [/https:\/\/analytics\.google\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fanalytics.google.com%2F`],
    [/https:\/\/region1\.google-analytics\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fregion1.google-analytics.com%2F`],
    // GTM internal diagnostic telemetry pings (/a?)
    [/https:\/\/www\.googletagmanager\.com\/a\?/g, `${relayEndpoint}?_telemetry=gtm&`],
  ];

  for (const [pattern, replacement] of endpointReplacements) {
    morphed = morphed.replace(pattern, replacement);
  }

  // CRITICAL FOR PREVIEW MODE:
  // Tag Assistant uses window.opener / postMessage with origin "https://tagassistant.google.com".
  // We explicitly preserve "tagassistant.google.com" without rewriting so the debug handshake succeeds.

  return morphed;
}

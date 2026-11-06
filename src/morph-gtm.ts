/**
 * Morphs Google Tag Manager (gtm.js) container script to route all third-party
 * ad and analytics tracking endpoints through your first-party relay, while
 * strictly preserving GTM core runtime, service worker bridge, and Tag Assistant
 * Preview & Debug mode capabilities.
 */
export function morphGtmScript(originalCode: string, relayEndpoint = '/_tatvic/relay'): string {
  let morphed = originalCode;

  // Rewrite external tracking & advertising endpoints into first-party relay calls.
  // NOTE: We deliberately do NOT rewrite 'googletagmanager.com' internally because GTM
  // relies on document.currentScript and new URL() calls with absolute origins.
  // The GTM container script itself is already loaded via first-party /_tatvic/gtm.js.
  const endpointReplacements: [RegExp, string][] = [
    // Google Ad Services & DoubleClick
    [/https:\/\/adservice\.google\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fadservice.google.com%2F`],
    [/https:\/\/www\.googleadservices\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fwww.googleadservices.com%2F`],
    [/https:\/\/pagead2\.googlesyndication\.com\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fpagead2.googlesyndication.com%2F`],
    [/https:\/\/ad\.doubleclick\.net\//g, `${relayEndpoint}?_tgt=https%3A%2F%2Fad.doubleclick.net%2F`],
    // Google Analytics collect endpoints
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

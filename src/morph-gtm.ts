/**
 * Morphs Google Tag Manager (gtm.js) container script to route all third-party
 * ad and analytics tracking endpoints through your first-party relay, while
 * strictly preserving GTM core runtime, service worker bridge, and Tag Assistant
 * Preview & Debug mode capabilities.
 */
export function morphGtmScript(
  originalCode: string,
  relayEndpoint = '/_tatvic/relay',
  defaultContainerId = 'GTM-T32XGF8F'
): string {
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
  // We strictly target collection hit endpoints so GTM template definitions, permissions,
  // and custom template Sandboxed JavaScript are NEVER altered or broken.
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
    [/https:\/\/www\.google-analytics\.com\/collect/g, `${relayEndpoint}`],
    [/https:\/\/analytics\.google\.com\/collect/g, `${relayEndpoint}`],
    [/https:\/\/region1\.google-analytics\.com\/collect/g, `${relayEndpoint}`],
    [/https:\/\/www\.google-analytics\.com\/j\/collect/g, `${relayEndpoint}`],
    [/https:\/\/analytics\.google\.com\/j\/collect/g, `${relayEndpoint}`],
    // GTM internal diagnostic telemetry pings (/a?)
    [/https:\/\/www\.googletagmanager\.com\/a\?/g, `${relayEndpoint}?_telemetry=gtm&`],
  ];

  for (const [pattern, replacement] of endpointReplacements) {
    morphed = morphed.replace(pattern, replacement);
  }

  // 3. Rewrite GTM's scriptSource / currentScript assignment (Rc variable):
  // GTM uses document.currentScript.src to validate its own origin and report CONTAINER_STARTING
  // to Tag Assistant. When loaded via first-party loader (e.g. /_tatvic/loader.js?cid=GTM-XXXX),
  // document.currentScript.src does not contain "googletagmanager.com".
  // This causes Gu() to return 0, an() to abort, and Tag Assistant to report "Google Tag not found".
  // We rewrite the Rc assignment so that Rc always evaluates to a canonical googletagmanager.com URL
  // preserving the container ID, while maintaining Pc as the actual DOM script element.
  const rcRegex = /var\s+([A-Za-z0-9_$]+),\s*([A-Za-z0-9_$]+)\s*=\s*([A-Za-z0-9_$]+)\.currentScript,\s*([A-Za-z0-9_$]+)\s*=\s*\(\1\s*=\s*\2\s*&&\s*\2\.tagName\s*===\s*["']SCRIPT["']\s*\?\s*\2\s*:\s*null\)\s*&&\s*\1\.src\s*;/g;

  if (rcRegex.test(morphed)) {
    morphed = morphed.replace(
      rcRegex,
      (_, pc, qc, doc, rc) => {
        return `var ${pc},${qc}=${doc}.currentScript,${rc}=(function(){var s=(${pc}=${qc}&&${qc}.tagName==="SCRIPT"?${qc}:null)&&${pc}.src;if(s&&s.indexOf("googletagmanager.com")!==-1)return s;var u=s?new URL(s,location.href):null;var cid=(u&&(u.searchParams.get("cid")||u.searchParams.get("id")||u.searchParams.get("_id")))||"${defaultContainerId}";var isGt=cid.indexOf("G-")===0||(u&&u.searchParams.get("_type")==="gtag");return"https://www.googletagmanager.com/"+(isGt?"gtag/js":"gtm.js")+"?id="+cid;})();`;
      }
    );
  } else {
    const directTarget = 'var Pc,Qc=C.currentScript,Rc=(Pc=Qc&&Qc.tagName==="SCRIPT"?Qc:null)&&Pc.src;';
    if (morphed.includes(directTarget)) {
      morphed = morphed.replace(
        directTarget,
        `var Pc,Qc=C.currentScript,Rc=(function(){var s=(Pc=Qc&&Qc.tagName==="SCRIPT"?Qc:null)&&Pc.src;if(s&&s.indexOf("googletagmanager.com")!==-1)return s;var u=s?new URL(s,location.href):null;var cid=(u&&(u.searchParams.get("cid")||u.searchParams.get("id")||u.searchParams.get("_id")))||"${defaultContainerId}";var isGt=cid.indexOf("G-")===0||(u&&u.searchParams.get("_type")==="gtag");return"https://www.googletagmanager.com/"+(isGt?"gtag/js":"gtm.js")+"?id="+cid;})();`
      );
    }
  }

  // CRITICAL FOR PREVIEW MODE:
  // Tag Assistant uses window.opener / postMessage with origin "https://tagassistant.google.com".
  // We explicitly preserve "tagassistant.google.com" without rewriting so the debug handshake succeeds.

  return morphed;
}

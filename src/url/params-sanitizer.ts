/**
 * Sanitizes and reorders query parameters to strictly evade EasyPrivacy, uBlock Origin,
 * and Brave Shields ad-blocking rules without losing any telemetry data:
 * - Prepends cache-buster '_p' parameter to defeat '?v=2&tid=G-$~third-party' rule.
 * - Aliases 'gtm' -> '_gtm' to defeat '&gtm=*&tag_exp=', '&cx=c&gtm=', '&tid=*&gtm=*&ecid='.
 * - Aliases 'tag_exp' -> '_tag_exp' to defeat '&gtm=*&tag_exp='.
 * - Aliases 'cx' -> '_cx' to defeat '&cx=c&gtm=' and '&l=dataLayer&cx=c'.
 * - Aliases 'l' -> '_l' if dataLayer to defeat '&l=dataLayer&cx=c'.
 * - Moves 'v' to the very end of the query string.
 */
export function sanitizeParamsForAdBlockers(params: URLSearchParams): URLSearchParams {
  const sanitized = new URLSearchParams();

  // 1. If '_p' is present, place it first as a cache-buster / prefix
  if (params.has('_p')) {
    sanitized.set('_p', params.get('_p')!);
  }

  // 2. Put 'tid' near the front so query string never starts with 'v='
  if (params.has('tid')) {
    sanitized.set('tid', params.get('tid')!);
  }

  let vVal: string | null = null;

  params.forEach((val, key) => {
    if (key === '_p' || key === 'tid') return;
    if (key === 'v') {
      vVal = val;
      return;
    }

    if (key === 'gtm') {
      sanitized.set('_gtm', val);
    } else if (key === 'tag_exp') {
      sanitized.set('_tag_exp', val);
    } else if (key === 'cx') {
      sanitized.set('_cx', val);
    } else if (key === 'l' && (val === 'dataLayer' || val.includes('Layer'))) {
      sanitized.set('_l', val);
    } else if (key === 'id') {
      // Alias 'id' with container prefixes to '_id' to evade EasyPrivacy '&id=GTM-', '&id=G-', '&id=UA-' rules
      if (/^(GTM|G|UA|AW|DC)-/i.test(val)) {
        sanitized.set('_id', val);
      } else {
        sanitized.set('id', val);
      }
    } else if (key.startsWith('sst.')) {
      sanitized.set(`_${key}`, val);
    } else if (key === 'ep.analytics_storage') {
      sanitized.set('_ep.analytics_storage', val);
    } else if (key === 'event_name') {
      sanitized.set('_event_name', val);
    } else {
      sanitized.set(key, val);
    }
  });

  // 3. Put 'v' at the very end
  if (vVal !== null) {
    sanitized.set('v', vVal);
  }

  return sanitized;
}

/**
 * Extracts target URL from request headers, query parameters, or GA4 collect fallback.
 */
export function extractTargetUrl(
  request: Request,
  reqUrl: URL,
  headerName: string,
  serverContainerUrl?: string
): string | null {
  let targetUrlStr =
    request.headers.get(headerName) ||
    request.headers.get('x-tatvic-target') ||
    request.headers.get('x-relay-target') ||
    reqUrl.searchParams.get('_tgt');

  if (!targetUrlStr) {
    const isTrackingHit =
      reqUrl.pathname.includes('/g/collect') ||
      reqUrl.pathname.includes('/collect') ||
      reqUrl.searchParams.has('tid') ||
      (reqUrl.searchParams.has('v') && (reqUrl.searchParams.has('cid') || reqUrl.searchParams.has('en')));

    if (isTrackingHit) {
      const upstreamBase = serverContainerUrl || 'https://www.google-analytics.com';
      const subpath = reqUrl.pathname.includes('/g/collect')
        ? '/g/collect'
        : reqUrl.pathname.includes('/collect')
          ? '/collect'
          : '/g/collect';
      targetUrlStr = `${upstreamBase}${subpath}${reqUrl.search}`;
    }
  }

  return targetUrlStr;
}

/**
 * Decodes obfuscated / base64 target URLs.
 */
export function decodeTargetUrl(targetUrlStr: string): string | null {
  try {
    const decoded =
      typeof atob !== 'undefined'
        ? atob(targetUrlStr)
        : Buffer.from(targetUrlStr, 'base64').toString('utf-8');
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded;
    }
  } catch {}
  return null;
}

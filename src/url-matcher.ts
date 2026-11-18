import type { ProxySdkOptions } from './types.js';
import {
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_HEADER_NAME,
  DEFAULT_TARGET_DOMAINS,
  DEFAULT_EXCLUDE_DOMAINS,
} from './defaults.js';

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

export class UrlMatcher {
  private targetDomains: (string | RegExp)[];
  private excludeDomains: (string | RegExp)[];
  private proxyEndpoint: string;
  private targetHeaderName: string;
  private obfuscateTarget: boolean;
  private routingMode: 'header' | 'query' | 'auto';
  private preserveQueryOnProxyUrl: boolean;
  private debug: boolean;

  constructor(options: ProxySdkOptions = {}) {
    this.targetDomains = options.targetDomains ?? DEFAULT_TARGET_DOMAINS;
    this.excludeDomains = options.excludeDomains ?? DEFAULT_EXCLUDE_DOMAINS;
    this.proxyEndpoint = options.proxyEndpoint ?? DEFAULT_PROXY_ENDPOINT;
    this.targetHeaderName = (options.targetHeaderName ?? DEFAULT_HEADER_NAME).toLowerCase();
    this.obfuscateTarget = options.obfuscateTarget ?? false;
    this.routingMode = options.routingMode ?? 'auto';
    this.preserveQueryOnProxyUrl = options.preserveQueryOnProxyUrl ?? false;
    this.debug = options.debug ?? false;
  }

  /**
   * Determine if a given URL should be routed through the first-party proxy.
   */
  public shouldProxy(urlStr: string): boolean {
    const parsed = this.parseUrl(urlStr);
    if (!parsed) return false;

    const hostname = parsed.hostname.toLowerCase();

    // Don't proxy requests already going to the proxy endpoint or same origin
    if (typeof window !== 'undefined' && window.location?.origin && parsed.origin === window.location.origin) {
      if (parsed.pathname.startsWith(this.proxyEndpoint)) {
        return false;
      }
    }

    // Check exclude list first
    for (const rule of this.excludeDomains) {
      if (this.matchesRule(hostname, rule)) {
        return false;
      }
    }

    // Check target list
    for (const rule of this.targetDomains) {
      if (this.matchesRule(hostname, rule)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Encodes the destination target according to options.
   */
  public encodeTarget(targetUrl: string): string {
    if (this.obfuscateTarget) {
      if (typeof btoa !== 'undefined') {
        return btoa(targetUrl);
      }
      return Buffer.from(targetUrl).toString('base64');
    }
    return targetUrl;
  }

  /**
   * Generates the proxy request information.
   */
  public getProxiedRequestInfo(
    originalUrl: string,
    forcedMode?: 'header' | 'query'
  ): {
    proxyUrl: string;
    headerName?: string;
    headerValue?: string;
  } {
    const mode = forcedMode ?? (this.routingMode === 'auto' ? 'header' : this.routingMode);
    const encodedTarget = this.encodeTarget(originalUrl);
    const parsedTarget = this.parseUrl(originalUrl);

    // Detect GA4 / sGTM collection hits
    const isGa4Collect =
      parsedTarget &&
      (parsedTarget.pathname.endsWith('/g/collect') ||
        parsedTarget.pathname.endsWith('/collect') ||
        (parsedTarget.searchParams.has('v') && parsedTarget.searchParams.has('tid')));

    // When preserveQueryOnProxyUrl is true and this is a GA4/sGTM collect request,
    // route directly through proxyEndpoint with sanitized and reordered query params (_p=...&tid=...&v=2)
    // so Chrome DevTools parses all params natively in the Payload tab while strictly
    // defeating EasyPrivacy / uBlock rules ('?v=2&tid=G-$~third-party', '&gtm=*&tag_exp=', '&cx=c&gtm=').
    if (this.preserveQueryOnProxyUrl && isGa4Collect) {
      let search = '';
      if (parsedTarget && parsedTarget.search) {
        const sanitized = sanitizeParamsForAdBlockers(parsedTarget.searchParams);
        search = sanitized.toString();
      }
      const sep = this.proxyEndpoint.includes('?') ? '&' : '?';
      const proxyUrl = search ? `${this.proxyEndpoint}${sep}${search}` : this.proxyEndpoint;
      return {
        proxyUrl,
        headerName: this.targetHeaderName,
        headerValue: encodedTarget,
      };
    }

    if (mode === 'query') {
      if (this.preserveQueryOnProxyUrl && parsedTarget && parsedTarget.search) {
        // Otherwise preserve sanitized query params as top-level params and attach target base
        const sanitized = sanitizeParamsForAdBlockers(parsedTarget.searchParams);
        const baseTarget = `${parsedTarget.origin}${parsedTarget.pathname}`;
        const encodedBaseTarget = this.encodeTarget(baseTarget);
        const sep = this.proxyEndpoint.includes('?') ? '&' : '?';
        const proxyUrl = `${this.proxyEndpoint}${sep}${sanitized.toString()}&_tgt=${encodeURIComponent(encodedBaseTarget)}`;
        return { proxyUrl };
      }

      const separator = this.proxyEndpoint.includes('?') ? '&' : '?';
      const proxyUrl = `${this.proxyEndpoint}${separator}_tgt=${encodeURIComponent(encodedTarget)}`;
      return { proxyUrl };
    }

    // In header mode: preserve original query parameters on proxyUrl if enabled,
    // applying ad-blocker sanitization so neither Brave nor uBlock Origin blocks the request.
    let proxyUrl = this.proxyEndpoint;
    if (this.preserveQueryOnProxyUrl && parsedTarget && parsedTarget.search) {
      const sanitized = sanitizeParamsForAdBlockers(parsedTarget.searchParams);
      const sep = proxyUrl.includes('?') ? '&' : '?';
      proxyUrl = `${proxyUrl}${sep}${sanitized.toString()}`;
    }

    return {
      proxyUrl,
      headerName: this.targetHeaderName,
      headerValue: encodedTarget,
    };
  }

  public getProxyEndpoint(): string {
    return this.proxyEndpoint;
  }

  /**
   * Sanitizes any URL (especially requests already targeted at proxyEndpoint)
   * to ensure no ad-blocker filter triggers in the query string.
   */
  public sanitizeUrl(urlStr: string): string {
    const parsed = this.parseUrl(urlStr);
    if (!parsed || !parsed.search) return urlStr;

    const sanitized = sanitizeParamsForAdBlockers(parsed.searchParams);
    return `${parsed.origin}${parsed.pathname}?${sanitized.toString()}`;
  }

  public log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[Tatvic Proxy SDK]', ...args);
    }
  }

  private matchesRule(hostname: string, rule: string | RegExp): boolean {
    if (rule instanceof RegExp) {
      return rule.test(hostname);
    }
    const cleanRule = rule.toLowerCase().trim();
    return hostname === cleanRule || hostname.endsWith(`.${cleanRule}`);
  }

  public parseUrl(urlStr: string): URL | null {
    try {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return new URL(urlStr, window.location.origin);
      }
      return new URL(urlStr);
    } catch {
      return null;
    }
  }
}

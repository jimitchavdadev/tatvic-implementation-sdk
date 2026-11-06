import type { ProxySdkOptions } from './types.js';
import {
  DEFAULT_PROXY_ENDPOINT,
  DEFAULT_HEADER_NAME,
  DEFAULT_TARGET_DOMAINS,
  DEFAULT_EXCLUDE_DOMAINS,
} from './defaults.js';

export class UrlMatcher {
  private targetDomains: (string | RegExp)[];
  private excludeDomains: (string | RegExp)[];
  private proxyEndpoint: string;
  private targetHeaderName: string;
  private obfuscateTarget: boolean;
  private routingMode: 'header' | 'query' | 'auto';
  private debug: boolean;

  constructor(options: ProxySdkOptions = {}) {
    this.targetDomains = options.targetDomains ?? DEFAULT_TARGET_DOMAINS;
    this.excludeDomains = options.excludeDomains ?? DEFAULT_EXCLUDE_DOMAINS;
    this.proxyEndpoint = options.proxyEndpoint ?? DEFAULT_PROXY_ENDPOINT;
    this.targetHeaderName = (options.targetHeaderName ?? DEFAULT_HEADER_NAME).toLowerCase();
    this.obfuscateTarget = options.obfuscateTarget ?? false;
    this.routingMode = options.routingMode ?? 'auto';
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

    if (mode === 'query') {
      const separator = this.proxyEndpoint.includes('?') ? '&' : '?';
      const proxyUrl = `${this.proxyEndpoint}${separator}_tgt=${encodeURIComponent(encodedTarget)}`;
      return { proxyUrl };
    }

    return {
      proxyUrl: this.proxyEndpoint,
      headerName: this.targetHeaderName,
      headerValue: encodedTarget,
    };
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

  private parseUrl(urlStr: string): URL | null {
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

import { RequestInterceptor } from './interceptor.js';
import type { ProxySdkOptions } from './types.js';

export * from './types.js';
export * from './defaults.js';
export * from './url-matcher.js';
export * from './interceptor.js';
export * from './server-proxy.js';
export * from './morph-gtm.js';
export * from './custom-element.js';
export * from './next.js';
export * from './express.js';

let activeInterceptor: RequestInterceptor | null = null;

/**
 * Initialize the First-Party Request Wrapper SDK.
 *
 * Intercepts outgoing tracking/analytics requests (fetch, XMLHttpRequest, sendBeacon)
 * and transparently routes them to your first-party relay endpoint.
 *
 * Zero-config: All standard analytics/tracking domains are enabled by default.
 *
 * @param options Configuration options (optional)
 * @returns The active RequestInterceptor instance.
 */
export function initFirstPartyWrapper(options: ProxySdkOptions = {}): RequestInterceptor {
  if (activeInterceptor) {
    activeInterceptor.uninstall();
  }

  activeInterceptor = new RequestInterceptor(options);
  activeInterceptor.install();
  return activeInterceptor;
}

/**
 * Restore original native browser APIs and uninstall the wrapper.
 */
export function uninstallFirstPartyWrapper(): void {
  if (activeInterceptor) {
    activeInterceptor.uninstall();
    activeInterceptor = null;
  }
}

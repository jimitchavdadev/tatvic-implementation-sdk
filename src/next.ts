import { createProxyHandler } from './server-proxy.js';
import type { ServerProxyOptions } from './types.js';

/**
 * Pre-configured Next.js App Router route handler.
 *
 * In your Next.js project, create `app/_tatvic/relay/route.ts`:
 * ```typescript
 * import { tatvicRelayRoute } from 'tatvic-implementation-sdk/next';
 *
 * export const { GET, POST, OPTIONS } = tatvicRelayRoute();
 * ```
 */
export function tatvicRelayRoute(options: ServerProxyOptions = {}) {
  const handler = createProxyHandler(options);

  return {
    GET: handler,
    POST: handler,
    OPTIONS: handler,
  };
}

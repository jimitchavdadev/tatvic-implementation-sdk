import { createProxyHandler } from './server-proxy.js';
import type { ServerProxyOptions } from './types.js';

interface ExpressLikeRequest {
  method: string;
  url?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
}

interface ExpressLikeResponse {
  status(code: number): this;
  setHeader(name: string, value: string): this;
  end(chunk?: any): void;
  send(body?: any): void;
}

/**
 * Express / Connect / Node.js middleware for the Tatvic First-Party Relay.
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { tatvicExpressMiddleware } from 'tatvic-implementation-sdk/express';
 *
 * const app = express();
 * app.use('/_tatvic/relay', tatvicExpressMiddleware());
 * ```
 */
export function tatvicExpressMiddleware(options: ServerProxyOptions = {}) {
  const handler = createProxyHandler(options);

  return async function (req: ExpressLikeRequest, res: ExpressLikeResponse, next?: (err?: any) => void) {
    try {
      const host = (req.headers['host'] as string) || 'localhost';
      const fullUrl = `http://${host}${req.originalUrl || req.url || '/_tatvic/relay'}`;

      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else if (typeof val === 'string') {
          headers.set(key, val);
        }
      }

      let body: any = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
          body = req.body;
        } else if (req.body && typeof req.body === 'object') {
          body = JSON.stringify(req.body);
        }
      }

      const webRequest = new Request(fullUrl, {
        method: req.method,
        headers,
        body,
      });

      const webResponse = await handler(webRequest);

      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const arrayBuffer = await webResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    } catch (err) {
      if (next) {
        next(err);
      } else {
        res.status(500).send('Tatvic Relay Error');
      }
    }
  };
}

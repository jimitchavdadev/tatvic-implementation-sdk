import { tatvicExpressMiddleware } from '../../src/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Standalone runner using Bun or Express-compatible server
const middleware = tatvicExpressMiddleware();

export default {
  port: 4003,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Relay endpoint & Morphed GTM loader
    if (url.pathname.startsWith('/_tatvic/')) {
      let status = 200;
      const resHeaders: Record<string, string> = {};
      let responseBody: any = null;

      const mockRes: any = {
        status(code: number) {
          status = code;
          return this;
        },
        setHeader(name: string, value: string) {
          resHeaders[name] = value;
          return this;
        },
        end(data: any) {
          responseBody = data;
        },
        send(data: any) {
          responseBody = data;
        },
      };

      await middleware(
        {
          method: req.method,
          url: url.pathname + url.search,
          headers: Object.fromEntries(req.headers.entries()),
          body: req.method !== 'GET' ? await req.arrayBuffer() : undefined,
        },
        mockRes
      );

      return new Response(responseBody, {
        status,
        headers: resHeaders,
      });
    }

    // Serve SDK bundle
    if (url.pathname === '/dist/tatvic.js') {
      const bundlePath = join(import.meta.dir, '../../dist/tatvic.js');
      if (existsSync(bundlePath)) {
        return new Response(readFileSync(bundlePath), {
          headers: { 'Content-Type': 'application/javascript' },
        });
      }
    }

    // Serve HTML view
    const viewPath = join(import.meta.dir, 'views/index.html');
    return new Response(readFileSync(viewPath), {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};

console.log('Express/Node GTM Demo running on http://localhost:4003');

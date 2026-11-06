import { createProxyHandler } from '../../src/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const relay = createProxyHandler({
  serverPreviewToken: 'ZW52LTd8a2RuTVd2blg4aVJsUkR3cmdGcHBPUXwxYTFhZjFmYzliODBhNTAwN2NlMGU=',
  serverContainerUrl: 'https://tpozgxiu.usu.stape.io'
});

export default {
  port: 4001,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Relay endpoint & Morphed GTM loader
    if (url.pathname.startsWith('/_tatvic/')) {
      return relay(req);
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

    // Serve index.html
    const htmlPath = join(import.meta.dir, 'index.html');
    return new Response(readFileSync(htmlPath), {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};

console.log('Plain HTML GTM Demo running on http://localhost:4001');

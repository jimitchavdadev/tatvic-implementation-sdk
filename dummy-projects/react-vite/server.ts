import { createProxyHandler } from '../../src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const relay = createProxyHandler();

export default {
  port: 4002,
  async fetch(req: Request) {
    const url = new URL(req.url);

    // Relay endpoint & Morphed GTM loader
    if (url.pathname.startsWith('/_tatvic/')) {
      return relay(req);
    }

    // Serve HTML
    const htmlPath = join(import.meta.dir, 'index.html');
    return new Response(readFileSync(htmlPath), {
      headers: { 'Content-Type': 'text/html' },
    });
  },
};

console.log('React SPA GTM Demo running on http://localhost:4002');

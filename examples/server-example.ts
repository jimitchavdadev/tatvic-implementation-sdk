import { createProxyHandler } from '../src/index.js';

// Create the backend relay handler
const relayHandler = createProxyHandler({
  // Strict SSRF defense: only permit forwarding to your approved analytics platforms
  allowedDomains: [
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com',
    'connect.facebook.net',
    'clarity.ms',
  ],
  targetHeaderName: 'x-relay-target',
  timeoutMs: 10000,
});

// Run with Bun: `bun run examples/server-example.ts`
console.log('First-party relay server listening on http://localhost:3000/api/v1/relay');

export default {
  port: 3000,
  async fetch(req: Request) {
    const url = new URL(req.url);

    if (url.pathname === '/api/v1/relay') {
      return relayHandler(req);
    }

    return new Response('Tatvic First-Party Relay Server', { status: 200 });
  },
};

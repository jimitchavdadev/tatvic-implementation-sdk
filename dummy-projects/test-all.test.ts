import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createProxyHandler, tatvicRelayRoute, tatvicExpressMiddleware } from '../src/index.js';
import htmlServer from './html-vanilla/server.js';
import reactServer from './react-vite/server.js';
import expressServer from './express-node/server.js';

describe('Dummy Projects E2E Verification with Morphed GTM', () => {
  let htmlServerInstance: any;
  let reactServerInstance: any;
  let expressServerInstance: any;

  beforeAll(() => {
    htmlServerInstance = Bun.serve({ ...htmlServer, port: 4101 });
    reactServerInstance = Bun.serve({ ...reactServer, port: 4102 });
    expressServerInstance = Bun.serve({ ...expressServer, port: 4103 });
  });

  afterAll(() => {
    htmlServerInstance?.stop();
    reactServerInstance?.stop();
    expressServerInstance?.stop();
  });

  it('1. HTML Vanilla: Serves page with <tatvic-wrapper> and GTM snippet', async () => {
    const res = await fetch(`http://localhost:${htmlServerInstance.port}`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('<tatvic-wrapper');
    expect(html).toContain('GTM-T32XGF8F');
  });

  it('2. Morphed GTM Loader: Serves morphed gtm.js via first-party /_tatvic/gtm.js', async () => {
    const res = await fetch(`http://localhost:${htmlServerInstance.port}/_tatvic/gtm.js?id=GTM-T32XGF8F`);
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('javascript');

    const content = await res.text();
    expect(content.length).toBeGreaterThan(1000);
    // Verified that Google endpoints are morphed to first-party relay
    expect(content).toContain('/_tatvic/relay?_tgt=');
    // Verified tagassistant.google.com is preserved for preview mode handshake
    expect(content).toContain('tagassistant.google.com');
  });

  it('2b. Stealth GTM Loader: Serves morphed loader via /_tatvic/loader.js?cid=GTM-T32XGF8F (bypasses uBlock Origin Lite / EasyPrivacy)', async () => {
    const res = await fetch(`http://localhost:${htmlServerInstance.port}/_tatvic/loader.js?cid=GTM-T32XGF8F`);
    expect(res.status).toBe(200);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).toContain('javascript');

    const content = await res.text();
    expect(content.length).toBeGreaterThan(1000);
    expect(content).toContain('/_tatvic/relay?_tgt=');
    expect(content).toContain('tagassistant.google.com');
  });

  it('3. Tag Assistant Preview Mode: Propagates gtm_debug and disables cache', async () => {
    const debugUrl = `http://localhost:${htmlServerInstance.port}/_tatvic/gtm.js?id=GTM-T32XGF8F&gtm_debug=1793774361474`;
    const res = await fetch(debugUrl);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-cache');

    const content = await res.text();
    expect(content).toContain('tagassistant.google.com');
  });

  it('4. HTML Vanilla: Relays GA4 telemetry beacon through /_tatvic/relay', async () => {
    const gaCollectUrl = 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&en=generate_lead';
    const res = await fetch(`http://localhost:${htmlServerInstance.port}/_tatvic/relay`, {
      method: 'POST',
      headers: {
        'x-tatvic-target': gaCollectUrl,
        'Content-Type': 'text/plain',
      },
      body: 'en=generate_lead&value=49.99',
    });

    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('5. Next.js App Router: tatvicRelayRoute() serves morphed GTM and handles telemetry', async () => {
    const { GET, POST } = tatvicRelayRoute();

    // Test Morphed GTM GET
    const getReq = new Request('http://localhost:3000/_tatvic/gtm.js?id=GTM-T32XGF8F&gtm_debug=123', {
      method: 'GET',
    });
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const scriptBody = await getRes.text();
    expect(scriptBody).toContain('/_tatvic/relay?_tgt=');
    expect(scriptBody).toContain('tagassistant.google.com');

    // Test Telemetry POST
    const postReq = new Request('http://localhost:3000/_tatvic/relay', {
      method: 'POST',
      headers: {
        'x-tatvic-target': 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST',
      },
      body: 'en=conversion&value=199.99',
    });
    const postRes = await POST(postReq);
    expect([200, 204]).toContain(postRes.status);
  });

  it('6. Express / Node: Serves morphed GTM via middleware', async () => {
    const res = await fetch(
      `http://localhost:${expressServerInstance.port}/_tatvic/gtm.js?id=GTM-T32XGF8F`
    );

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('/_tatvic/relay?_tgt=');
  });

  it('7. Security: Rejects non-allowlisted domains', async () => {
    const maliciousTarget = 'https://malicious-tracker-or-internal-ip.com/leak';
    const res = await fetch(`http://localhost:${htmlServerInstance.port}/_tatvic/relay`, {
      headers: {
        'x-tatvic-target': maliciousTarget,
      },
    });

    expect(res.status).toBe(403);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('Target host is not permitted');
  });
});

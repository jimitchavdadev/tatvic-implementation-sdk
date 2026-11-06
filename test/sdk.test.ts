import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { UrlMatcher } from '../src/url-matcher.js';
import { RequestInterceptor } from '../src/interceptor.js';
import { createProxyHandler } from '../src/server-proxy.js';

describe('UrlMatcher', () => {
  it('should identify default target tracking domains', () => {
    const matcher = new UrlMatcher();
    expect(matcher.shouldProxy('https://www.google-analytics.com/g/collect?v=2')).toBe(true);
    expect(matcher.shouldProxy('https://connect.facebook.net/en_US/fbevents.js')).toBe(true);
    expect(matcher.shouldProxy('https://clarity.ms/tag/xyz')).toBe(true);
  });

  it('should not proxy non-targeted domains', () => {
    const matcher = new UrlMatcher();
    expect(matcher.shouldProxy('https://api.github.com/users')).toBe(false);
    expect(matcher.shouldProxy('https://cdn.jsdelivr.net/npm/vue')).toBe(false);
  });

  it('should honor custom exclude domains', () => {
    const matcher = new UrlMatcher({
      targetDomains: ['google-analytics.com', 'stripe.com'],
      excludeDomains: ['stripe.com'],
    });
    expect(matcher.shouldProxy('https://google-analytics.com/collect')).toBe(true);
    expect(matcher.shouldProxy('https://api.stripe.com/v1/charges')).toBe(false);
  });

  it('should generate header-based proxy info by default', () => {
    const matcher = new UrlMatcher({ proxyEndpoint: '/api/v1/gateway' });
    const info = matcher.getProxiedRequestInfo('https://www.google-analytics.com/g/collect');
    expect(info.proxyUrl).toBe('/api/v1/gateway');
    expect(info.headerName).toBe('x-tatvic-target');
    expect(info.headerValue).toBe('https://www.google-analytics.com/g/collect');
  });

  it('should support base64 obfuscation', () => {
    const matcher = new UrlMatcher({
      proxyEndpoint: '/api/v1/gateway',
      obfuscateTarget: true,
    });
    const target = 'https://www.google-analytics.com/g/collect';
    const info = matcher.getProxiedRequestInfo(target);
    expect(info.headerValue).toBe(btoa(target));
  });

  it('should support query routing mode', () => {
    const matcher = new UrlMatcher({
      proxyEndpoint: '/api/v1/gateway',
      routingMode: 'query',
    });
    const info = matcher.getProxiedRequestInfo('https://www.google-analytics.com/g/collect');
    expect(info.proxyUrl).toContain('/api/v1/gateway?_tgt=');
    expect(info.proxyUrl).toContain(encodeURIComponent('https://www.google-analytics.com/g/collect'));
  });
});

describe('ServerProxyHandler', () => {
  it('should block non-allowlisted domains to prevent SSRF', async () => {
    const handler = createProxyHandler({
      allowedDomains: ['google-analytics.com'],
    });

    const req = new Request('http://localhost:3000/api/v1/gateway', {
      headers: {
        'x-tatvic-target': 'http://169.254.169.254/latest/meta-data/',
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Target host is not permitted');
  });

  it('should reject requests missing target destination', async () => {
    const handler = createProxyHandler({
      allowedDomains: ['google-analytics.com'],
    });

    const req = new Request('http://localhost:3000/api/v1/gateway');
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing target destination');
  });

  it('should handle query-based target with obfuscation', async () => {
    const handler = createProxyHandler({
      allowedDomains: ['google-analytics.com'],
      obfuscateTarget: true,
    });

    const encodedTarget = btoa('https://google-analytics.com/collect');
    const req = new Request(`http://localhost:3000/api/v1/gateway?_tgt=${encodedTarget}`);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;

    try {
      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should forward x-gtm-server-preview header and cookies for sGTM preview', async () => {
    let forwardedHeaders: Headers | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      forwardedHeaders = new Headers(init?.headers);
      const res = new Response('ok', { status: 200 });
      res.headers.set('set-cookie', 'gtm_preview=token123; Path=/');
      return res;
    }) as unknown as typeof fetch;

    try {
      const handler = createProxyHandler({
        allowedDomains: ['google-analytics.com'],
      });

      const req = new Request('http://localhost:3000/_tatvic/relay', {
        method: 'POST',
        headers: {
          'x-tatvic-target': 'https://www.google-analytics.com/g/collect?v=2',
          'x-gtm-server-preview': 'preview-token-xyz',
          'cookie': 'gtm_preview=preview-token-xyz; _ga=GA1.1.12345',
        },
        body: 'en=generate_lead',
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      expect(forwardedHeaders?.get('x-gtm-server-preview')).toBe('preview-token-xyz');
      expect(forwardedHeaders?.get('cookie')).toContain('gtm_preview=preview-token-xyz');
      expect(res.headers.get('set-cookie')).toBe('gtm_preview=token123; Path=/');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('RequestInterceptor in Browser Context', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    (globalThis as any).window = globalThis;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should rewrite targeted fetch calls to the proxy endpoint with header', async () => {
    let capturedUrl = '';
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedHeaders = init?.headers ? new Headers(init.headers) : undefined;
      return new Response('proxied-response');
    }) as typeof fetch;

    const interceptor = new RequestInterceptor({
      proxyEndpoint: '/api/v1/relay',
      targetDomains: ['analytics.example.com'],
    });

    interceptor.install();

    const targetUrl = 'https://analytics.example.com/v1/events?user=123';
    await fetch(targetUrl, {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
    });

    expect(capturedUrl).toBe('/api/v1/relay');
    expect(capturedHeaders?.get('x-tatvic-target')).toBe(targetUrl);

    interceptor.uninstall();

    // After uninstall, original fetch should be called directly
    await fetch(targetUrl);
    expect(capturedUrl).toBe(targetUrl);
  });

  it('should rewrite sendBeacon calls via keepalive fetch', () => {
    let capturedFetchUrl = '';
    let capturedKeepalive: boolean | undefined;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedFetchUrl = input.toString();
      capturedKeepalive = init?.keepalive;
      return new Response('ok');
    }) as typeof fetch;

    (globalThis as any).navigator = {
      sendBeacon: () => true,
    };

    const interceptor = new RequestInterceptor({
      proxyEndpoint: '/api/v1/relay',
      targetDomains: ['google-analytics.com'],
      polyfillBeaconWithKeepalive: true,
    });

    interceptor.install();

    const result = navigator.sendBeacon(
      'https://google-analytics.com/g/collect?v=2',
      JSON.stringify({ ping: true })
    );

    expect(result).toBe(true);
    expect(capturedFetchUrl).toBe('/api/v1/relay');
    expect(capturedKeepalive).toBe(true);

    interceptor.uninstall();
  });

  it('should intercept dynamic script element src assignment', () => {
    let scriptSrc = '';
    const mockScriptDesc = {
      get() {
        return scriptSrc;
      },
      set(val: string) {
        scriptSrc = val;
      },
      configurable: true,
      enumerable: true,
    };

    class MockScriptElement {}
    Object.defineProperty(MockScriptElement.prototype, 'src', mockScriptDesc);
    (globalThis as any).HTMLScriptElement = MockScriptElement;

    const interceptor = new RequestInterceptor({
      proxyEndpoint: '/_tatvic/relay',
      targetDomains: ['googletagmanager.com'],
    });

    interceptor.install();

    const script = new MockScriptElement() as any;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F';

    expect(script.src).toBe('/_tatvic/loader.js?cid=GTM-T32XGF8F');

    interceptor.uninstall();
  });
});

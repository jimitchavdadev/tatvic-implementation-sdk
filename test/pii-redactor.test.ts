import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  PiiRedactor,
  DEFAULT_EMAIL_REGEX,
  DEFAULT_PHONE_REGEX,
} from '../src/pii-redactor.js';
import { createProxyHandler } from '../src/server-proxy.js';
import { RequestInterceptor } from '../src/interceptor.js';

describe('PII Redactor - Email Detection & Redaction', () => {
  const redactor = new PiiRedactor();

  it('should redact plain text email addresses to NA', () => {
    expect(redactor.hasPii('email', 'john.doe@tatvic.com')).toBe(true);
    expect(redactor.hasPii('user_email', 'alice.smith+tag@example.co.uk')).toBe(true);
    expect(redactor.hasPii('ep.email', 'test.user-99@domain.org')).toBe(true);
  });

  it('should redact URL-encoded (%40) email addresses to NA', () => {
    expect(redactor.hasPii('email', 'john.doe%40tatvic.com')).toBe(true);
    expect(redactor.hasPii('user_email', 'alice%40example.com')).toBe(true);
  });

  it('should NOT redact image assets that contain @2x (photo@2x.png, avatar@2x.jpg)', () => {
    expect(redactor.hasPii('image', 'banner@2x.png')).toBe(false);
    expect(redactor.hasPii('photo', 'avatar@3x.jpg')).toBe(false);
    expect(redactor.hasPii('icon', 'logo@2x.svg')).toBe(false);
    expect(redactor.hasPii('asset', 'header@2x.webp')).toBe(false);
    expect(redactor.hasPii('media', 'badge@2x.gif')).toBe(false);
  });

  it('should redact email in URL query parameters', () => {
    const originalUrl = 'https://analytics.google.com/g/collect?v=2&tid=G-VVBCZC9JSW&ep.user_email=john.doe@tatvic.com&cid=123.456';
    const redacted = redactor.redactUrl(originalUrl);
    expect(redacted).toContain('ep.user_email=NA');
    expect(redacted).toContain('cid=123.456');
    expect(redacted).toContain('tid=G-VVBCZC9JSW');
    expect(redacted).not.toContain('john.doe@tatvic.com');
  });
});

describe('PII Redactor - Phone Number Detection & Redaction', () => {
  const redactor = new PiiRedactor();

  it('should redact 10-digit phone and mobile parameters', () => {
    expect(redactor.hasPii('phone', '9876543210')).toBe(true);
    expect(redactor.hasPii('mobile', '9876543210')).toBe(true);
    expect(redactor.hasPii('mobile_no', '9876543210')).toBe(true);
    expect(redactor.hasPii('phone_number', '9876543210')).toBe(true);
    expect(redactor.hasPii('mobilenumber', '9876543210')).toBe(true);
    expect(redactor.hasPii('ep.phone', '9876543210')).toBe(true);
    expect(redactor.hasPii('user_mobile', '9876543210')).toBe(true);
  });

  it('should redact inline key-value phone patterns (phone=9876543210, mobile: 9876543210)', () => {
    expect(redactor.hasPii('details', 'mobile: 9876543210')).toBe(true);
    expect(redactor.hasPii('data', 'phone=9876543210')).toBe(true);
    expect(redactor.hasPii('contact', 'mobile_no=9876543210')).toBe(true);
  });

  it('should NOT redact non-phone 10-digit identifiers (timestamps, session ids)', () => {
    expect(redactor.hasPii('sid', '1794835583')).toBe(false);
    expect(redactor.hasPii('timestamp', '1794835583')).toBe(false);
    expect(redactor.hasPii('_p', '1794836017')).toBe(false);
    expect(redactor.hasPii('order_id', '1000293847')).toBe(false);
  });
});

describe('PII Redactor - Body Payloads', () => {
  const redactor = new PiiRedactor();

  it('should redact GA4 multiline collect text/plain payloads', () => {
    const rawBody = [
      'en=page_view&ep.email=john.doe@tatvic.com&value=49.99&ep.phone=9876543210',
      'en=click&ep.email=alice%40example.com&button=signup&cid=555.666',
    ].join('\n');

    const redacted = redactor.redactBody(rawBody, 'text/plain');
    const lines = redacted.split('\n');

    expect(lines[0]).toBe('en=page_view&ep.email=NA&value=49.99&ep.phone=NA');
    expect(lines[1]).toBe('en=click&ep.email=NA&button=signup&cid=555.666');
    expect(redacted).not.toContain('john.doe@tatvic.com');
    expect(redacted).not.toContain('alice%40example.com');
    expect(redacted).not.toContain('9876543210');
  });

  it('should redact JSON body payloads while preserving clean parameters', () => {
    const jsonBody = JSON.stringify({
      event: 'generate_lead',
      user: {
        email: 'user@tatvic.com',
        phone_no: '9876543210',
        id: 'user_42',
      },
      metadata: {
        page: '/contact-us',
        photo: 'team@2x.png',
      },
    });

    const redacted = redactor.redactBody(jsonBody, 'application/json');
    const parsed = JSON.parse(redacted);

    expect(parsed.event).toBe('generate_lead');
    expect(parsed.user.email).toBe('NA');
    expect(parsed.user.phone_no).toBe('NA');
    expect(parsed.user.id).toBe('user_42');
    expect(parsed.metadata.page).toBe('/contact-us');
    expect(parsed.metadata.photo).toBe('team@2x.png');
  });
});

describe('ServerProxy - PII Redaction Integration', () => {
  it('should sanitize PII query parameters and POST body before forwarding upstream', async () => {
    let capturedUpstreamUrl: string = '';
    let capturedUpstreamBody: string = '';

    // Mock upstream fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUpstreamUrl = input.toString();
      if (init?.body) {
        capturedUpstreamBody = typeof init.body === 'string' ? init.body : '';
      }
      return new Response('OK', { status: 200 });
    }) as typeof globalThis.fetch;

    try {
      const handler = createProxyHandler({
        piiRedaction: true,
      });

      const incomingReq = new Request(
        'http://localhost:5005/_tatvic/relay?v=2&tid=G-VVBCZC9JSW&ep.user_email=jimit@tatvic.com&cid=111.222',
        {
          method: 'POST',
          headers: {
            'content-type': 'text/plain',
          },
          body: 'en=submit_form&phone=9876543210&currency=USD',
        }
      );

      const res = await handler(incomingReq);
      expect(res.status).toBe(200);

      // Verify query params on upstream URL
      expect(capturedUpstreamUrl).toContain('ep.user_email=NA');
      expect(capturedUpstreamUrl).toContain('cid=111.222');
      expect(capturedUpstreamUrl).not.toContain('jimit@tatvic.com');

      // Verify body payload forwarded upstream
      expect(capturedUpstreamBody).toContain('phone=NA');
      expect(capturedUpstreamBody).toContain('currency=USD');
      expect(capturedUpstreamBody).not.toContain('9876543210');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should allow custom replacement string (e.g. [REDACTED])', async () => {
    const redactor = new PiiRedactor({
      enabled: true,
      replacement: '[REDACTED]',
    });

    const url = 'https://google.com/test?email=test@domain.com&phone=9876543210&name=Sam';
    const redacted = redactor.redactUrl(url);

    expect(redacted).toContain('email=%5BREDACTED%5D'); // encoded [REDACTED]
    expect(redacted).toContain('phone=%5BREDACTED%5D');
    expect(redacted).toContain('name=Sam');
  });
});

describe('PII Redactor - window.dataLayer Integration', () => {
  let mockWindow: any;

  beforeEach(() => {
    mockWindow = {
      ...globalThis,
      dataLayer: [],
    };
    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('should redact email and phone PII when pushed to window.dataLayer', () => {
    const interceptor = new RequestInterceptor({
      piiRedaction: true,
    });
    interceptor.install();

    mockWindow.dataLayer.push({
      event: 'generate_lead',
      user_email: 'john.doe@tatvic.com',
      phone_number: '9876543210',
      value: 100,
    });

    expect(mockWindow.dataLayer.length).toBe(1);
    const item = mockWindow.dataLayer[0];
    expect(item.event).toBe('generate_lead');
    expect(item.user_email).toBe('NA');
    expect(item.phone_number).toBe('NA');
    expect(item.value).toBe(100);

    interceptor.uninstall();
  });

  it('should redact nested objects pushed to window.dataLayer', () => {
    const interceptor = new RequestInterceptor({
      piiRedaction: true,
    });
    interceptor.install();

    mockWindow.dataLayer.push({
      event: 'sign_up',
      profile: {
        email: 'alice%40example.com',
        phone: '9876543210',
        role: 'admin',
      },
    });

    const item = mockWindow.dataLayer[0];
    expect(item.profile.email).toBe('NA');
    expect(item.profile.phone).toBe('NA');
    expect(item.profile.role).toBe('admin');

    interceptor.uninstall();
  });

  it('should redact pre-existing items in dataLayer upon installation', () => {
    mockWindow.dataLayer.push({
      event: 'initial_load',
      email: 'pre_existing@domain.com',
      mobile: '9876543210',
    });

    const interceptor = new RequestInterceptor({
      piiRedaction: true,
    });
    interceptor.install();

    const item = mockWindow.dataLayer[0];
    expect(item.email).toBe('NA');
    expect(item.mobile).toBe('NA');

    interceptor.uninstall();
  });

  it('should preserve GTM listener when GTM overwrites dataLayer.push', () => {
    const interceptor = new RequestInterceptor({
      piiRedaction: true,
    });
    interceptor.install();

    const gtmReceivedEvents: any[] = [];
    // Simulate GTM attaching its own push listener
    mockWindow.dataLayer.push = function (eventObj: any) {
      gtmReceivedEvents.push(eventObj);
      return Array.prototype.push.call(mockWindow.dataLayer, eventObj);
    };

    mockWindow.dataLayer.push({
      event: 'gtm_tag_trigger',
      user_email: 'lead@tatvic.com',
      phone_no: '9876543210',
    });

    // Verify GTM's listener received sanitized data
    expect(gtmReceivedEvents.length).toBe(1);
    expect(gtmReceivedEvents[0].user_email).toBe('NA');
    expect(gtmReceivedEvents[0].phone_no).toBe('NA');

    interceptor.uninstall();
  });

  it('should redact Arguments object when gtag() pushes to dataLayer', () => {
    const interceptor = new RequestInterceptor({
      piiRedaction: true,
    });
    interceptor.install();

    function fakeGtag(...args: any[]) {
      mockWindow.dataLayer.push((function () {
        return arguments;
      }).apply(null, args as any));
    }

    fakeGtag('event', 'purchase', {
      customer_email: 'buyer@example.com',
      contact_number: '+91 9876543210',
      value: 299.99,
    });

    expect(mockWindow.dataLayer.length).toBe(1);
    const pushedArgs = mockWindow.dataLayer[0];
    expect(pushedArgs[0]).toBe('event');
    expect(pushedArgs[1]).toBe('purchase');
    expect(pushedArgs[2].customer_email).toBe('NA');
    expect(pushedArgs[2].contact_number).toBe('NA');
    expect(pushedArgs[2].value).toBe(299.99);

    interceptor.uninstall();
  });
});

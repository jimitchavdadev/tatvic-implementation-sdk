import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  isServerBot,
  isClientBot,
  getBypassedScriptResponse,
  createProxyHandler,
  RequestInterceptor,
} from '../src/index.js';

describe('Bot & LLM Agent Detection: Server-Side', () => {
  it('should detect low Cloudflare bot scores (<= 29)', () => {
    const req1 = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'cf-bot-score': '1' },
    });
    const res1 = isServerBot(req1);
    expect(res1.isBot).toBe(true);
    expect(res1.type).toBe('cf_score');
    expect(res1.score).toBe(1);

    const req2 = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'x-bot-score': '15' },
    });
    const res2 = isServerBot(req2);
    expect(res2.isBot).toBe(true);
    expect(res2.type).toBe('cf_score');
  });

  it('should allow legitimate traffic with high Cloudflare bot scores (>= 30)', () => {
    const req = new Request('https://example.com/_tatvic/loader.js', {
      headers: {
        'cf-bot-score': '85',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const res = isServerBot(req);
    expect(res.isBot).toBe(false);
  });

  it('should detect Cloudflare verified bot categories (AI Crawler, AI Search, AI Assistant)', () => {
    const aiCrawlerReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'cf-verified-bot-category': 'AI Crawler' },
    });
    expect(isServerBot(aiCrawlerReq).isBot).toBe(true);
    expect(isServerBot(aiCrawlerReq).type).toBe('cf_verified');

    const aiSearchReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'x-verified-bot-category': 'AI Search' },
    });
    expect(isServerBot(aiSearchReq).isBot).toBe(true);

    const searchEngineReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'cf-verified-bot-category': 'Search Engine Crawler' },
    });
    // Search engine crawlers are allowed by default for SEO indexing
    expect(isServerBot(searchEngineReq).isBot).toBe(false);

    // Can be blocked if blockSearchCrawlers is explicitly enabled
    expect(isServerBot(searchEngineReq, { blockSearchCrawlers: true }).isBot).toBe(true);
  });

  it('should detect popular AI Crawlers & LLM Agents by User-Agent', () => {
    const aiAgents = [
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +https://www.anthropic.com/claudebot)',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
      'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
      'CCBot/2.0 (https://commoncrawl.org/faq/)',
      'Google-Extended',
      'Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0; +https://developers.facebook.com/docs/sharing/webmasters/crawler)',
      'Amazonbot/0.1',
      'DeepSeekBot/1.0',
    ];

    for (const ua of aiAgents) {
      const req = new Request('https://example.com/_tatvic/loader.js', {
        headers: { 'user-agent': ua },
      });
      const res = isServerBot(req);
      expect(res.isBot).toBe(true);
      expect(res.type).toBe('ai_agent');
    }
  });

  it('should detect headless browsers & audit tools (Lighthouse, Puppeteer, Playwright)', () => {
    const automationUas = [
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Playwright/1.40.0',
    ];

    for (const ua of automationUas) {
      const req = new Request('https://example.com/_tatvic/loader.js', {
        headers: { 'user-agent': ua },
      });
      const res = isServerBot(req);
      expect(res.isBot).toBe(true);
      expect(res.type).toBe('automated_browser');
    }
  });

  it('should detect HTTP scrapers (curl, python-requests, Scrapy)', () => {
    const scraperUas = [
      'curl/8.4.0',
      'Wget/1.21.3',
      'python-requests/2.31.0',
      'Scrapy/2.11.0 (+https://scrapy.org)',
    ];

    for (const ua of scraperUas) {
      const req = new Request('https://example.com/_tatvic/loader.js', {
        headers: { 'user-agent': ua },
      });
      const res = isServerBot(req);
      expect(res.isBot).toBe(true);
      expect(res.type).toBe('http_scraper');
    }
  });

  it('should allow legitimate human browsers', () => {
    const humanUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const req = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': humanUa },
    });
    expect(isServerBot(req).isBot).toBe(false);
  });

  it('should honor custom allowlist patterns', () => {
    const req = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'MyInternalScraper/1.0' },
    });
    expect(isServerBot(req, { allowlistPatterns: ['MyInternalScraper'] }).isBot).toBe(false);
  });
});

describe('Bot & LLM Agent Detection: Server Proxy Bypass Behavior', () => {
  const handler = createProxyHandler();

  it('should return empty script stub with 200 OK for bot script requests', async () => {
    const req = new Request('http://localhost:5000/_tatvic/loader.js?cid=GTM-T32XGF8F', {
      headers: {
        'user-agent': 'GPTBot/1.0',
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    expect(res.headers.get('x-tatvic-bot-bypass')).toBe('true');

    const text = await res.text();
    expect(text).toContain('Automated agent detected');
    expect(text).toContain('script loading bypassed');
  });

  it('should return 204 No Content for bot telemetry relay requests', async () => {
    const req = new Request('http://localhost:5000/_tatvic/relay', {
      method: 'POST',
      headers: {
        'user-agent': 'Bytespider',
        'x-relay-target': 'https://www.google-analytics.com/g/collect?v=2',
      },
      body: 'en=page_view',
    });

    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('x-tatvic-bot-bypass')).toBe('true');
  });

  it('should NOT bypass when in Tag Assistant preview or debug mode', async () => {
    const req = new Request('http://localhost:5000/_tatvic/loader.js?cid=GTM-T32XGF8F&gtm_debug=1', {
      headers: {
        // Even if user-agent says Lighthouse or bot, debug flag takes priority
        'user-agent': 'Lighthouse',
      },
    });

    const res = await handler(req);
    // Should proceed to fetch and morph GTM rather than returning the bot bypass stub
    expect(res.headers.get('x-tatvic-bot-bypass')).toBeNull();
  });
});

describe('Bot & LLM Agent Detection: Client-Side Interceptor', () => {
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    globalThis.navigator = originalNavigator;
  });

  it('should detect navigator.webdriver = true on client', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, webdriver: true },
      configurable: true,
      writable: true,
    });

    const res = isClientBot();
    expect(res.isBot).toBe(true);
    expect(res.reason).toContain('navigator.webdriver is true');
  });

  it('should detect automation globals on window', () => {
    (globalThis as unknown as { __playwright__binding__: boolean }).__playwright__binding__ = true;
    const res = isClientBot();
    expect(res.isBot).toBe(true);
    expect(res.reason).toContain('window.__playwright__binding__');
    delete (globalThis as unknown as { __playwright__binding__?: boolean }).__playwright__binding__;
  });

  it('should suppress outgoing fetch telemetry when bot is detected in RequestInterceptor', async () => {
    let warnMsg = '';
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnMsg = args.join(' ');
      originalWarn(...args);
    };

    // Simulate automated browser environment
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, webdriver: true },
      configurable: true,
      writable: true,
    });

    const interceptor = new RequestInterceptor({
      proxyEndpoint: '/_tatvic/relay',
      targetDomains: ['google-analytics.com'],
    });
    interceptor.install();

    expect(warnMsg).toContain('Bot detected');
    expect(warnMsg).toContain('muting outgoing analytics telemetry');

    // Call fetch to targeted domain
    const res = await fetch('https://www.google-analytics.com/g/collect?v=2');
    expect(res.status).toBe(204);
    expect(res.headers.get('x-tatvic-bot-bypass')).toBe('true');

    interceptor.uninstall();
    console.warn = originalWarn;
  });

  it('should auto-append UTM parameters (source=llm_agent, medium=openai/anthropic/gemini) upon bot detection', () => {
    // 1. OpenAI (GPTBot)
    const gptReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' },
    });
    const gptRes = isServerBot(gptReq);
    expect(gptRes.isBot).toBe(true);
    expect(gptRes.utm).toBeDefined();
    expect(gptRes.utm!.utm_source).toBe('llm_agent');
    expect(gptRes.utm!.utm_medium).toBe('openai');

    // 2. Anthropic (ClaudeBot)
    const claudeReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 ClaudeBot/1.0; +claudebot@anthropic.com' },
    });
    const claudeRes = isServerBot(claudeReq);
    expect(claudeRes.isBot).toBe(true);
    expect(claudeRes.utm!.utm_source).toBe('llm_agent');
    expect(claudeRes.utm!.utm_medium).toBe('anthropic');

    // 3. Google Gemini
    const geminiReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Google-Extended/1.0 (Gemini training bot)' },
    });
    const geminiRes = isServerBot(geminiReq);
    expect(geminiRes.isBot).toBe(true);
    expect(geminiRes.utm!.utm_source).toBe('llm_agent');
    expect(geminiRes.utm!.utm_medium).toBe('gemini');

    // 4. Perplexity
    const perplexityReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'PerplexityBot/1.0' },
    });
    const perplexityRes = isServerBot(perplexityReq);
    expect(perplexityRes.isBot).toBe(true);
    expect(perplexityRes.utm!.utm_source).toBe('llm_agent');
    expect(perplexityRes.utm!.utm_medium).toBe('perplexity');

    // 5. ByteDance
    const byteReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Bytespider' },
    });
    const byteRes = isServerBot(byteReq);
    expect(byteRes.isBot).toBe(true);
    expect(byteRes.utm!.utm_source).toBe('llm_agent');
    expect(byteRes.utm!.utm_medium).toBe('bytedance');
  });

  it('should include UTM headers and dataLayer push script in getBypassedScriptResponse', async () => {
    const res = getBypassedScriptResponse('AI Agent / LLM Crawler detected (GPTBot)', {
      utm_source: 'llm_agent',
      utm_medium: 'openai',
    });
    expect(res.headers.get('x-tatvic-bot-bypass')).toBe('true');
    expect(res.headers.get('x-tatvic-bot-source')).toBe('llm_agent');
    expect(res.headers.get('x-tatvic-bot-medium')).toBe('openai');

    const text = await res.text();
    expect(text).toContain("utm_source: 'llm_agent'");
    expect(text).toContain("utm_medium: 'openai'");
    expect(text).toContain("event: 'bot_detected'");
  });
});

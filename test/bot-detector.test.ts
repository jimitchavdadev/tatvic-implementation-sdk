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

describe('Bot & LLM Agent Detection: Server Proxy Non-Blocking Attribution Behavior', () => {
  const handler = createProxyHandler();

  it('should serve morphed GTM script with injected bot dataLayer push and UTM headers for bot script requests', async () => {
    const req = new Request('http://localhost:5000/_tatvic/loader.js?cid=GTM-T32XGF8F', {
      headers: {
        'user-agent': 'GPTBot/1.0',
      },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    expect(res.headers.get('x-tatvic-bot-detected')).toBe('true');
    expect(res.headers.get('x-tatvic-bot-source')).toBe('gpt');
    expect(res.headers.get('x-tatvic-bot-medium')).toBe('crawler');

    const text = await res.text();
    expect(text).toContain('bot_detected');
    expect(text).toContain("utm_source: 'gpt'");
    expect(text).toContain("utm_medium: 'crawler'");
    // View is not blocked; full morphed container script is served
    expect(text).toContain('/_tatvic/relay?_tgt=');
  });

  it('should forward bot telemetry relay requests upstream with appended UTM parameters without blocking views', async () => {
    const req = new Request('http://localhost:5000/_tatvic/relay', {
      method: 'POST',
      headers: {
        'user-agent': 'Bytespider',
        'x-relay-target': 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&cid=123.456',
      },
      body: 'en=page_view',
    });

    const res = await handler(req);
    // Request is forwarded upstream (not dropped with 204 stub)
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('x-tatvic-bot-detected')).toBe('true');
    expect(res.headers.get('x-tatvic-bot-source')).toBe('bytedance');
    expect(res.headers.get('x-tatvic-bot-medium')).toBe('crawler');
  });

  it('should NOT flag as bot when in Tag Assistant preview or debug mode', async () => {
    const req = new Request('http://localhost:5000/_tatvic/loader.js?cid=GTM-T32XGF8F&gtm_debug=1', {
      headers: {
        // Even if user-agent says Lighthouse or bot, debug flag takes priority
        'user-agent': 'Lighthouse',
      },
    });

    const res = await handler(req);
    expect(res.headers.get('x-tatvic-bot-detected')).toBeNull();
  });
});

describe('Bot & LLM Agent Detection: Client-Side Interceptor', () => {
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
    (globalThis as any).window = globalThis as any;
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

  it('should NOT suppress outgoing fetch telemetry when bot is detected, but append UTM parameters', async () => {
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

    let interceptedUrl = '';
    let interceptedHeaders: Headers | undefined;
    const mockOriginalFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      interceptedUrl = typeof input === 'string' ? input : (input as Request).url;
      interceptedHeaders = new Headers(init?.headers);
      return new Response('OK', { status: 200 });
    };
    (globalThis as any).fetch = mockOriginalFetch;

    const interceptor = new RequestInterceptor({
      proxyEndpoint: '/_tatvic/relay',
      targetDomains: ['google-analytics.com'],
    });
    interceptor.install();

    expect(warnMsg).toContain('Bot detected');
    expect(warnMsg).toContain('Attributing telemetry');

    // Call fetch to targeted domain
    const res = await (globalThis as any).fetch('https://www.google-analytics.com/g/collect?v=2');
    expect(res.status).toBe(200);
    // Verified that URL carried bot attribution parameters
    expect(interceptedUrl).toContain('cs=headless_browser');
    expect(interceptedUrl).toContain('cm=automation');
    expect(interceptedHeaders?.get('x-tatvic-bot-source')).toBe('headless_browser');
    expect(interceptedHeaders?.get('x-tatvic-bot-medium')).toBe('automation');

    interceptor.uninstall();
    console.warn = originalWarn;
  });

  it('should auto-append UTM parameters (source e.g. gpt/gemini, medium e.g. assistant/agent/crawler) upon bot detection', () => {
    // 1. OpenAI (GPTBot -> gpt / crawler)
    const gptReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)' },
    });
    const gptRes = isServerBot(gptReq);
    expect(gptRes.isBot).toBe(true);
    expect(gptRes.utm).toBeDefined();
    expect(gptRes.utm!.utm_source).toBe('gpt');
    expect(gptRes.utm!.utm_medium).toBe('crawler');

    // 1b. OpenAI (ChatGPT-User -> gpt / assistant)
    const chatGptUserReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)' },
    });
    const chatGptUserRes = isServerBot(chatGptUserReq);
    expect(chatGptUserRes.utm!.utm_source).toBe('gpt');
    expect(chatGptUserRes.utm!.utm_medium).toBe('assistant');

    // 1c. OpenAI (OAI-SearchBot -> gpt / agent)
    const oaiSearchReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'OAI-SearchBot/1.0' },
    });
    const oaiSearchRes = isServerBot(oaiSearchReq);
    expect(oaiSearchRes.utm!.utm_source).toBe('gpt');
    expect(oaiSearchRes.utm!.utm_medium).toBe('agent');

    // 2. Anthropic (ClaudeBot -> claude / crawler)
    const claudeReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 ClaudeBot/1.0; +claudebot@anthropic.com' },
    });
    const claudeRes = isServerBot(claudeReq);
    expect(claudeRes.isBot).toBe(true);
    expect(claudeRes.utm!.utm_source).toBe('claude');
    expect(claudeRes.utm!.utm_medium).toBe('crawler');

    // 2b. Anthropic (Claude-User -> claude / assistant)
    const claudeUserReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Claude-User/1.0' },
    });
    expect(isServerBot(claudeUserReq).utm!.utm_source).toBe('claude');
    expect(isServerBot(claudeUserReq).utm!.utm_medium).toBe('assistant');

    // 2c. Anthropic (Claude-SearchBot -> claude / agent)
    const claudeSearchReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Claude-SearchBot/1.0' },
    });
    expect(isServerBot(claudeSearchReq).utm!.utm_source).toBe('claude');
    expect(isServerBot(claudeSearchReq).utm!.utm_medium).toBe('agent');

    // 3. Google Gemini (Google-Extended -> gemini / crawler)
    const geminiReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Google-Extended/1.0 (Gemini training bot)' },
    });
    const geminiRes = isServerBot(geminiReq);
    expect(geminiRes.isBot).toBe(true);
    expect(geminiRes.utm!.utm_source).toBe('gemini');
    expect(geminiRes.utm!.utm_medium).toBe('crawler');

    // 3b. Google Gemini (Gemini assistant -> gemini / assistant)
    const geminiAssistantReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Gemini/2.0; +https://google.com)' },
    });
    expect(isServerBot(geminiAssistantReq).utm!.utm_source).toBe('gemini');
    expect(isServerBot(geminiAssistantReq).utm!.utm_medium).toBe('assistant');

    // 4. Perplexity (PerplexityBot -> perplexity / agent)
    const perplexityReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'PerplexityBot/1.0' },
    });
    const perplexityRes = isServerBot(perplexityReq);
    expect(perplexityRes.isBot).toBe(true);
    expect(perplexityRes.utm!.utm_source).toBe('perplexity');
    expect(perplexityRes.utm!.utm_medium).toBe('agent');

    // 4b. Perplexity (Perplexity-User -> perplexity / assistant)
    const perplexityUserReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Perplexity-User/1.0' },
    });
    expect(isServerBot(perplexityUserReq).utm!.utm_source).toBe('perplexity');
    expect(isServerBot(perplexityUserReq).utm!.utm_medium).toBe('assistant');

    // 5. ByteDance (Bytespider -> bytedance / crawler)
    const byteReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Bytespider' },
    });
    const byteRes = isServerBot(byteReq);
    expect(byteRes.isBot).toBe(true);
    expect(byteRes.utm!.utm_source).toBe('bytedance');
    expect(byteRes.utm!.utm_medium).toBe('crawler');

    // 6. Meta AI (Meta-ExternalFetcher -> meta / agent, FacebookBot -> meta / crawler)
    const metaFetcherReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Meta-ExternalFetcher/1.0' },
    });
    expect(isServerBot(metaFetcherReq).utm!.utm_source).toBe('meta');
    expect(isServerBot(metaFetcherReq).utm!.utm_medium).toBe('agent');

    const metaCrawlerReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'FacebookBot/1.0' },
    });
    expect(isServerBot(metaCrawlerReq).utm!.utm_source).toBe('meta');
    expect(isServerBot(metaCrawlerReq).utm!.utm_medium).toBe('crawler');

    // 7. DeepSeek (DeepSeekBot -> deepseek / crawler)
    const deepseekReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'DeepSeekBot/1.0' },
    });
    expect(isServerBot(deepseekReq).utm!.utm_source).toBe('deepseek');
    expect(isServerBot(deepseekReq).utm!.utm_medium).toBe('crawler');

    // 8. Lighthouse -> lighthouse / audit
    const lighthouseReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'Chrome-Lighthouse' },
    });
    expect(isServerBot(lighthouseReq).utm!.utm_source).toBe('lighthouse');
    expect(isServerBot(lighthouseReq).utm!.utm_medium).toBe('audit');

    // 9. Scraper (curl -> curl / scraper)
    const curlReq = new Request('https://example.com/_tatvic/loader.js', {
      headers: { 'user-agent': 'curl/8.4.0' },
    });
    expect(isServerBot(curlReq).utm!.utm_source).toBe('curl');
    expect(isServerBot(curlReq).utm!.utm_medium).toBe('scraper');
  });

  it('should include UTM headers and dataLayer push script in getBypassedScriptResponse', async () => {
    const res = getBypassedScriptResponse('AI Agent / LLM Crawler detected (GPTBot)', {
      utm_source: 'gpt',
      utm_medium: 'crawler',
    });
    expect(res.headers.get('x-tatvic-bot-bypass')).toBe('true');
    expect(res.headers.get('x-tatvic-bot-source')).toBe('gpt');
    expect(res.headers.get('x-tatvic-bot-medium')).toBe('crawler');

    const text = await res.text();
    expect(text).toContain("utm_source: 'gpt'");
    expect(text).toContain("utm_medium: 'crawler'");
    expect(text).toContain("event: 'bot_detected'");
  });
});

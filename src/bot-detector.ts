import type { BotDetectionOptions, BotDetectionResult, BotUtmParams } from './types.js';

export const AI_BOT_PATTERNS: RegExp[] = [
  /GPTBot/i,
  /ChatGPT/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /Claude-Web/i,
  /Claude-User/i,
  /Claude-SearchBot/i,
  /Claude/i,
  /anthropic-ai/i,
  /PerplexityBot/i,
  /Perplexity-User/i,
  /Perplexity/i,
  /Bytespider/i,
  /CCBot/i,
  /Google-Extended/i,
  /Google-CloudVertexBot/i,
  /Google-InspectionTool/i,
  /Gemini/i,
  /Copilot/i,
  /Meta-ExternalAgent/i,
  /Meta-ExternalFetcher/i,
  /Meta-WebIndexer/i,
  /FacebookBot/i,
  /Amazonbot/i,
  /Applebot-Extended/i,
  /Applebot/i,
  /DuckAssistBot/i,
  /MistralBot/i,
  /MistralAI-User/i,
  /cohere-ai/i,
  /Diffbot/i,
  /YouBot/i,
  /PetalBot/i,
  /Timpibot/i,
  /DataForSeoBot/i,
  /BLEXBot/i,
  /SemanticScholarBot/i,
  /webz\.io/i,
  /Meltwater/i,
  /Omgili/i,
  /ScoutJet/i,
  /DeepSeek/i,
];

export const AUTOMATED_BROWSER_PATTERNS: RegExp[] = [
  /HeadlessChrome/i,
  /Chrome-Lighthouse/i,
  /Lighthouse/i,
  /PageSpeed/i,
  /Puppeteer/i,
  /Playwright/i,
  /Selenium/i,
  /PhantomJS/i,
  /WebDriver/i,
  /Nightwatch/i,
  /Cypress/i,
];

export const HTTP_SCRAPER_PATTERNS: RegExp[] = [
  /curl\//i,
  /Wget\//i,
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /httpx/i,
  /Scrapy/i,
  /Go-http-client/i,
  /node-fetch/i,
  /axios\//i,
  /Apache-HttpClient/i,
  /Java\//i,
  /libwww-perl/i,
  /PostmanRuntime/i,
];

export const SEARCH_CRAWLER_PATTERNS: RegExp[] = [
  /Googlebot/i,
  /bingbot/i,
  /YandexBot/i,
  /DuckDuckBot/i,
  /Baiduspider/i,
  /Sogou/i,
  /Applebot(?!-Extended)/i,
];

export const CF_AI_CATEGORIES: string[] = [
  'ai crawler',
  'ai assistant',
  'ai search',
  'training',
  'scraper',
];

export const AUTOMATION_WINDOW_GLOBALS: string[] = [
  '__playwright__binding__',
  '__puppeteer_evaluation_script__',
  '_Selenium_IDE_Recorder',
  '__webdriver_evaluate',
  '__webdriver_script_fn',
  '__webdriver_script_func',
  'domAutomation',
  'domAutomationController',
  'callPhantom',
  '_phantom',
  'cdc_adoQpoasnfa76pfcZLmcfl_Array',
];

export const DEFAULT_BOT_OPTIONS: Required<BotDetectionOptions> = {
  enabled: true,
  blockAiAgents: true,
  blockAutomatedBrowsers: true,
  blockHttpScrapers: true,
  blockSearchCrawlers: false,
  botScoreThreshold: 29,
  customBotPatterns: [],
  allowlistPatterns: [],
};

/**
 * Resolves automated bot, LLM crawler, or synthetic agent identification into standardized UTM parameters.
 * Classification Taxonomy (based on industry AI crawler & assistant standards):
 * - utm_source: the specific platform or engine (e.g. gpt, gemini, claude, perplexity, copilot, meta, apple, bytedance, deepseek, mistral)
 * - utm_medium: the functional role or activity (e.g. assistant, agent, crawler, search, audit, automation, scraper)
 */
export function getBotUtmParams(userAgent: string, botResult?: BotDetectionResult): BotUtmParams {
  const ua = (userAgent || '').toLowerCase();
  const category = (botResult?.category || '').toLowerCase();

  // 1. OpenAI (ChatGPT / GPTBot / OAI-SearchBot)
  if (ua.includes('gptbot') || ua.includes('chatgpt') || ua.includes('oai-searchbot') || ua.includes('openai')) {
    const source = 'gpt';
    let medium = 'crawler';
    if (ua.includes('chatgpt-user') || ua.includes('chatgpt') || category.includes('assistant')) {
      medium = 'assistant';
    } else if (ua.includes('oai-searchbot') || category.includes('search') || category.includes('agent')) {
      medium = 'agent';
    } else if (ua.includes('gptbot')) {
      medium = 'crawler';
    }
    return { utm_source: source, utm_medium: medium };
  }

  // 2. Google Gemini / Vertex / Extended
  if (ua.includes('gemini') || ua.includes('google-extended') || ua.includes('vertexbot') || ua.includes('google-cloudvertexbot')) {
    const source = 'gemini';
    let medium = 'crawler';
    if (ua.includes('gemini') && !ua.includes('extended')) {
      medium = 'assistant';
    } else if (ua.includes('vertexbot') || ua.includes('cloudvertex')) {
      medium = 'agent';
    }
    return { utm_source: source, utm_medium: medium };
  }

  // 3. Anthropic Claude (ClaudeBot / Claude-User / Claude-SearchBot)
  if (ua.includes('claudebot') || ua.includes('claude') || ua.includes('anthropic')) {
    const source = 'claude';
    let medium = 'crawler';
    if (ua.includes('claude-user') || category.includes('assistant')) {
      medium = 'assistant';
    } else if (ua.includes('claude-searchbot') || ua.includes('claude-web') || category.includes('search') || category.includes('agent')) {
      medium = 'agent';
    }
    return { utm_source: source, utm_medium: medium };
  }

  // 4. Perplexity AI
  if (ua.includes('perplexity')) {
    const source = 'perplexity';
    const medium = ua.includes('perplexity-user') || category.includes('assistant') ? 'assistant' : 'agent';
    return { utm_source: source, utm_medium: medium };
  }

  // 5. Microsoft Copilot / Bing
  if (ua.includes('copilot') || ua.includes('bing-copilot')) {
    return { utm_source: 'copilot', utm_medium: 'assistant' };
  }

  // 6. Meta AI (Meta-ExternalAgent / Meta-ExternalFetcher / FacebookBot)
  if (ua.includes('meta-external') || ua.includes('facebookbot') || ua.includes('meta-webindexer')) {
    const source = 'meta';
    const medium = ua.includes('externalfetcher') || ua.includes('webindexer') ? 'agent' : 'crawler';
    return { utm_source: source, utm_medium: medium };
  }

  // 7. Apple Intelligence / Applebot
  if (ua.includes('applebot-extended')) {
    return { utm_source: 'apple', utm_medium: 'crawler' };
  }
  if (ua.includes('applebot')) {
    return { utm_source: 'apple', utm_medium: 'search' };
  }

  // 8. ByteDance (Bytespider)
  if (ua.includes('bytespider') || ua.includes('bytedance')) {
    return { utm_source: 'bytedance', utm_medium: 'crawler' };
  }

  // 9. Mistral AI
  if (ua.includes('mistral')) {
    const source = 'mistral';
    const medium = ua.includes('mistralai-user') ? 'assistant' : 'crawler';
    return { utm_source: source, utm_medium: medium };
  }

  // 10. DeepSeek
  if (ua.includes('deepseek')) {
    return { utm_source: 'deepseek', utm_medium: 'crawler' };
  }

  // 11. Amazon
  if (ua.includes('amazonbot')) {
    return { utm_source: 'amazon', utm_medium: 'crawler' };
  }

  // 12. DuckDuckGo AI / Search
  if (ua.includes('duckassistbot')) {
    return { utm_source: 'duckduckgo', utm_medium: 'assistant' };
  }
  if (ua.includes('duckduckbot')) {
    return { utm_source: 'duckduckgo', utm_medium: 'search' };
  }

  // 13. Cohere
  if (ua.includes('cohere')) {
    return { utm_source: 'cohere', utm_medium: 'crawler' };
  }

  // 14. Common Crawl
  if (ua.includes('ccbot')) {
    return { utm_source: 'commoncrawl', utm_medium: 'crawler' };
  }

  // 15. Traditional Search Engine Crawlers
  if (ua.includes('googlebot')) {
    return { utm_source: 'googlebot', utm_medium: 'search' };
  }
  if (ua.includes('bingbot')) {
    return { utm_source: 'bingbot', utm_medium: 'search' };
  }
  if (ua.includes('yandexbot')) {
    return { utm_source: 'yandex', utm_medium: 'search' };
  }
  if (ua.includes('baiduspider')) {
    return { utm_source: 'baidu', utm_medium: 'search' };
  }

  // 16. Audit / Performance Tools (Lighthouse, PageSpeed, etc.)
  if (ua.includes('lighthouse') || ua.includes('pagespeed') || ua.includes('chrome-lighthouse')) {
    return { utm_source: 'lighthouse', utm_medium: 'audit' };
  }

  // 17. Headless Browser Automation (Puppeteer, Playwright, Selenium, WebDriver)
  if (
    ua.includes('headlesschrome') ||
    ua.includes('puppeteer') ||
    ua.includes('playwright') ||
    ua.includes('selenium') ||
    ua.includes('webdriver') ||
    ua.includes('phantomjs') ||
    ua.includes('cypress') ||
    botResult?.type === 'automated_browser'
  ) {
    return { utm_source: 'headless_browser', utm_medium: 'automation' };
  }

  // 18. HTTP Scrapers / CLI tools
  if (ua.includes('curl/')) {
    return { utm_source: 'curl', utm_medium: 'scraper' };
  }
  if (ua.includes('python-requests') || ua.includes('python-urllib') || ua.includes('aiohttp') || ua.includes('httpx')) {
    return { utm_source: 'python', utm_medium: 'scraper' };
  }
  if (ua.includes('scrapy')) {
    return { utm_source: 'scrapy', utm_medium: 'scraper' };
  }
  if (ua.includes('wget/')) {
    return { utm_source: 'wget', utm_medium: 'scraper' };
  }
  if (ua.includes('postmanruntime')) {
    return { utm_source: 'postman', utm_medium: 'scraper' };
  }
  if (botResult?.type === 'http_scraper') {
    return { utm_source: 'scraper', utm_medium: 'scraper' };
  }

  // 19. Cloudflare Verified Bot Categories
  if (category) {
    if (category.includes('assistant')) {
      return { utm_source: 'cf_bot', utm_medium: 'assistant' };
    }
    if (category.includes('search')) {
      return { utm_source: 'cf_bot', utm_medium: 'agent' };
    }
    if (category.includes('crawler') || category.includes('training')) {
      return { utm_source: 'cf_bot', utm_medium: 'crawler' };
    }
    if (category.includes('scraper')) {
      return { utm_source: 'cf_bot', utm_medium: 'scraper' };
    }
  }

  // 20. Cloudflare Low Bot Score Fallback
  if (botResult?.type === 'cf_score') {
    return { utm_source: 'automated_bot', utm_medium: 'agent' };
  }

  // 21. Default Fallback
  const isAi = botResult?.type === 'ai_agent' || category.includes('ai');
  return {
    utm_source: isAi ? 'ai_bot' : 'bot',
    utm_medium: isAi ? 'agent' : 'automation',
  };
}

function formatBotResult(result: BotDetectionResult, userAgent: string): BotDetectionResult {
  if (result.isBot) {
    result.utm = getBotUtmParams(userAgent, result);
  }
  return result;
}
export function resolveBotOptions(options?: boolean | BotDetectionOptions): Required<BotDetectionOptions> {
  if (options === false) {
    return { ...DEFAULT_BOT_OPTIONS, enabled: false };
  }
  if (options === true || options === undefined) {
    return { ...DEFAULT_BOT_OPTIONS, enabled: true };
  }
  return {
    enabled: options.enabled ?? true,
    blockAiAgents: options.blockAiAgents ?? true,
    blockAutomatedBrowsers: options.blockAutomatedBrowsers ?? true,
    blockHttpScrapers: options.blockHttpScrapers ?? true,
    blockSearchCrawlers: options.blockSearchCrawlers ?? false,
    botScoreThreshold: options.botScoreThreshold ?? 29,
    customBotPatterns: options.customBotPatterns ?? [],
    allowlistPatterns: options.allowlistPatterns ?? [],
  };
}

/**
 * Evaluates whether an incoming HTTP request is from an automated bot, LLM crawler,
 * or scraping agent.
 *
 * Checks:
 * 1. Cloudflare Bot Management score (`cf-bot-score`, `x-bot-score`, or `request.cf.botManagement.score`).
 * 2. Cloudflare Verified Bot Category (`cf-verified-bot-category`, `x-bot-category`, etc.).
 * 3. AI Agent and LLM Crawler User-Agents (GPTBot, ClaudeBot, PerplexityBot, Bytespider, etc.).
 * 4. Automated browser tools (Lighthouse, HeadlessChrome, Puppeteer, Playwright).
 * 5. CLI & script scrapers (curl, python-requests, Scrapy).
 */
export function isServerBot(
  request: Request,
  optionsConfig?: boolean | BotDetectionOptions
): BotDetectionResult {
  const opts = resolveBotOptions(optionsConfig);
  if (!opts.enabled) {
    return { isBot: false };
  }

  const userAgent = request.headers.get('user-agent') || '';

  // 1. Allowlist override
  if (matchesAnyPattern(userAgent, opts.allowlistPatterns)) {
    return { isBot: false };
  }

  // 2. Custom bot patterns override
  if (matchesAnyPattern(userAgent, opts.customBotPatterns)) {
    return formatBotResult({
      isBot: true,
      reason: 'Matched custom bot pattern',
      type: 'custom_rule',
    }, userAgent);
  }

  // 3. Cloudflare Bot Management Score (1-99)
  // Low score (<= 29) indicates automated traffic.
  const scoreHeader =
    request.headers.get('cf-bot-score') ||
    request.headers.get('x-bot-score') ||
    request.headers.get('x-amzn-waf-bot-score');

  let botScore: number | undefined;
  if (scoreHeader) {
    const parsed = parseInt(scoreHeader, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 99) {
      botScore = parsed;
    }
  }

  // Check request.cf object if running directly in Cloudflare Workers
  const cfObj = (request as unknown as { cf?: { botManagement?: { score?: number; verifiedBot?: boolean } } }).cf;
  if (botScore === undefined && cfObj?.botManagement?.score !== undefined) {
    botScore = cfObj.botManagement.score;
  }

  // 4. Cloudflare Verified Bot Category
  const categoryHeader =
    request.headers.get('cf-verified-bot-category') ||
    request.headers.get('x-verified-bot-category') ||
    request.headers.get('x-bot-category');

  const cfCategory =
    categoryHeader ||
    (request as unknown as { cf?: { verifiedBotCategory?: string } }).cf?.verifiedBotCategory;

  if (cfCategory) {
    const cleanCat = cfCategory.toLowerCase().trim();

    // Check if category matches AI Crawler, AI Assistant, AI Search, or Scraper
    if (opts.blockAiAgents && CF_AI_CATEGORIES.some((c) => cleanCat.includes(c))) {
      return formatBotResult({
        isBot: true,
        category: cfCategory,
        reason: `Cloudflare verified bot category: ${cfCategory}`,
        type: 'cf_verified',
      }, userAgent);
    }

    // Check search engine category
    if (cleanCat.includes('search') && !cleanCat.includes('ai search')) {
      if (opts.blockSearchCrawlers) {
        return formatBotResult({
          isBot: true,
          category: cfCategory,
          reason: `Cloudflare verified search crawler: ${cfCategory}`,
          type: 'search_crawler',
        }, userAgent);
      } else {
        // Explicitly allow legitimate search engines if blockSearchCrawlers is false
        return { isBot: false, category: cfCategory };
      }
    }
  }

  // Evaluate bot score threshold
  if (botScore !== undefined && botScore <= opts.botScoreThreshold) {
    return formatBotResult({
      isBot: true,
      score: botScore,
      reason: `Cloudflare bot score ${botScore} <= threshold ${opts.botScoreThreshold}`,
      type: 'cf_score',
    }, userAgent);
  }

  // 5. User-Agent Pattern Checks
  if (opts.blockAiAgents) {
    const matched = findMatchingPattern(userAgent, AI_BOT_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `AI Agent / LLM Crawler detected (${matched})`,
        type: 'ai_agent',
      }, userAgent);
    }
  }

  if (opts.blockAutomatedBrowsers) {
    const matched = findMatchingPattern(userAgent, AUTOMATED_BROWSER_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `Automated browser detected (${matched})`,
        type: 'automated_browser',
      }, userAgent);
    }
  }

  if (opts.blockHttpScrapers) {
    const matched = findMatchingPattern(userAgent, HTTP_SCRAPER_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `HTTP scraping client detected (${matched})`,
        type: 'http_scraper',
      }, userAgent);
    }
  }

  if (opts.blockSearchCrawlers) {
    const matched = findMatchingPattern(userAgent, SEARCH_CRAWLER_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `Search engine crawler detected (${matched})`,
        type: 'search_crawler',
      }, userAgent);
    }
  }

  return { isBot: false };
}

/**
 * Evaluates whether the current browser client execution environment is an automated
 * headless browser, synthetic agent, or audit bot (such as Google Lighthouse).
 */
export function isClientBot(optionsConfig?: boolean | BotDetectionOptions): BotDetectionResult {
  if (typeof window === 'undefined') {
    return { isBot: false };
  }

  const opts = resolveBotOptions(optionsConfig);
  if (!opts.enabled) {
    return { isBot: false };
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  // 1. Allowlist override
  if (matchesAnyPattern(userAgent, opts.allowlistPatterns)) {
    return { isBot: false };
  }

  // 2. Custom patterns override
  if (matchesAnyPattern(userAgent, opts.customBotPatterns)) {
    return formatBotResult({
      isBot: true,
      reason: 'Matched custom bot pattern',
      type: 'custom_rule',
    }, userAgent);
  }

  // 3. navigator.webdriver
  if (opts.blockAutomatedBrowsers && typeof navigator !== 'undefined' && navigator.webdriver === true) {
    return formatBotResult({
      isBot: true,
      reason: 'navigator.webdriver is true',
      type: 'automated_browser',
    }, userAgent);
  }

  // 4. Known automation window globals
  if (opts.blockAutomatedBrowsers) {
    for (const key of AUTOMATION_WINDOW_GLOBALS) {
      if (key in window && (window as unknown as Record<string, unknown>)[key] !== undefined) {
        return formatBotResult({
          isBot: true,
          reason: `Automation global found: window.${key}`,
          type: 'automated_browser',
        }, userAgent);
      }
    }

    if (
      typeof document !== 'undefined' &&
      ('$cdc_asdjflasutopfhvcZLmcfl_' in document || '__webdriver_evaluate' in document)
    ) {
      return formatBotResult({
        isBot: true,
        reason: 'Selenium DOM automation artifact detected',
        type: 'automated_browser',
      }, userAgent);
    }
  }

  // 5. User-Agent heuristics in browser
  if (opts.blockAutomatedBrowsers) {
    const matched = findMatchingPattern(userAgent, AUTOMATED_BROWSER_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `Automated browser detected (${matched})`,
        type: 'automated_browser',
      }, userAgent);
    }
  }

  if (opts.blockAiAgents) {
    const matched = findMatchingPattern(userAgent, AI_BOT_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `AI Agent / LLM Crawler detected (${matched})`,
        type: 'ai_agent',
      }, userAgent);
    }
  }

  if (opts.blockHttpScrapers) {
    const matched = findMatchingPattern(userAgent, HTTP_SCRAPER_PATTERNS);
    if (matched) {
      return formatBotResult({
        isBot: true,
        reason: `Scraping user-agent detected (${matched})`,
        type: 'http_scraper',
      }, userAgent);
    }
  }

  return { isBot: false };
}

/**
 * Generates a lightweight, empty JavaScript response to serve to bots.
 * This satisfies script loading without downloading, parsing, or executing heavy tracking tags,
 * and auto-attaches standardized UTM attribution (source and medium) to the response and dataLayer.
 */
export function getBypassedScriptResponse(reason?: string, utm?: BotUtmParams): Response {
  const safeReason = (reason ?? 'Automated bot').replace(/[\r\n"']/g, ' ');
  const utmSource = utm?.utm_source ?? 'bot';
  const utmMedium = utm?.utm_medium ?? 'agent';

  const code = `/* [Tatvic SDK] 🤖 Automated agent detected (${safeReason}).
 * Auto-appended attribution: utm_source=${utmSource}&utm_medium=${utmMedium}
 * Analytics script loading bypassed to optimize page speed and protect analytics data.
 */
if (typeof console !== 'undefined' && console.warn) {
  console.warn("[Tatvic SDK] 🤖 Bot detected: ${safeReason}. Attributed with utm_source=${utmSource}, utm_medium=${utmMedium}.");
}
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'bot_detected',
    utm_source: '${utmSource}',
    utm_medium: '${utmMedium}',
    bot_reason: '${safeReason}'
  });
}
`;

  return new Response(code, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Tatvic-Bot-Bypass': 'true',
      'X-Tatvic-Bot-Reason': safeReason,
      'X-Tatvic-Bot-Source': utmSource,
      'X-Tatvic-Bot-Medium': utmMedium,
    },
  });
}

function matchesAnyPattern(text: string, patterns: (string | RegExp)[]): boolean {
  for (const p of patterns) {
    if (p instanceof RegExp) {
      if (p.test(text)) return true;
    } else {
      if (text.toLowerCase().includes(p.toLowerCase())) return true;
    }
  }
  return false;
}

function findMatchingPattern(text: string, patterns: RegExp[]): string | null {
  for (const regex of patterns) {
    const m = text.match(regex);
    if (m) return m[0];
  }
  return null;
}

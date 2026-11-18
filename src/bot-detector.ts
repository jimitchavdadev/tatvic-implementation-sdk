import type { BotDetectionOptions, BotDetectionResult, BotUtmParams } from './types.js';

export const AI_BOT_PATTERNS: RegExp[] = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /Claude-Web/i,
  /Claude-User/i,
  /anthropic-ai/i,
  /PerplexityBot/i,
  /Perplexity-User/i,
  /Bytespider/i,
  /CCBot/i,
  /Google-Extended/i,
  /Google-CloudVertexBot/i,
  /Google-InspectionTool/i,
  /Gemini/i,
  /Meta-ExternalAgent/i,
  /Meta-ExternalFetcher/i,
  /FacebookBot/i,
  /Amazonbot/i,
  /Applebot-Extended/i,
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
 * - OpenAI (GPTBot, ChatGPT)  -> utm_source=llm_agent, utm_medium=openai, utm_campaign=gptbot
 * - Anthropic (ClaudeBot)     -> utm_source=llm_agent, utm_medium=anthropic, utm_campaign=claudebot
 * - Google Gemini / Vertex    -> utm_source=llm_agent, utm_medium=gemini, utm_campaign=google_gemini
 * - Perplexity                -> utm_source=llm_agent, utm_medium=perplexity, utm_campaign=perplexitybot
 * - ByteDance (Bytespider)    -> utm_source=llm_agent, utm_medium=bytedance, utm_campaign=bytespider
 * - Meta AI                   -> utm_source=llm_agent, utm_medium=meta, utm_campaign=meta_agent
 * - DeepSeek                  -> utm_source=llm_agent, utm_medium=deepseek, utm_campaign=deepseek
 * - Applebot-Extended         -> utm_source=llm_agent, utm_medium=apple, utm_campaign=applebot_extended
 * - Mistral                   -> utm_source=llm_agent, utm_medium=mistral, utm_campaign=mistralbot
 * - Lighthouse / PageSpeed    -> utm_source=bot, utm_medium=lighthouse, utm_campaign=pagespeed_audit
 * - Headless browser runner   -> utm_source=bot, utm_medium=headless_browser, utm_campaign=browser_automation
 * - Script / HTTP scraper     -> utm_source=bot, utm_medium=http_scraper, utm_campaign=script_client
 */
export function getBotUtmParams(userAgent: string, botResult?: BotDetectionResult): BotUtmParams {
  const ua = (userAgent || '').toLowerCase();

  // 1. OpenAI (GPTBot, ChatGPT, OAI-SearchBot)
  if (ua.includes('gptbot') || ua.includes('chatgpt') || ua.includes('oai-searchbot') || ua.includes('openai')) {
    return { utm_source: 'llm_agent', utm_medium: 'openai', utm_campaign: 'gptbot' };
  }

  // 2. Anthropic (ClaudeBot, Claude-Web, Claude-User, anthropic-ai)
  if (ua.includes('claudebot') || ua.includes('claude') || ua.includes('anthropic')) {
    return { utm_source: 'llm_agent', utm_medium: 'anthropic', utm_campaign: 'claudebot' };
  }

  // 3. Google Gemini / Vertex
  if (ua.includes('google-extended') || ua.includes('vertexbot') || ua.includes('gemini')) {
    return { utm_source: 'llm_agent', utm_medium: 'gemini', utm_campaign: 'google_gemini' };
  }

  // 4. Perplexity
  if (ua.includes('perplexity')) {
    return { utm_source: 'llm_agent', utm_medium: 'perplexity', utm_campaign: 'perplexitybot' };
  }

  // 5. ByteDance
  if (ua.includes('bytespider')) {
    return { utm_source: 'llm_agent', utm_medium: 'bytedance', utm_campaign: 'bytespider' };
  }

  // 6. DeepSeek
  if (ua.includes('deepseek')) {
    return { utm_source: 'llm_agent', utm_medium: 'deepseek', utm_campaign: 'deepseek' };
  }

  // 7. Meta AI
  if (ua.includes('meta-external') || ua.includes('facebookbot')) {
    return { utm_source: 'llm_agent', utm_medium: 'meta', utm_campaign: 'meta_agent' };
  }

  // 8. Applebot-Extended
  if (ua.includes('applebot-extended')) {
    return { utm_source: 'llm_agent', utm_medium: 'apple', utm_campaign: 'applebot_extended' };
  }

  // 9. Mistral
  if (ua.includes('mistral')) {
    return { utm_source: 'llm_agent', utm_medium: 'mistral', utm_campaign: 'mistralbot' };
  }

  // 10. Cohere
  if (ua.includes('cohere')) {
    return { utm_source: 'llm_agent', utm_medium: 'cohere', utm_campaign: 'cohere_ai' };
  }

  // 11. Common Crawl
  if (ua.includes('ccbot')) {
    return { utm_source: 'llm_agent', utm_medium: 'common_crawl', utm_campaign: 'ccbot' };
  }

  // 12. Automated Lighthouse / Audits
  if (ua.includes('lighthouse') || ua.includes('pagespeed')) {
    return { utm_source: 'bot', utm_medium: 'lighthouse', utm_campaign: 'pagespeed_audit' };
  }

  // 13. Headless Browsers
  if (
    ua.includes('headlesschrome') ||
    ua.includes('puppeteer') ||
    ua.includes('playwright') ||
    ua.includes('selenium') ||
    botResult?.type === 'automated_browser'
  ) {
    return { utm_source: 'bot', utm_medium: 'headless_browser', utm_campaign: 'browser_automation' };
  }

  // 14. HTTP Scrapers (curl, python, etc.)
  if (
    ua.includes('curl') ||
    ua.includes('python') ||
    ua.includes('scrapy') ||
    ua.includes('wget') ||
    botResult?.type === 'http_scraper'
  ) {
    return { utm_source: 'bot', utm_medium: 'http_scraper', utm_campaign: 'script_client' };
  }

  // 15. Default Fallback
  const isAi = botResult?.type === 'ai_agent' || (botResult?.category && botResult.category.toLowerCase().includes('ai'));
  return {
    utm_source: isAi ? 'llm_agent' : 'bot',
    utm_medium: isAi ? 'generic_ai' : 'unknown_bot',
    utm_campaign: 'bot_traffic',
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
 * and auto-attaches standardized UTM attribution (source, medium, campaign) to the response and dataLayer.
 */
export function getBypassedScriptResponse(reason?: string, utm?: BotUtmParams): Response {
  const safeReason = (reason ?? 'Automated bot').replace(/[\r\n"']/g, ' ');
  const utmSource = utm?.utm_source ?? 'bot';
  const utmMedium = utm?.utm_medium ?? 'automated_agent';
  const utmCampaign = utm?.utm_campaign ?? 'bot_traffic';

  const code = `/* [Tatvic SDK] 🤖 Automated agent detected (${safeReason}).
 * Auto-appended attribution: utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}
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
    utm_campaign: '${utmCampaign}',
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
      'X-Tatvic-Bot-Campaign': utmCampaign,
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

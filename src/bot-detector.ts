import type { BotDetectionOptions, BotDetectionResult } from './types.js';

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
 * Resolves user-provided bot options into a normalized, fully populated configuration.
 */
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
    return {
      isBot: true,
      reason: 'Matched custom bot pattern',
      type: 'custom_rule',
    };
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
      return {
        isBot: true,
        category: cfCategory,
        reason: `Cloudflare verified bot category: ${cfCategory}`,
        type: 'cf_verified',
      };
    }

    // Check search engine category
    if (cleanCat.includes('search') && !cleanCat.includes('ai search')) {
      if (opts.blockSearchCrawlers) {
        return {
          isBot: true,
          category: cfCategory,
          reason: `Cloudflare verified search crawler: ${cfCategory}`,
          type: 'search_crawler',
        };
      } else {
        // Explicitly allow legitimate search engines if blockSearchCrawlers is false
        return { isBot: false, category: cfCategory };
      }
    }
  }

  // Evaluate bot score threshold
  if (botScore !== undefined && botScore <= opts.botScoreThreshold) {
    return {
      isBot: true,
      score: botScore,
      reason: `Cloudflare bot score ${botScore} <= threshold ${opts.botScoreThreshold}`,
      type: 'cf_score',
    };
  }

  // 5. User-Agent Pattern Checks
  if (opts.blockAiAgents) {
    const matched = findMatchingPattern(userAgent, AI_BOT_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `AI Agent / LLM Crawler detected (${matched})`,
        type: 'ai_agent',
      };
    }
  }

  if (opts.blockAutomatedBrowsers) {
    const matched = findMatchingPattern(userAgent, AUTOMATED_BROWSER_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `Automated browser detected (${matched})`,
        type: 'automated_browser',
      };
    }
  }

  if (opts.blockHttpScrapers) {
    const matched = findMatchingPattern(userAgent, HTTP_SCRAPER_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `HTTP scraping client detected (${matched})`,
        type: 'http_scraper',
      };
    }
  }

  if (opts.blockSearchCrawlers) {
    const matched = findMatchingPattern(userAgent, SEARCH_CRAWLER_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `Search engine crawler detected (${matched})`,
        type: 'search_crawler',
      };
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
    return {
      isBot: true,
      reason: 'Matched custom bot pattern',
      type: 'custom_rule',
    };
  }

  // 3. navigator.webdriver
  if (opts.blockAutomatedBrowsers && typeof navigator !== 'undefined' && navigator.webdriver === true) {
    return {
      isBot: true,
      reason: 'navigator.webdriver is true',
      type: 'automated_browser',
    };
  }

  // 4. Known automation window globals
  if (opts.blockAutomatedBrowsers) {
    for (const key of AUTOMATION_WINDOW_GLOBALS) {
      if (key in window && (window as unknown as Record<string, unknown>)[key] !== undefined) {
        return {
          isBot: true,
          reason: `Automation global found: window.${key}`,
          type: 'automated_browser',
        };
      }
    }

    if (
      typeof document !== 'undefined' &&
      ('$cdc_asdjflasutopfhvcZLmcfl_' in document || '__webdriver_evaluate' in document)
    ) {
      return {
        isBot: true,
        reason: 'Selenium DOM automation artifact detected',
        type: 'automated_browser',
      };
    }
  }

  // 5. User-Agent heuristics in browser
  if (opts.blockAutomatedBrowsers) {
    const matched = findMatchingPattern(userAgent, AUTOMATED_BROWSER_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `Automated browser detected (${matched})`,
        type: 'automated_browser',
      };
    }
  }

  if (opts.blockAiAgents) {
    const matched = findMatchingPattern(userAgent, AI_BOT_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `AI Agent / LLM Crawler detected (${matched})`,
        type: 'ai_agent',
      };
    }
  }

  if (opts.blockHttpScrapers) {
    const matched = findMatchingPattern(userAgent, HTTP_SCRAPER_PATTERNS);
    if (matched) {
      return {
        isBot: true,
        reason: `Scraping user-agent detected (${matched})`,
        type: 'http_scraper',
      };
    }
  }

  return { isBot: false };
}

/**
 * Generates a lightweight, empty JavaScript response to serve to bots.
 * This satisfies script loading without downloading, parsing, or executing heavy tracking tags.
 */
export function getBypassedScriptResponse(reason?: string): Response {
  const comment = `/* [Tatvic SDK] Automated agent detected (${reason ?? 'bot'}). Analytics script loading bypassed to optimize page speed. */\n`;
  return new Response(comment, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Tatvic-Bot-Bypass': 'true',
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

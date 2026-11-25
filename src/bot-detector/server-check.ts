import type { BotDetectionOptions, BotDetectionResult } from '../types.js';
import {
  AI_BOT_PATTERNS,
  AUTOMATED_BROWSER_PATTERNS,
  HTTP_SCRAPER_PATTERNS,
  SEARCH_CRAWLER_PATTERNS,
  CF_AI_CATEGORIES,
  DEFAULT_BOT_OPTIONS,
  matchesAnyPattern,
  findMatchingPattern,
} from './patterns.js';
import { formatBotResult } from './utm-mapper.js';

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

    if (opts.blockAiAgents && CF_AI_CATEGORIES.some((c) => cleanCat.includes(c))) {
      return formatBotResult({
        isBot: true,
        category: cfCategory,
        reason: `Cloudflare verified bot category: ${cfCategory}`,
        type: 'cf_verified',
      }, userAgent);
    }

    if (cleanCat.includes('search') && !cleanCat.includes('ai search')) {
      if (opts.blockSearchCrawlers) {
        return formatBotResult({
          isBot: true,
          category: cfCategory,
          reason: `Cloudflare verified search crawler: ${cfCategory}`,
          type: 'search_crawler',
        }, userAgent);
      } else {
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

/**
 * Options for configuring Bot & LLM Agent Detection.
 */
export interface BotDetectionOptions {
  /**
   * Whether bot detection is enabled.
   * Default: true
   */
  enabled?: boolean;

  /**
   * Whether to block AI agents and LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, Bytespider, CCBot, etc.).
   * Default: true
   */
  blockAiAgents?: boolean;

  /**
   * Whether to block automated browser test tools and headless runners (Puppeteer, Playwright, Selenium, Lighthouse).
   * Default: true
   */
  blockAutomatedBrowsers?: boolean;

  /**
   * Whether to block HTTP scraping tools and libraries (curl, Wget, python-requests, Scrapy, httpx, etc.).
   * Default: true
   */
  blockHttpScrapers?: boolean;

  /**
   * Whether to block traditional search engine crawlers (Googlebot, Bingbot, etc.).
   * Default: false (allows search engine indexing while blocking AI training scrapers)
   */
  blockSearchCrawlers?: boolean;

  /**
   * Cloudflare Bot Management score threshold (1-99).
   * Any score below or equal to this threshold is treated as automated bot traffic.
   * Cloudflare guidelines: 1 = definite bot, 2-29 = likely automated, 30-99 = likely human.
   * Default: 29
   */
  botScoreThreshold?: number;

  /**
   * Custom user-agent patterns (strings or RegExp) to treat as bots.
   */
  customBotPatterns?: (string | RegExp)[];

  /**
   * Custom user-agent patterns (strings or RegExp) to explicitly allow/whitelist (never treat as bot).
   */
  allowlistPatterns?: (string | RegExp)[];
}

export interface BotUtmParams {
  utm_source: string;
  utm_medium: string;
}

/**
 * Result returned by bot detection analysis.
 */
export interface BotDetectionResult {
  /**
   * Whether the request or environment was identified as a bot.
   */
  isBot: boolean;

  /**
   * Detailed explanation of why the request was classified as a bot.
   */
  reason?: string;

  /**
   * Bot category classification.
   */
  type?:
    | 'cf_score'
    | 'cf_verified'
    | 'ai_agent'
    | 'automated_browser'
    | 'http_scraper'
    | 'search_crawler'
    | 'custom_rule';

  /**
   * Cloudflare bot score if available (1-99).
   */
  score?: number;

  /**
   * Cloudflare verified bot category if available.
   */
  category?: string;

  /**
   * Automatically attributed UTM parameters for bot / agent identification.
   */
  utm?: BotUtmParams;
}

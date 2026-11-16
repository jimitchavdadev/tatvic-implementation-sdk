/**
 * Configuration options for the First-Party Proxy SDK.
 */
export interface ProxySdkOptions {
  /**
   * The first-party proxy endpoint on your own server.
   * Example: "/api/v1/relay" or "https://yourdomain.com/api/v1/relay"
   * Default: "/api/v1/relay"
   */
  proxyEndpoint?: string;

  /**
   * List of external domains or RegExp patterns to intercept and route through the first-party proxy.
   * Example: ["google-analytics.com", "analytics.google.com", "connect.facebook.net"]
   */
  targetDomains?: (string | RegExp)[];

  /**
   * Domains to explicitly exclude from interception (e.g., payment gateways, auth).
   * Example: ["api.stripe.com", "auth0.com"]
   */
  excludeDomains?: (string | RegExp)[];

  /**
   * Header name used to transmit the upstream destination to the first-party proxy.
   * Default: "x-relay-target"
   */
  targetHeaderName?: string;

  /**
   * Whether to obfuscate (Base64-encode) the target URL in headers/query params
   * to avoid basic string inspection by aggressive content filters.
   * Default: false
   */
  obfuscateTarget?: boolean;

  /**
   * Strategy for transmitting the upstream target to the proxy:
   * - "header": Uses custom HTTP header (recommended for fetch/XHR)
   * - "query": Appends target as a query parameter (e.g. ?_tgt=...)
   * - "auto": Uses header for fetch/XHR and query parameter for sendBeacon.
   * Default: "auto"
   */
  routingMode?: 'header' | 'query' | 'auto';

  /**
   * If true, converts navigator.sendBeacon calls to fetch with { keepalive: true }.
   * This allows custom headers and more reliable delivery.
   * Default: true
   */
  polyfillBeaconWithKeepalive?: boolean;

  /**
   * Enable debug console logging.
   * Default: false
   */
  debug?: boolean;

  /**
   * Optional Server-Side GTM Preview & Debug token (from Tag Assistant "Send requests manually").
   * When provided, or detected in URL query params (?gtm_server_preview=... or ?gtm_debug=...),
   * this token is automatically attached to upstream requests as the `X-Gtm-Server-Preview` header.
   */
  serverPreviewToken?: string;

  /**
   * Bot & LLM Agent Detection options.
   * When enabled, prevents tracking scripts from executing in automated/headless browsers
   * (e.g. Lighthouse, Puppeteer) to boost Core Web Vitals and protect analytics.
   * Default: true
   */
  botDetection?: boolean | BotDetectionOptions;

  /**
   * Whether the interceptor is enabled.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Options for the server-side proxy handler.
 */
export interface ServerProxyOptions {
  /**
   * Server-Side GTM Preview token to forward upstream if not provided by client.
   */
  serverPreviewToken?: string;

  /**
   * Bot and LLM Agent Detection configuration.
   * When enabled, automated bots, AI crawlers, and scrapers are detected using Cloudflare
   * Bot Management headers (cf-bot-score, cf-verified-bot-category) and User-Agent patterns.
   * When a bot is detected, tracking loaders (/loader.js, /gtm.js) return a blank 0KB script,
   * saving server/client CPU and bandwidth and boosting Lighthouse scores, while telemetry
   * hits return 204 No Content without polluting analytics.
   * Default: true
   */
  botDetection?: boolean | BotDetectionOptions;

  /**
   * Optional Server-Side GTM container URL (e.g. "https://tpozgxiu.usu.stape.io").
   * When configured, any outgoing Google Analytics collect requests (google-analytics.com/g/collect)
   * are automatically routed to this server container URL.
   */
  serverContainerUrl?: string;
  /**
   * Whitelist of permitted upstream target domains.
   * Crucial security control to prevent Server-Side Request Forgery (SSRF).
   * Defaults to preconfigured list of all major analytics & tracking services.
   */
  allowedDomains?: (string | RegExp)[];

  /**
   * Header name containing the upstream target URL.
   * Default: "x-relay-target"
   */
  targetHeaderName?: string;

  /**
   * Whether targets were obfuscated (Base64 encoded).
   * Default: false
   */
  obfuscateTarget?: boolean;

  /**
   * Timeout in milliseconds for upstream requests.
   * Default: 10000 (10s)
   */
  timeoutMs?: number;

  /**
   * Headers to strip from upstream forwarding for privacy/security.
   * Default: ['host', 'cookie', 'authorization', 'connection']
   */
  stripHeaders?: string[];
}

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
}

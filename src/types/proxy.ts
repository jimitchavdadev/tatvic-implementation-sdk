import type { BotDetectionOptions } from './bot.js';
import type { PiiRedactionOptions } from './pii.js';

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
   * Whether to preserve original query parameters on the first-party proxy URL in header routing mode.
   * When enabled, requests to /_tatvic/relay include ?v=2&tid=G-XXXXX, allowing Chrome DevTools
   * "Payload" tab to parse and display query string parameters natively just like normal collect hits.
   * Default: false
   */
  preserveQueryOnProxyUrl?: boolean;

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
   * When enabled, automated bots, AI crawlers, and scrapers are detected and automatically
   * attributed with standardized UTM parameters (source e.g. gpt, gemini; medium e.g. assistant, agent, crawler)
   * in dataLayer and telemetry hits without blocking the view.
   * Default: true
   */
  botDetection?: boolean | BotDetectionOptions;

  /**
   * PII (Personally Identifiable Information) Redaction options.
   * When enabled, any request parameter containing an email or phone number
   * has its value replaced with "NA" to protect user privacy and prevent GA4 TOS violations.
   * Default: true
   */
  piiRedaction?: boolean | PiiRedactionOptions;

  /**
   * The global dataLayer variable name to monitor and sanitize for PII.
   * Default: "dataLayer"
   */
  dataLayerName?: string;

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
   * Standardized UTM parameters (utm_source e.g. gpt, gemini; utm_medium e.g. assistant, agent, crawler)
   * are automatically appended to dataLayer and forwarded telemetry hits without blocking the view or suppressing scripts.
   * Default: true
   */
  botDetection?: boolean | BotDetectionOptions;

  /**
   * PII (Personally Identifiable Information) Redaction configuration.
   * When enabled, any parameter in incoming requests (query params or request body)
   * containing an email address or phone number has its value replaced with "NA"
   * before forwarding upstream.
   * Default: true
   */
  piiRedaction?: boolean | PiiRedactionOptions;

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

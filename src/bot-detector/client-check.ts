import type { BotDetectionOptions, BotDetectionResult, BotUtmParams } from '../types.js';
import {
  AI_BOT_PATTERNS,
  AUTOMATED_BROWSER_PATTERNS,
  HTTP_SCRAPER_PATTERNS,
  AUTOMATION_WINDOW_GLOBALS,
  matchesAnyPattern,
  findMatchingPattern,
} from './patterns.js';
import { formatBotResult } from './utm-mapper.js';
import { resolveBotOptions } from './server-check.js';

/**
 * Evaluates whether the current browser client execution environment is an automated
 * headless browser, synthetic agent, or audit bot (such as Google Lighthouse).
 */
export function isClientBot(optionsConfig?: boolean | BotDetectionOptions): BotDetectionResult {
  const win: any = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : undefined);
  if (!win && typeof navigator === 'undefined') {
    return { isBot: false };
  }

  const opts = resolveBotOptions(optionsConfig);
  if (!opts.enabled) {
    return { isBot: false };
  }

  const nav = typeof navigator !== 'undefined' ? navigator : win?.navigator;
  const userAgent = nav?.userAgent || '';

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
  if (opts.blockAutomatedBrowsers && nav && nav.webdriver === true) {
    return formatBotResult({
      isBot: true,
      reason: 'navigator.webdriver is true',
      type: 'automated_browser',
    }, userAgent);
  }

  // 4. Known automation window globals
  if (opts.blockAutomatedBrowsers && win) {
    for (const key of AUTOMATION_WINDOW_GLOBALS) {
      if (key in win && win[key] !== undefined) {
        return formatBotResult({
          isBot: true,
          reason: `Automation global found: window.${key}`,
          type: 'automated_browser',
        }, userAgent);
      }
    }

    const doc = typeof document !== 'undefined' ? document : win.document;
    if (
      doc &&
      ('$cdc_asdjflasutopfhvcZLmcfl_' in doc || '__webdriver_evaluate' in doc)
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

import type { BotDetectionOptions } from '../types.js';

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

export function matchesAnyPattern(text: string, patterns: (string | RegExp)[]): boolean {
  for (const p of patterns) {
    if (p instanceof RegExp) {
      if (p.test(text)) return true;
    } else {
      if (text.toLowerCase().includes(p.toLowerCase())) return true;
    }
  }
  return false;
}

export function findMatchingPattern(text: string, patterns: RegExp[]): string | null {
  for (const regex of patterns) {
    const m = text.match(regex);
    if (m) return m[0];
  }
  return null;
}

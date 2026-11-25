import type { BotDetectionResult, BotUtmParams } from '../types.js';

// Table for concise prefix-to-source mapping
const SIMPLE_ENGINE_MAP: [string, string, string][] = [
  ['bytespider', 'bytedance', 'crawler'],
  ['bytedance', 'bytedance', 'crawler'],
  ['deepseek', 'deepseek', 'crawler'],
  ['amazonbot', 'amazon', 'crawler'],
  ['cohere', 'cohere', 'crawler'],
  ['ccbot', 'commoncrawl', 'crawler'],
  ['googlebot', 'googlebot', 'search'],
  ['bingbot', 'bingbot', 'search'],
  ['yandexbot', 'yandex', 'search'],
  ['baiduspider', 'baidu', 'search'],
  ['curl/', 'curl', 'scraper'],
  ['scrapy', 'scrapy', 'scraper'],
  ['wget/', 'wget', 'scraper'],
  ['postmanruntime', 'postman', 'scraper'],
];

/**
 * Resolves automated bot, LLM crawler, or synthetic agent identification into standardized UTM parameters.
 */
export function getBotUtmParams(userAgent: string, botResult?: BotDetectionResult): BotUtmParams {
  const ua = (userAgent || '').toLowerCase();
  const category = (botResult?.category || '').toLowerCase();

  // 1. OpenAI (ChatGPT / GPTBot / OAI-SearchBot)
  if (ua.includes('gptbot') || ua.includes('chatgpt') || ua.includes('oai-searchbot') || ua.includes('openai')) {
    let medium = 'crawler';
    if (ua.includes('chatgpt-user') || ua.includes('chatgpt') || category.includes('assistant')) {
      medium = 'assistant';
    } else if (ua.includes('oai-searchbot') || category.includes('search') || category.includes('agent')) {
      medium = 'agent';
    }
    return { utm_source: 'gpt', utm_medium: medium };
  }

  // 2. Google Gemini / Vertex / Extended
  if (ua.includes('gemini') || ua.includes('google-extended') || ua.includes('vertexbot') || ua.includes('google-cloudvertexbot')) {
    let medium = 'crawler';
    if (ua.includes('gemini') && !ua.includes('extended')) {
      medium = 'assistant';
    } else if (ua.includes('vertexbot') || ua.includes('cloudvertex')) {
      medium = 'agent';
    }
    return { utm_source: 'gemini', utm_medium: medium };
  }

  // 3. Anthropic Claude (ClaudeBot / Claude-User / Claude-SearchBot)
  if (ua.includes('claudebot') || ua.includes('claude') || ua.includes('anthropic')) {
    let medium = 'crawler';
    if (ua.includes('claude-user') || category.includes('assistant')) {
      medium = 'assistant';
    } else if (ua.includes('claude-searchbot') || ua.includes('claude-web') || category.includes('search') || category.includes('agent')) {
      medium = 'agent';
    }
    return { utm_source: 'claude', utm_medium: medium };
  }

  // 4. Perplexity AI & Microsoft Copilot
  if (ua.includes('perplexity')) {
    const medium = ua.includes('perplexity-user') || category.includes('assistant') ? 'assistant' : 'agent';
    return { utm_source: 'perplexity', utm_medium: medium };
  }
  if (ua.includes('copilot') || ua.includes('bing-copilot')) {
    return { utm_source: 'copilot', utm_medium: 'assistant' };
  }

  // 5. Meta & Apple
  if (ua.includes('meta-external') || ua.includes('facebookbot') || ua.includes('meta-webindexer')) {
    const medium = ua.includes('externalfetcher') || ua.includes('webindexer') ? 'agent' : 'crawler';
    return { utm_source: 'meta', utm_medium: medium };
  }
  if (ua.includes('applebot-extended')) return { utm_source: 'apple', utm_medium: 'crawler' };
  if (ua.includes('applebot')) return { utm_source: 'apple', utm_medium: 'search' };

  // 6. Mistral & DuckDuckGo
  if (ua.includes('mistral')) {
    return { utm_source: 'mistral', utm_medium: ua.includes('mistralai-user') ? 'assistant' : 'crawler' };
  }
  if (ua.includes('duckassistbot')) return { utm_source: 'duckduckgo', utm_medium: 'assistant' };
  if (ua.includes('duckduckbot')) return { utm_source: 'duckduckgo', utm_medium: 'search' };

  // 7. Table-based simple engines & scrapers
  for (const [key, source, medium] of SIMPLE_ENGINE_MAP) {
    if (ua.includes(key)) return { utm_source: source, utm_medium: medium };
  }

  // 8. Python & script scraper fallbacks
  if (ua.includes('python-requests') || ua.includes('python-urllib') || ua.includes('aiohttp') || ua.includes('httpx')) {
    return { utm_source: 'python', utm_medium: 'scraper' };
  }
  if (botResult?.type === 'http_scraper') {
    return { utm_source: 'scraper', utm_medium: 'scraper' };
  }

  // 9. Audit Tools & Automation Browsers
  if (ua.includes('lighthouse') || ua.includes('pagespeed') || ua.includes('chrome-lighthouse')) {
    return { utm_source: 'lighthouse', utm_medium: 'audit' };
  }
  if (
    ua.includes('headlesschrome') || ua.includes('puppeteer') || ua.includes('playwright') ||
    ua.includes('selenium') || ua.includes('webdriver') || ua.includes('phantomjs') ||
    ua.includes('cypress') || botResult?.type === 'automated_browser'
  ) {
    return { utm_source: 'headless_browser', utm_medium: 'automation' };
  }

  // 10. Cloudflare Verified Categories
  if (category) {
    if (category.includes('assistant')) return { utm_source: 'cf_bot', utm_medium: 'assistant' };
    if (category.includes('search')) return { utm_source: 'cf_bot', utm_medium: 'agent' };
    if (category.includes('crawler') || category.includes('training')) return { utm_source: 'cf_bot', utm_medium: 'crawler' };
    if (category.includes('scraper')) return { utm_source: 'cf_bot', utm_medium: 'scraper' };
  }
  if (botResult?.type === 'cf_score') {
    return { utm_source: 'automated_bot', utm_medium: 'agent' };
  }

  const isAi = botResult?.type === 'ai_agent' || category.includes('ai');
  return {
    utm_source: isAi ? 'ai_bot' : 'bot',
    utm_medium: isAi ? 'agent' : 'automation',
  };
}

export function formatBotResult(result: BotDetectionResult, userAgent: string): BotDetectionResult {
  if (result.isBot) {
    result.utm = getBotUtmParams(userAgent, result);
  }
  return result;
}

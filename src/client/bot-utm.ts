import type { BotUtmParams } from '../types.js';

export function appendBotUtmToUrl(urlStr: string, botUtm?: BotUtmParams): string {
  if (!botUtm) return urlStr;
  try {
    const isRelative = urlStr.startsWith('/');
    const parsed = new URL(urlStr, typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost');
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', botUtm.utm_source);
    }
    if (!parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', botUtm.utm_medium);
    }
    if (!parsed.searchParams.has('cs')) {
      parsed.searchParams.set('cs', botUtm.utm_source);
    }
    if (!parsed.searchParams.has('cm')) {
      parsed.searchParams.set('cm', botUtm.utm_medium);
    }
    if (!parsed.searchParams.has('ep.utm_source')) {
      parsed.searchParams.set('ep.utm_source', botUtm.utm_source);
    }
    if (!parsed.searchParams.has('ep.utm_medium')) {
      parsed.searchParams.set('ep.utm_medium', botUtm.utm_medium);
    }
    return isRelative ? `${parsed.pathname}${parsed.search}` : parsed.toString();
  } catch {
    return urlStr;
  }
}

export function appendBotUtmHeaders(headers: Headers, botUtm?: BotUtmParams): void {
  if (botUtm) {
    if (!headers.has('x-tatvic-bot-source')) {
      headers.set('x-tatvic-bot-source', botUtm.utm_source);
    }
    if (!headers.has('x-tatvic-bot-medium')) {
      headers.set('x-tatvic-bot-medium', botUtm.utm_medium);
    }
  }
}

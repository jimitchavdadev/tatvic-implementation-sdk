import type { ProxySdkOptions, BotUtmParams } from '../types.js';
import { UrlMatcher } from '../url-matcher.js';
import { isClientBot } from '../bot-detector.js';
import { PiiRedactor } from '../pii-redactor.js';
import { patchFetch, type PatchContext } from './patch-fetch.js';
import { patchXhr } from './patch-xhr.js';
import { patchSendBeacon } from './patch-beacon.js';
import { patchScriptElements, patchImageElements } from './patch-dom.js';
import { patchDataLayer } from './patch-datalayer.js';
import { detectPreviewToken } from './token-detector.js';

export class RequestInterceptor {
  private matcher: UrlMatcher;
  private piiRedactor: PiiRedactor;
  private options: ProxySdkOptions;
  private isInstalled: boolean = false;

  private originalFetch?: typeof window.fetch;
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend?: typeof XMLHttpRequest.prototype.send;
  private originalSendBeacon?: typeof navigator.sendBeacon;
  private originalScriptSrcDesc?: PropertyDescriptor;
  private originalImageSrcDesc?: PropertyDescriptor;
  private originalDataLayerDesc?: PropertyDescriptor;
  private isBotDetected: boolean = false;
  private botUtm?: BotUtmParams;
  private botReason?: string;

  constructor(options: ProxySdkOptions = {}) {
    this.options = options;
    this.matcher = new UrlMatcher(options);
    this.piiRedactor = new PiiRedactor(options.piiRedaction);
  }

  public install(): void {
    if (this.isInstalled || typeof window === 'undefined') {
      return;
    }

    if (this.options.enabled === false) {
      this.matcher.log('SDK disabled via configuration.');
      return;
    }

    const isPreview = this.options.serverPreviewToken || detectPreviewToken();
    if (!isPreview && this.options.botDetection !== false) {
      const botCheck = isClientBot(this.options.botDetection);
      if (botCheck.isBot) {
        this.isBotDetected = true;
        this.botUtm = botCheck.utm;
        this.botReason = botCheck.reason;
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[Tatvic SDK] 🤖 Bot detected: ${botCheck.reason}. Attributing telemetry with utm_source=${botCheck.utm?.utm_source}, utm_medium=${botCheck.utm?.utm_medium}.`
          );
        }
        this.matcher.log(
          `Bot environment detected (${botCheck.reason}). Telemetry requests will carry utm_source=${botCheck.utm?.utm_source}, utm_medium=${botCheck.utm?.utm_medium}.`
        );

        if (typeof window !== 'undefined' && botCheck.utm) {
          const w = window as any;
          w.dataLayer = w.dataLayer || [];
          w.dataLayer.push({
            event: 'bot_detected',
            utm_source: botCheck.utm.utm_source,
            utm_medium: botCheck.utm.utm_medium,
            bot_reason: botCheck.reason,
          });
        }
      }
    }

    const ctx: PatchContext = {
      matcher: this.matcher,
      piiRedactor: this.piiRedactor,
      options: this.options,
      botUtm: this.isBotDetected ? this.botUtm : undefined,
    };

    this.originalFetch = patchFetch(ctx);

    const xhrPatch = patchXhr(ctx);
    if (xhrPatch) {
      this.originalXhrOpen = xhrPatch.originalOpen;
      this.originalXhrSend = xhrPatch.originalSend;
    }

    this.originalSendBeacon = patchSendBeacon(ctx);
    this.originalScriptSrcDesc = patchScriptElements(ctx);
    this.originalImageSrcDesc = patchImageElements(ctx);
    this.originalDataLayerDesc = patchDataLayer(ctx);

    this.isInstalled = true;
    this.matcher.log('First-party request interceptor active.');
  }

  public uninstall(): void {
    if (!this.isInstalled || typeof window === 'undefined') {
      return;
    }

    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = undefined;
    }

    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = undefined;
    }

    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = undefined;
    }

    if (this.originalSendBeacon && navigator.sendBeacon) {
      navigator.sendBeacon = this.originalSendBeacon;
      this.originalSendBeacon = undefined;
    }

    if (this.originalScriptSrcDesc && typeof HTMLScriptElement !== 'undefined') {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', this.originalScriptSrcDesc);
      this.originalScriptSrcDesc = undefined;
    }

    if (this.originalImageSrcDesc && typeof HTMLImageElement !== 'undefined') {
      Object.defineProperty(HTMLImageElement.prototype, 'src', this.originalImageSrcDesc);
      this.originalImageSrcDesc = undefined;
    }

    const dataLayerKey = this.options.dataLayerName || 'dataLayer';
    if (this.originalDataLayerDesc && typeof window !== 'undefined') {
      try {
        Object.defineProperty(window, dataLayerKey, this.originalDataLayerDesc);
      } catch {}
      this.originalDataLayerDesc = undefined;
    }
    if (typeof window !== 'undefined' && (window as any)[dataLayerKey]) {
      try {
        delete (window as any)[dataLayerKey].push;
      } catch {}
    }

    this.isInstalled = false;
    this.matcher.log('First-party request interceptor uninstalled.');
  }
}

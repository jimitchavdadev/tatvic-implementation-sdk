import { initFirstPartyWrapper } from './index.js';
import type { ProxySdkOptions } from './types.js';
import { isClientBot } from './bot-detector.js';
import { morphDomScripts } from './dom/script-morpher.js';

/**
 * Standard Web Component: <tatvic-wrapper>
 *
 * Allows wrapping the entire application in any framework or plain HTML/PHP:
 *
 * <tatvic-wrapper>
 *   <app>...</app>
 * </tatvic-wrapper>
 */
export class TatvicWrapperElement extends (typeof HTMLElement !== 'undefined' ? HTMLElement : (Object as unknown as typeof HTMLElement)) {
  connectedCallback(): void {
    if (typeof window === 'undefined') return;

    if (this.style) {
      this.style.display = 'contents';
    }

    const endpoint = this.getAttribute ? this.getAttribute('endpoint') ?? undefined : undefined;
    const debug = this.getAttribute ? this.getAttribute('debug') === 'true' : false;
    const serverPreview = this.getAttribute
      ? (this.getAttribute('server-preview') || this.getAttribute('server-preview-token') || undefined)
      : undefined;

    if (serverPreview && typeof window !== 'undefined') {
      (window as any).__TATVIC_PREVIEW_TOKEN = serverPreview;
      try {
        sessionStorage.setItem('_tatvic_preview_token', serverPreview);
      } catch {}
    }
    const botDetectionAttr = this.getAttribute ? this.getAttribute('bot-detection') : null;
    const botDetectionEnabled = botDetectionAttr !== 'false';
    const piiRedactionAttr = this.getAttribute ? this.getAttribute('pii-redaction') : null;
    const piiRedactionEnabled = piiRedactionAttr !== 'false';
    const preserveQueryAttr = this.getAttribute ? this.getAttribute('preserve-query') : null;
    const preserveQuery = preserveQueryAttr !== 'false';
    const obfuscateAttr = this.getAttribute ? this.getAttribute('obfuscate-target') : null;
    const obfuscateTarget = obfuscateAttr !== 'false';

    const options: ProxySdkOptions = {};
    if (endpoint) options.proxyEndpoint = endpoint;
    if (debug) options.debug = true;
    if (serverPreview) options.serverPreviewToken = serverPreview;
    if (botDetectionAttr !== null) {
      options.botDetection = botDetectionEnabled;
    }
    if (piiRedactionAttr !== null) {
      options.piiRedaction = piiRedactionEnabled;
    }
    options.preserveQueryOnProxyUrl = preserveQuery;
    options.obfuscateTarget = obfuscateTarget;

    const isPreview =
      Boolean(serverPreview) ||
      (typeof window !== 'undefined' &&
        window.location &&
        (window.location.search.includes('gtm_debug') ||
          window.location.search.includes('gtm_preview') ||
          window.location.search.includes('gtm_server_preview')));

    if (botDetectionEnabled && !isPreview) {
      const botCheck = isClientBot();
      if (botCheck.isBot) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[Tatvic SDK] 🤖 Bot detected: ${botCheck.reason}. Attributing with utm_source=${botCheck.utm?.utm_source}, utm_medium=${botCheck.utm?.utm_medium}.`
          );
        }

        try {
          if (typeof window !== 'undefined') {
            const dl = (window as any).dataLayer || [];
            (window as any).dataLayer = dl;
            dl.push({
              event: 'bot_detected',
              utm_source: botCheck.utm?.utm_source ?? 'bot',
              utm_medium: botCheck.utm?.utm_medium ?? 'agent',
              bot_reason: botCheck.reason,
            });
          }
        } catch {}

        try {
          window.dispatchEvent(
            new CustomEvent('tatvic:bot-detected', {
              detail: botCheck,
              bubbles: true,
              cancelable: false,
            })
          );
        } catch {}
      }
    }

    initFirstPartyWrapper(options);

    const runMorph = () => morphDomScripts(this, options);
    runMorph();
    if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(runMorph);
    } else if (typeof setTimeout !== 'undefined') {
      setTimeout(runMorph, 0);
    }
  }
}

if (typeof window !== 'undefined' && typeof customElements !== 'undefined' && !customElements.get('tatvic-wrapper')) {
  try {
    customElements.define('tatvic-wrapper', TatvicWrapperElement as unknown as CustomElementConstructor);
  } catch {}
}

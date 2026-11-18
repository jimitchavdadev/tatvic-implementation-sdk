# Tatvic Universal First-Party App Wrapper & Morphed GTM Loader

A zero-configuration, universal wrapper that converts all third-party analytics and tracking requests into **first-party requests**, preventing client-side ad blockers (like Brave Shields, uBlock Origin, and AdGuard) from blocking them.

> 📖 **Looking for a deep-dive, framework-agnostic developer guide?**  
> See the [Comprehensive Framework-Agnostic Developer Integration Guide (Normal vs. Server-Side sGTM)](./docs/INTEGRATION_GUIDE.md).

---

## 🎯 The Problem Solved

Standard Google Tag Manager scripts request `https://www.googletagmanager.com/gtm.js`. Ad blockers immediately flag and block this request:
1. `googletagmanager.com/gtm.js` is blocked at the network layer.
2. Internal Google endpoints (`adservice.google.com`, `doubleclick.net`, `google-analytics.com`) called inside the container are blocked.

### The Solution: Morphed First-Party Loader
This SDK introduces a **Morphed First-Party GTM Loader** (`/_tatvic/gtm.js`):
1. **First-Party Script Delivery:** Loads `gtm.js` from your own domain (`/_tatvic/gtm.js?id=GTM-XXXX`).
2. **AST / Endpoint Morphing:** The server fetches Google's container server-to-server and dynamically rewrites internal tracking endpoints to route through your first-party relay (`/_tatvic/relay`).
3. **Preserves Tag Assistant Preview & Debug Mode:**
   - Detects `gtm_debug`, `gtm_auth`, `gtm_preview`, and `gtm_cookies_win` parameters.
   - Forwards them upstream so Google serves the workspace draft container.
   - Bypasses caching in debug mode (`Cache-Control: no-cache, no-store`).
   - Keeps `tagassistant.google.com` postMessage handshake intact so Tag Assistant connects instantly.
4. **Bot & LLM Agent Detection & Auto-Attribution**:
   - Automatically detects AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Bytespider`), headless runners (`Lighthouse`, `Puppeteer`, `Playwright`), and Cloudflare Bot scores (`cf-bot-score <= 29`, `cf-verified-bot-category`).
   - For bots, tracking scripts return a minimal `200 OK` stub (~100 bytes) and telemetry hits return `204 No Content`.
   - Result: **0 KB of heavy tracking scripts executed for bots**, zero main-thread CPU time, drastically reduced Total Blocking Time (TBT), and pristine analytics.
   - **Auto-Attribution**: Automatically appends `utm_source` (`llm_agent` / `bot`) and `utm_medium` (e.g. `openai`, `anthropic`, `gemini`, `perplexity`, `bytedance`) to `dataLayer` and proxy requests upon bot detection.
   - **Real-Time Console Logging**: Automatically logs `[Tatvic SDK] 🤖 Bot detected: <reason>` in DevTools and server logs, plus dispatches a `tatvic:bot-detected` DOM event.
5. **Automatic PII (Personally Identifiable Information) Redaction & dataLayer Protection**:
   - Detects email addresses (plain `@` and URL-encoded `%40`, with negative lookahead protecting image filenames like `.png`, `.jpg`, `.svg`) and 10-digit phone numbers across standard keys (`phone`, `mobile`, `mobile_no`, `phone_number`, `ep.phone`, etc.).
   - **Client-Side dataLayer Protection**: Automatically intercepts `window.dataLayer.push` and `gtag()` calls in-place, sanitizing raw email and phone parameters to `"NA"` before tags can read them.
   - **Server Proxy Sanitization**: Automatically scrubs URL query parameters and request bodies (URL-encoded form data, GA4 multiline `text/plain`, and `application/json`) before forwarding upstream.
   - Preserves all legitimate metrics and events while eliminating privacy risks and GA4 Terms of Service violations.
6. **Advanced Ad-Blocker Evasion (EasyPrivacy, Brave Shields & uBlock Origin)**:
   - Neutralizes aggressive heuristic rules (such as `?v=2&tid=G-$~third-party`, `&gtm=*&tag_exp=`, and `&cx=c&gtm=`) through smart query parameter ordering and proxy-level unaliasing.
   - Preserves sGTM server preview tokens (`x-gtm-server-preview`) and cookies for seamless debugging.

---

## 🚀 Usage

### 1. Plain HTML / PHP / WordPress

```html
<!-- 1. Load Tatvic Standalone Script in <head> -->
<script src="/dist/tatvic.js"></script>

<!-- 2. Wrap your entire application -->
<tatvic-wrapper>
  <!-- Morphed First-Party GTM Script (Zero Shields block!) -->
  <script async src="/_tatvic/gtm.js?id=GTM-T32XGF8F"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
  </script>

  <!-- Your app code and buttons -->
</tatvic-wrapper>
```

> **Note:** If you keep the original Google URL `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F"></script>`, `<tatvic-wrapper>` will automatically intercept and morph it to `/_tatvic/gtm.js` at runtime!

---

### 2. React (Vite / CRA / Remix)

```tsx
import { TatvicWrapper } from 'tatvic-implementation-sdk';

export default function Root() {
  return (
    <TatvicWrapper>
      <App />
    </TatvicWrapper>
  );
}
```

---

### 3. Next.js (App Router)

In `app/layout.tsx`:
```tsx
import { TatvicWrapper } from 'tatvic-implementation-sdk';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script async src="/_tatvic/gtm.js?id=GTM-T32XGF8F" />
      </head>
      <body>
        <TatvicWrapper>
          {children}
        </TatvicWrapper>
      </body>
    </html>
  );
}
```

In `app/_tatvic/[...path]/route.ts` or `app/_tatvic/relay/route.ts`:
```typescript
import { tatvicRelayRoute } from 'tatvic-implementation-sdk';
export const { GET, POST, OPTIONS } = tatvicRelayRoute();
```

---

### 4. Server-Side Morphed GTM Endpoints

* **Node / Express / Bun:** Handled automatically by `createProxyHandler()` and `tatvicExpressMiddleware()`.
* **PHP / WordPress:** Handled automatically by [`src/php/tatvic-proxy.php`](file:///home/jimitchavda/Jotaro/bakhodi/tatvic-implementation-sdk/src/php/tatvic-proxy.php).

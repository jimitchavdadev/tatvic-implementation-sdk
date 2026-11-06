# Tatvic Dummy Projects (Major Tech Stacks)

This directory contains standalone dummy projects across all major tech stacks implementing the GTM container **`GTM-T32XGF8F`** wrapped with `<tatvic-wrapper>`:

```html
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
</script>
```

---

## 📁 Projects Matrix

| Stack | Directory | Client Wrapper | Server Relay | Run Command |
| :--- | :--- | :--- | :--- | :--- |
| **Plain HTML / Vanilla JS** | [`html-vanilla/`](./html-vanilla) | `<tatvic-wrapper>` | `createProxyHandler()` | `bun run dummy-projects/html-vanilla/server.ts` |
| **React (Vite / SPA)** | [`react-vite/`](./react-vite) | `<TatvicWrapper>` | `createProxyHandler()` | `bun run dummy-projects/react-vite/server.ts` |
| **Next.js (App Router)** | [`nextjs-app/`](./nextjs-app) | `<TatvicWrapper>` | `tatvicRelayRoute()` | Integrated into Next.js App Router |
| **PHP / WordPress** | [`php-app/`](./php-app) | `<tatvic-wrapper>` | `tatvic-proxy.php` | `php -S localhost:4004 -t dummy-projects/php-app` |
| **Node.js / Express** | [`express-node/`](./express-node) | `<tatvic-wrapper>` | `tatvicExpressMiddleware()` | `bun run dummy-projects/express-node/server.ts` |

---

## 🧪 Automated End-to-End Test Suite

Run the full end-to-end verification across all stacks:

```bash
bun test dummy-projects/test-all.test.ts
```

### Verified Behaviors:
1. **GTM Script Proxying:** Successfully fetches Google Tag Manager's code (`gtm.js?id=GTM-T32XGF8F`) through `/_tatvic/relay?_tgt=...` with valid JavaScript content type and 200 status.
2. **Telemetry Forwarding:** Successfully forwards GA4/Google Ads `POST /g/collect` beacons through `/_tatvic/relay` and receives valid HTTP 200/204 response.
3. **SSRF Guard:** Rejects unauthorized target destinations with HTTP 403 Forbidden.
4. **CORS:** Delivers correct `Access-Control-Allow-Origin: *` headers for all first-party relays.

---

## 🔍 Server-Side GTM (sGTM) Preview & Debugging on Localhost

When debugging Server-Side GTM containers (e.g. hosted on **Stape** at `https://tpozgxiu.usu.stape.io/`) from `localhost`:

### Why hits don't appear in Server Preview by default on localhost:
1. **Cookie Isolation:** The Server Container preview in Google Tag Assistant relies on debug session cookies set on the tagging domain (`tpozgxiu.usu.stape.io`). When running on `localhost:4001` via a first-party reverse proxy (`/_tatvic/relay`), the browser only sends `localhost` cookies to the proxy, meaning Stape receives no preview cookie and treats the hit as normal live traffic (HTTP 200).
2. **Privacy / Cross-Site Blocking:** Browsers (especially Brave Shields) block third-party cookies between `localhost` (HTTP) and `stape.io` (HTTPS).

### How to see hits in Server-Side Container Preview:
1. **Option 1: Add the Preview Token to URL / Wrapper:**
   - In your sGTM Container preview window, click the **three dots menu** (top right) ➔ **"Send requests manually"**.
   - Copy the `X-Gtm-Server-Preview` token (e.g. `WB:xxxxxxxxxxxx`).
   - Open your local site with `?gtm_server_preview=WB:xxxxxxxxxxxx` OR set `<tatvic-wrapper server-preview="WB:xxxxxxxxxxxx">`.
   - The Tatvic SDK will automatically attach the `X-Gtm-Server-Preview` header to every proxied request sent to Stape, and hits will instantly appear in the Preview pane.
2. **Option 2: Stape "sGTM Preview Header Config" Power-Up:**
   - In Stape admin, enable the **sGTM Preview Header Config** power-up.
   - Enter your IP address and GTM Preview token.
   - Stape will automatically map all hits from your IP address into your preview console without requiring any cookies or manual headers.

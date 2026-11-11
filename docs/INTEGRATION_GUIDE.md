# Tatvic First-Party Analytics Proxy & Morphed GTM SDK
## Comprehensive Framework-Agnostic Developer Integration Guide

---

## 1. Architectural Overview & Mental Model

Modern web browsers and privacy extensions (such as **uBlock Origin**, **Brave Shields**, **AdGuard**, and Safari's **ITP**) block tracking and analytics via two primary mechanisms:
1. **Network Domain Filtering**: Any network call directed at known analytics or advertising domains (e.g., `googletagmanager.com`, `google-analytics.com`, `connect.facebook.net`, `clarity.ms`) is terminated immediately at the network layer (`ERR_BLOCKED_BY_CLIENT`).
2. **String / URL Path Filtering**: Static scripts or requests matching patterns such as `/gtm.js`, `/collect`, or `?id=GTM-` in EasyPrivacy filter lists are blocked even if hosted on subdomains.

The Tatvic Implementation SDK solves both challenges through a **two-tier architecture**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ BROWSER (Client-Side)                                                 │
│                                                                        │
│  [User Action / GTM Tag]                                               │
│          │                                                             │
│          ▼ (Intercepted: fetch, XHR, sendBeacon, script.src)          │
│  [Tatvic Client SDK]                                                   │
│          │                                                             │
│          ▼ Rewrites target to first-party URL                          │
│  Request: POST /_tatvic/relay                                          │
│  Header:  x-tatvic-target: https://google-analytics.com/g/collect      │
│  Header:  x-gtm-server-preview: <session-token> (if sGTM debug active) │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ First-party HTTP request (No Shield block)
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│ YOUR BACKEND / GATEWAY (First-Party Server Relay)                      │
│                                                                        │
│  Endpoint: /_tatvic/relay                                              │
│  1. SSRF Validation (verifies target against strict domain allowlist)  │
│  2. Strips sensitive client headers (Host, Cookie, Authorization)      │
│  3. Forwards Client IP (X-Forwarded-For)                               │
│  4. Injects Server Preview & Debug Flags (_dbg=1, ep.debug_mode=true)   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
     [MODE 1: NORMAL TRACKING]         [MODE 2: SERVER-SIDE GTM (sGTM)]
                   │                                 │
                   ▼                                 ▼
   Third-Party Vendors               Server-Side GTM Container
   (Google Analytics, Meta,          (Stape, Google Cloud Run, AWS)
    Hotjar, TikTok, Clarity)                         │
                                                     ▼
                                            Tag Assistant Preview
                                            & Upstream Ad Vendors
```

---

## 2. Tracking Paradigms: Normal (Client-Direct) vs. Server-Side (sGTM)

It is crucial to understand the difference between how the SDK operates in **Normal Tracking** versus **Server-Side Tagging (sGTM)**:

| Feature / Dimension | Mode 1: Normal (Client-Direct via Relay) | Mode 2: Server-Side Tagging (sGTM via Relay) |
| :--- | :--- | :--- |
| **Final Destination** | Directly to the third-party vendor (e.g. `google-analytics.com`, `facebook.com`). | To your private Server-Side GTM container (e.g. `https://tpozgxiu.usu.stape.io`). |
| **Proxy Responsibility** | Masks third-party domains as first-party `/_tatvic/relay` calls to defeat browser content blockers. | Acts as an ingress gateway, forwarding hits to sGTM and ensuring preview/debug headers match active debug sessions. |
| **Cookie Ownership** | Browser-set client cookies (e.g., standard JavaScript `_ga` cookies, restricted by Safari ITP to 1–7 days). | Server-set `HttpOnly`, `Secure` cookies (`FPID`, `FPLC`) with full 2-year lifespans impervious to browser cookie deletion. |
| **Data Enrichment & Privacy** | Browser sends raw telemetry directly to the external vendor. | sGTM intercepts telemetry, redacts PII (IP, emails), attaches internal API secrets, and dispatches server-to-server. |
| **Debugger Interface** | Browser DevTools Console / GA4 DebugView. | **Google Tag Assistant** sGTM Debugger (`tagassistant.google.com`) using live WebSocket/HTTP debug streaming. |

---

## 3. Generalised Backend Specification (Any Language or Reverse Proxy)

Regardless of what programming language or server gateway you use (Node.js, Python, Go, PHP, Java, Ruby, Nginx, Cloudflare Workers, Caddy), your backend must implement two simple HTTP endpoints:

### Endpoint 1: The First-Party Telemetry Relay (`/_tatvic/relay`)

Receives proxied telemetry from client browsers and safely forwards it to the upstream destination.

#### Incoming Request Protocol:
- **HTTP Methods**: `GET`, `POST`, `OPTIONS`
- **Target Extraction**:
  1. Check HTTP Header: `x-tatvic-target` (or `x-relay-target`).
  2. Fallback Query Parameter: `?_tgt=<url_encoded_target_url>`.
- **Server Preview Token Extraction**:
  1. Check HTTP Header: `x-gtm-server-preview`.
  2. Fallback Query Parameter: `?_gtm_server_preview=` or `?gtm_server_preview=`.

#### Relay Execution Steps:
1. **SSRF Defense (Strict Domain Whitelist)**:
   Verify that the target URL's hostname belongs to a permitted analytics/tracking service (e.g. `google-analytics.com`, `stape.io`, `facebook.com`). **Reject all non-whitelisted destinations with HTTP 403 Forbidden**.
2. **Optional Destination Redirection (for sGTM)**:
   If your backend is configured with `serverContainerUrl` (e.g., `https://your-sgtm.stape.io`), any incoming requests targeting `google-analytics.com/g/collect` can have their origin dynamically rewritten to your sGTM container URL.
3. **Header Sanitization**:
   - **Strip**: `host`, `authorization`, `connection`, and unnecessary internal cookies.
   - **Set / Forward**:
     - `x-forwarded-for`: Client's real public IP address.
     - `user-agent`: Client's actual User-Agent string.
     - `x-gtm-server-preview`: Active preview token (if present).
4. **Debug Flag Injection (GA4 / sGTM)**:
   If an active preview token is present, ensure `_dbg=1` and `ep.debug_mode=true` are added to the search parameters so events immediately appear in GA4 DebugView and sGTM Preview.
5. **Upstream Forwarding & Response Pass-Through**:
   - Forward HTTP method, headers, and request body.
   - Return upstream response status code, headers, and body.
   - **CRITICAL**: Pass through `Set-Cookie` headers (e.g. `FPID`, `FPLC`) to the client browser.

---

### Endpoint 2: The Morphed GTM Script Loader (`/_tatvic/loader.js`)

Ad blockers block `googletagmanager.com/gtm.js?id=GTM-XXXX` and EasyPrivacy rules match `id=GTM-`. The Morphed Loader loads GTM server-to-server and rewrites internal tracking endpoints.

#### Incoming Request Protocol:
- **Route**: `GET /_tatvic/loader.js` (or `/gtm.js`)
- **Query Parameter**: `cid=GTM-XXXX` (using `cid` instead of `id` avoids EasyPrivacy ad-blocker regex matches).

#### Loader Execution Steps:
1. **Fetch from Google**:
   Fetch `https://www.googletagmanager.com/gtm.js?id={cid}` server-to-server.
2. **Passthrough Tag Assistant Debug Flags**:
   Pass through `gtm_debug`, `gtm_auth`, `gtm_preview`, and `gtm_cookies_win` to Google so workspace drafts are served during preview sessions.
3. **Endpoint Rewriting (Morphing)**:
   Replace external tracking domains with the first-party relay:
   - `https://www.google-analytics.com/` → `/_tatvic/relay?_tgt=https%3A%2F%2Fwww.google-analytics.com%2F`
   - `https://analytics.google.com/` → `/_tatvic/relay?_tgt=https%3A%2F%2Fanalytics.google.com%2F`
   - `https://www.googleadservices.com/` → `/_tatvic/relay?_tgt=https%3A%2F%2Fwww.googleadservices.com%2F`
   - `https://ad.doubleclick.net/` → `/_tatvic/relay?_tgt=https%3A%2F%2Fad.doubleclick.net%2F`
   *(DO NOT rewrite `tagassistant.google.com`—this preserves the preview postMessage handshake).*
4. **Caching Headers**:
   - In production: `Cache-Control: public, max-age=900`.
   - When `gtm_debug` is present: `Cache-Control: no-cache, no-store, must-revalidate`.

---

### Backend Implementation Examples

#### A. Nginx Reverse Proxy (Zero Application Code)

```nginx
# 1. Morphed GTM Script Loader
location = /_tatvic/loader.js {
    # Evade EasyPrivacy by mapping ?cid= to Google's upstream ?id=
    set $gtm_id $arg_cid;
    if ($gtm_id = "") {
        set $gtm_id $arg_id;
    }

    proxy_pass https://www.googletagmanager.com/gtm.js?id=$gtm_id;
    proxy_set_header Host www.googletagmanager.com;
    proxy_set_header User-Agent $http_user_agent;
    proxy_ssl_server_name on;

    # Morph endpoints on the fly using nginx sub_filter
    sub_filter_types application/javascript;
    sub_filter 'https://www.google-analytics.com/' '/_tatvic/relay?_tgt=https%3A%2F%2Fwww.google-analytics.com%2F';
    sub_filter 'https://analytics.google.com/' '/_tatvic/relay?_tgt=https%3A%2F%2Fanalytics.google.com%2F';
    sub_filter 'https://www.googleadservices.com/' '/_tatvic/relay?_tgt=https%3A%2F%2Fwww.googleadservices.com%2F';
    sub_filter_once off;
}

# 2. First-Party Telemetry Relay
location = /_tatvic/relay {
    # Target URL passed in header or query parameter
    set $target $http_x_tatvic_target;
    if ($target = "") {
        set $target $arg__tgt;
    }

    proxy_pass $target;
    proxy_set_header Host $proxy_host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Gtm-Server-Preview $http_x_gtm_server_preview;
    proxy_ssl_server_name on;
    proxy_pass_request_headers on;
}
```

#### B. Generic Node.js / Express / Bun Handler

```typescript
import { createProxyHandler, tatvicExpressMiddleware } from 'tatvic-implementation-sdk';

// Using standard web Request/Response (Next.js, Bun, Cloudflare Workers, Fastify):
const relay = createProxyHandler({
  // Forward to sGTM container (if using Server-Side GTM)
  serverContainerUrl: 'https://your-sgtm-domain.com',
  // Optional default preview token
  serverPreviewToken: 'ZW52LTd8...'
});

export async function handleRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_tatvic/')) {
    return relay(request);
  }
}

// Or using Express:
app.use('/_tatvic', tatvicExpressMiddleware({
  serverContainerUrl: 'https://your-sgtm-domain.com'
}));
```

#### C. Generic Python (FastAPI / Starlette) Handler

```python
import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI()

ALLOWED_DOMAINS = ["google-analytics.com", "analytics.google.com", "stape.io", "facebook.com"]

@app.api_route("/_tatvic/relay", methods=["GET", "POST", "OPTIONS"])
async def tatvic_relay(request: Request):
    target_url = request.headers.get("x-tatvic-target") or request.query_params.get("_tgt")
    if not target_url:
        return Response(content='{"error":"Missing target"}', status_code=400)

    # SSRF verification
    from urllib.parse import urlparse
    domain = urlparse(target_url).netloc
    if not any(domain.endswith(allowed) for allowed in ALLOWED_DOMAINS):
        return Response(content='{"error":"Domain not allowed"}', status_code=403)

    # Forward headers
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "authorization"]}
    headers["x-forwarded-for"] = request.client.host
    preview = request.headers.get("x-gtm-server-preview") or request.query_params.get("_gtm_server_preview")
    if preview:
        headers["x-gtm-server-preview"] = preview

    body = await request.body()
    async with httpx.AsyncClient() as client:
        upstream_resp = await client.request(
            method=request.method,
            url=target_url,
            content=body,
            headers=headers
        )
    
    # Return response with Set-Cookie preserved
    resp = Response(content=upstream_resp.content, status_code=upstream_resp.status_code)
    for k, v in upstream_resp.headers.items():
        if k.lower() in ["set-cookie", "content-type", "trace-id"]:
            resp.headers[k] = v
    return resp
```

---

## 4. Generalised Frontend Integration (Any Website / HTML / CMS)

The client SDK can be embedded into **any frontend stack** (Vanilla JS, WordPress, PHP, React, Angular, Vue, Svelte, Shopify, Webflow) without requiring framework-specific libraries.

### Method 1: The Universal Custom Element `<tatvic-wrapper>`

Simply load the browser script and wrap your document or body in `<tatvic-wrapper>`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>First-Party Protected Website</title>

  <!-- 1. Load the Tatvic standalone script in <head> -->
  <script src="/dist/tatvic.js"></script>
  <!-- Or from unpkg / jsdelivr:
  <script src="https://unpkg.com/tatvic-implementation-sdk@1.0.0/dist/tatvic.js"></script>
  -->
</head>
<body>
  <!-- 2. Wrap your application with <tatvic-wrapper> -->
  <!-- Attributes:
         endpoint:       custom proxy path (defaults to /_tatvic/relay)
         server-preview: active sGTM preview header token (for sGTM debugging)
         debug:          "true" for console diagnostics
  -->
  <tatvic-wrapper server-preview="ZW52LTd8...">
    
    <!-- 3. First-Party Stealth GTM Loader (Bypasses uBlock Origin & EasyPrivacy) -->
    <script async src="/_tatvic/loader.js?cid=GTM-T32XGF8F"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      // FOR NORMAL TRACKING:
      // gtag('config', 'G-XXXXXXXXXX');

      // FOR SERVER-SIDE GTM (sGTM):
      gtag('config', 'G-VVBCZC9JSW', {
        server_container_url: 'https://tpozgxiu.usu.stape.io',
        transport_url: 'https://tpozgxiu.usu.stape.io'
      });
    </script>

    <div id="content">
      <h1>Protected Application</h1>
      <button id="lead-btn">Submit Lead</button>
    </div>

  </tatvic-wrapper>

  <script>
    document.getElementById('lead-btn').addEventListener('click', function() {
      // Standard GTM DataLayer Event
      window.dataLayer.push({
        event: 'generate_lead',
        value: 49.99,
        currency: 'USD'
      });
    });
  </script>
</body>
</html>
```

### Method 2: Programmatic JavaScript API

If you prefer to initialize the interceptor programmatically via JavaScript (e.g., inside single-page applications or script loaders):

```javascript
import { initFirstPartyWrapper, uninstallFirstPartyWrapper } from 'tatvic-implementation-sdk';

// Initialize with zero configuration (uses /_tatvic/relay by default)
const interceptor = initFirstPartyWrapper({
  proxyEndpoint: '/_tatvic/relay',
  serverPreviewToken: 'ZW52LTd8...', // Optional sGTM preview token
  debug: false
});

// To restore native browser APIs at any point:
// uninstallFirstPartyWrapper();
```

---

## 5. Server-Side GTM (sGTM): Avoiding Common Pitfalls

When sending GA4 hits to a Server-Side GTM container (such as Stape, Google Cloud Run, or AWS), keep these three architectural requirements in mind:

### Pitfall 1: The Duplicate Parameter Conflict (HTTP 400 Bad Request)
The sandboxed JavaScript GA4 Client parser inside Server-Side GTM enforces strict parameter types.
- If you pass `v=2&tid=G-XXXXX` in the URL query string **and also** pass `v=2&tid=G-XXXXX` in the POST body, sGTM parses them as arrays (`['2', '2']`).
- Strict equality checks (`v === '2'`) fail, and sGTM rejects the hit immediately with:
  `HTTP 400 Bad Request: "Invalid request — Your server GTM container received the request, but could not process it."`

**The Correct Request Formats for sGTM**:
- **Format A (Recommended POST)**: URL contains routing query params; body contains event payload:
  ```http
  POST /g/collect?v=2&tid=G-VVBCZC9JSW
  Content-Type: text/plain
  
  cid=123.456&sid=111&en=generate_lead&ep.value=49.99&ep.currency=USD
  ```
- **Format B (Query String Only)**:
  ```http
  POST /g/collect?v=2&tid=G-VVBCZC9JSW&cid=123.456&sid=111&en=generate_lead&ep.value=49.99
  (Empty Body)
  ```

### Pitfall 2: Web Container Configuration Settings
In Google Tag Manager:
- Make sure your Google Configuration Tag (`__gct`) or Google Tag Event Settings Variable has `server_container_url` set to your server container endpoint (e.g. `https://tpozgxiu.usu.stape.io`).
- Alternatively, with the Tatvic SDK backend `serverContainerUrl` option enabled, the proxy will automatically route all GA4 collect hits to your server container, even if the web tags point to `google-analytics.com`.

### Pitfall 3: Preview Token Session Structure & Expiration
Server-Side GTM Preview tokens use a base64 string formatted as:
`env-<id>|<container_auth_key>|<debug_session_id>`
- The third segment is a **transient debug session ID**.
- Whenever you close or refresh Tag Assistant, a **new session ID is generated**.
- If an old token is sent, the server container will still accept the hit (`HTTP 200`), but **it will not appear in the open Tag Assistant window**. Always copy the fresh token from Tag Assistant when debugging.

---

## 6. Verification & Testing Runbook

To confirm your integration is functioning correctly and successfully evading ad blockers:

```
[Test Step]                                    [Expected Observation in Network Tab]
──────────────────────────────────────────────────────────────────────────────────────────
1. Enable uBlock Origin / Brave Shields.       Shields indicator shows active blocking.
2. Load page.                                  GET /_tatvic/loader.js?cid=GTM-XXXX -> 200 OK
                                               (No ERR_BLOCKED_BY_CLIENT error).
3. Trigger conversion event (click button).    POST /_tatvic/relay -> 200 OK
                                               Header: x-tatvic-target: https://...
4. Check Response Headers.                     Set-Cookie: FPID=FPID2.1...; HttpOnly; Secure
5. Open Tag Assistant sGTM Preview.            Incoming hit displays with event name & payload.
6. Open GA4 Admin > DebugView.                 Event displays in realtime event stream.
```

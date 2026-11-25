/**
 * Helper to detect active Server-Side GTM Preview & Debug tokens from current URL,
 * sessionStorage, cookies, or wrapper configuration.
 */
export function detectPreviewToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    // 1. Check window.__TATVIC_PREVIEW_TOKEN set by wrapper element
    if ((window as any).__TATVIC_PREVIEW_TOKEN) {
      return (window as any).__TATVIC_PREVIEW_TOKEN;
    }

    // 2. Check URL search parameters
    if (window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const token =
        params.get('gtm_server_preview') ||
        params.get('_gtm_server_preview') ||
        params.get('server_preview') ||
        params.get('gtm_preview');
      if (token) {
        try {
          sessionStorage.setItem('_tatvic_preview_token', token);
        } catch {}
        return token;
      }
    }

    // 3. Check sessionStorage (persists across page navigations in preview session)
    try {
      const saved = sessionStorage.getItem('_tatvic_preview_token');
      if (saved) return saved;
    } catch {}

    // 4. Check document.cookie for GTM preview cookies
    if (typeof document !== 'undefined' && document.cookie) {
      const match = document.cookie.match(
        /(?:^|;\s*)(?:_gtm_server_preview|gtm_server_preview|gtm_preview)=([^;]+)/
      );
      if (match && match[1]) return decodeURIComponent(match[1]);
    }

    return undefined;
  } catch {
    return undefined;
  }
}

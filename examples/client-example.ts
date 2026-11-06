import { initFirstPartyWrapper } from '../src/index.js';

// 1. Initialize the client-side interceptor at the entry point of your web app.
// Any calls to fetch(), XMLHttpRequest, or sendBeacon() targeting the specified
// third-party domains will be rewritten to your first-party proxy endpoint.
initFirstPartyWrapper({
  // Point to your server-side route
  proxyEndpoint: '/api/v1/relay',

  // Target domains to intercept (third-party trackers/analytics)
  targetDomains: [
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com',
    'connect.facebook.net',
    'clarity.ms',
    'tiktok.com',
  ],

  // Exclude payments, authentication, and other critical third parties
  excludeDomains: [
    'api.stripe.com',
    'auth0.com',
  ],

  // Transmit upstream destination via custom header
  targetHeaderName: 'x-relay-target',

  // Enable console debugging in development
  debug: true,
});

// Example: Standard Google Analytics call initiated by gtag or direct fetch
// This will now be routed directly to /api/v1/relay on your first-party domain!
fetch('https://www.google-analytics.com/g/collect?v=2&tid=G-XXXXX', {
  method: 'POST',
  body: 'event=purchase&value=49.99',
})
  .then((res) => console.log('Proxied analytics response status:', res.status))
  .catch((err) => console.error('Analytics error:', err));

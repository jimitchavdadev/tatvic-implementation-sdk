/**
 * Comprehensive pre-configured lists for zero-configuration setup.
 */

export const DEFAULT_PROXY_ENDPOINT = '/_tatvic/relay';
export const DEFAULT_HEADER_NAME = 'x-tatvic-target';

/**
 * Pre-configured list of all major third-party tracking, analytics, and advertising domains.
 */
export const DEFAULT_TARGET_DOMAINS: (string | RegExp)[] = [
  // Google Analytics & Google Tag Manager
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'stats.g.doubleclick.net',
  'googleadservices.com',
  'googleads.g.doubleclick.net',
  'pagead2.googlesyndication.com',
  'google.com',

  // Server-Side GTM Providers (Stape, Cloud Run, App Engine)
  'stape.io',
  'stape.net',
  'a.run.app',
  'appspot.com',

  // Meta / Facebook Pixel & CAPI
  'connect.facebook.net',
  'facebook.com',
  'graph.facebook.com',
  'facebook.net',

  // Microsoft Clarity & Bing Ads
  'clarity.ms',
  'c.bing.com',
  'bat.bing.com',

  // TikTok Pixel
  'analytics.tiktok.com',
  'tiktok.com',

  // Hotjar
  'static.hotjar.com',
  'script.hotjar.com',
  'in.hotjar.com',

  // Twitter / X Ads
  'static.ads-twitter.com',
  'ads-twitter.com',

  // LinkedIn Insight Tag
  'snap.licdn.com',
  'px.ads.linkedin.com',

  // Pinterest Tag
  'ct.pinterest.com',
  'pintrk.com',

  // Snapchat Pixel
  'sc-static.net',
  'tr.snapchat.com',

  // Criteo
  'static.criteo.net',
  'sslwidget.criteo.com',

  // Outbrain / Taboola
  'widgets.outbrain.com',
  'tr.outbrain.com',
  'cdn.taboola.com',
  'trc.taboola.com',

  // Product Analytics & CDPs
  'segment.io',
  'api.segment.io',
  'cdn.segment.com',
  'mixpanel.com',
  'api-js.mixpanel.com',
  'amplitude.com',
  'api.amplitude.com',
  'api2.amplitude.com',
  'heapanalytics.com',
  'cdn.heapanalytics.com',
  'posthog.com',
  'app.posthog.com',
  'eu.posthog.com',
];

/**
 * Sensitive services that must NEVER be intercepted (payment, auth, core cloud).
 */
export const DEFAULT_EXCLUDE_DOMAINS: (string | RegExp)[] = [
  // Payments
  'api.stripe.com',
  'js.stripe.com',
  'm.stripe.network',
  'paypal.com',
  'sandbox.paypal.com',
  'razorpay.com',
  'checkout.razorpay.com',
  'square.com',
  'squareup.com',

  // Authentication & Identity
  'auth0.com',
  'clerk.dev',
  'clerk.com',
  'supabase.co',
  'firebaseio.com',
  'accounts.google.com',
  'appleid.apple.com',

  // Core Cloud Infrastructure
  'amazonaws.com',
  'googleapis.com',
  'cloudflare.com',
];

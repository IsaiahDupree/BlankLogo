/**
 * Meta Pixel Integration
 * 
 * Client-side tracking for Meta Ads (Facebook/Instagram)
 * 
 * Standard Events (for optimization):
 * - PageView: automatic on every page
 * - ViewContent: landing, features, pricing, gallery pages
 * - Lead: waitlist, demo request, partial signup
 * - CompleteRegistration: successful account creation
 * - InitiateCheckout: before Stripe redirect
 * - Subscribe: subscription activated (mirror from CAPI)
 * - Purchase: one-time credit purchase (mirror from CAPI)
 * 
 * Custom Events (for retargeting):
 * - GenerateRequested: user clicks "Remove Watermark"
 * - JobStarted: job status becomes processing
 * - MediaReady: job completed, output available
 * - Download: user downloads the artifact
 * - Share: user shares/copies link
 * 
 * CAPI Deduplication:
 * - Generate event_id for InitiateCheckout/Purchase/Subscribe
 * - Same event_id sent to server for CAPI deduplication
 */

// Types for Meta Pixel events
export interface MetaPixelConfig {
  pixelId: string;
  autoConfig?: boolean;
  debug?: boolean;
}

export interface MetaEventParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  event_id?: string; // For CAPI deduplication
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════
// EVENT ID GENERATION (for CAPI deduplication)
// ═══════════════════════════════════════════════════════════════════

export function generateEventId(prefix: string = 'evt'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

// Extend Window interface for fbq
declare global {
  interface Window {
    fbq: (
      action: string,
      eventOrPixelId: string,
      params?: MetaEventParams | Record<string, unknown>
    ) => void;
    _fbq: unknown;
  }
}

// Initialize Meta Pixel with stub function (standard Facebook pattern)
export function initMetaPixel(config: MetaPixelConfig): void {
  if (typeof window === 'undefined') return;
  
  const { pixelId, autoConfig = true, debug = false } = config;
  
  if (!pixelId) {
    if (debug) console.warn('[Meta Pixel] No pixel ID provided');
    return;
  }

  // Check if already initialized
  if (window.fbq && typeof window.fbq === 'function' && (window.fbq as unknown as { loaded?: boolean }).loaded) {
    if (debug) console.log('[Meta Pixel] Already initialized');
    return;
  }

  // Create fbq stub function BEFORE loading script (standard Facebook pattern)
  // This allows tracking calls to be queued before script loads
  const fbq = function(...args: unknown[]) {
    (fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] }).callMethod
      ? (fbq as unknown as { callMethod: (...a: unknown[]) => void }).callMethod(...args)
      : (fbq as unknown as { queue: unknown[] }).queue.push(args);
  };
  
  // Initialize queue
  (fbq as unknown as { queue: unknown[]; loaded: boolean; version: string }).queue = [];
  (fbq as unknown as { loaded: boolean }).loaded = false;
  (fbq as unknown as { version: string }).version = '2.0';
  
  // Set on window
  if (!window.fbq) {
    window.fbq = fbq as typeof window.fbq;
  }
  window._fbq = window.fbq;

  // Now safe to call fbq - it will queue the calls
  window.fbq('init', pixelId);
  
  if (autoConfig) {
    window.fbq('track', 'PageView');
  }

  if (debug) {
    console.log('[Meta Pixel] Stub initialized with ID:', pixelId);
  }

  // Load the actual Meta Pixel script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onerror = () => {
    if (debug) console.warn('[Meta Pixel] Failed to load script');
  };
  
  const firstScript = document.getElementsByTagName('script')[0];
  firstScript?.parentNode?.insertBefore(script, firstScript);
}

// Track standard events
export function trackEvent(
  eventName: string,
  params?: MetaEventParams,
  options?: { debug?: boolean }
): void {
  if (typeof window === 'undefined' || !window.fbq) {
    if (options?.debug) console.warn('[Meta Pixel] Not initialized');
    return;
  }

  if (params) {
    window.fbq('track', eventName, params);
  } else {
    window.fbq('track', eventName);
  }

  if (options?.debug) {
    console.log('[Meta Pixel] Event tracked:', eventName, params);
  }
}

// Track custom events
export function trackCustomEvent(
  eventName: string,
  params?: MetaEventParams,
  options?: { debug?: boolean }
): void {
  if (typeof window === 'undefined' || !window.fbq) {
    if (options?.debug) console.warn('[Meta Pixel] Not initialized');
    return;
  }

  if (params) {
    window.fbq('trackCustom', eventName, params);
  } else {
    window.fbq('trackCustom', eventName);
  }

  if (options?.debug) {
    console.log('[Meta Pixel] Custom event tracked:', eventName, params);
  }
}

// ═══════════════════════════════════════════════════════════════════
// STANDARD EVENT HELPERS
// ═══════════════════════════════════════════════════════════════════

// Page View - automatically tracked on init
export function trackPageView(debug?: boolean): void {
  trackEvent('PageView', undefined, { debug });
}

// View Content - when user views a product/service
export function trackViewContent(params: {
  contentName: string;
  contentCategory?: string;
  contentId?: string;
  value?: number;
  currency?: string;
}, debug?: boolean): void {
  trackEvent('ViewContent', {
    content_name: params.contentName,
    content_category: params.contentCategory,
    content_ids: params.contentId ? [params.contentId] : undefined,
    value: params.value,
    currency: params.currency || 'USD',
  }, { debug });
}

// Add to Cart - when user adds credits to cart
export function trackAddToCart(params: {
  contentName: string;
  contentId: string;
  value: number;
  currency?: string;
  quantity?: number;
}, debug?: boolean): void {
  trackEvent('AddToCart', {
    content_name: params.contentName,
    content_ids: [params.contentId],
    content_type: 'product',
    value: params.value,
    currency: params.currency || 'USD',
    num_items: params.quantity || 1,
    contents: [{
      id: params.contentId,
      quantity: params.quantity || 1,
      item_price: params.value,
    }],
  }, { debug });
}

// Initiate Checkout - when user starts checkout
export function trackInitiateCheckout(params: {
  contentIds: string[];
  value: number;
  currency?: string;
  numItems?: number;
}, debug?: boolean): void {
  trackEvent('InitiateCheckout', {
    content_ids: params.contentIds,
    content_type: 'product',
    value: params.value,
    currency: params.currency || 'USD',
    num_items: params.numItems || 1,
  }, { debug });
}

// Purchase - when user completes purchase
export function trackPurchase(params: {
  contentIds: string[];
  contentName?: string;
  value: number;
  currency?: string;
  numItems?: number;
  orderId?: string;
}, debug?: boolean): void {
  trackEvent('Purchase', {
    content_ids: params.contentIds,
    content_name: params.contentName,
    content_type: 'product',
    value: params.value,
    currency: params.currency || 'USD',
    num_items: params.numItems || 1,
  }, { debug });
}

// Lead - when user signs up
export function trackLead(params?: {
  contentName?: string;
  value?: number;
  currency?: string;
}, debug?: boolean): void {
  trackEvent('Lead', params ? {
    content_name: params.contentName,
    value: params.value,
    currency: params.currency || 'USD',
  } : undefined, { debug });
}

// Complete Registration - when user completes signup
export function trackCompleteRegistration(params?: {
  contentName?: string;
  value?: number;
  currency?: string;
  status?: string;
}, debug?: boolean): void {
  trackEvent('CompleteRegistration', params ? {
    content_name: params.contentName,
    value: params.value,
    currency: params.currency || 'USD',
    status: params.status,
  } : undefined, { debug });
}

// Subscribe - when user subscribes (standard Meta event)
export function trackSubscribe(params: {
  contentIds: string[];
  contentName?: string;
  value: number;
  currency?: string;
  predictedLtv?: number;
  eventId?: string; // For CAPI deduplication
}, debug?: boolean): void {
  const eventId = params.eventId || generateEventId('sub');
  trackEvent('Subscribe', {
    content_ids: params.contentIds,
    content_name: params.contentName,
    content_type: 'product',
    value: params.value,
    currency: params.currency || 'USD',
    predicted_ltv: params.predictedLtv,
    event_id: eventId,
  }, { debug });
}

// ═══════════════════════════════════════════════════════════════════
// VIEWCONTENT HELPERS (for intent pages)
// ═══════════════════════════════════════════════════════════════════

// Track landing page view (from ads)
export function trackViewLanding(params?: {
  variant?: string;
  source?: string;
}, debug?: boolean): void {
  trackViewContent({
    contentName: 'Landing Page',
    contentCategory: 'landing',
    contentId: params?.variant,
  }, debug);
}

// Track features page view
export function trackViewFeatures(debug?: boolean): void {
  trackViewContent({
    contentName: 'Features Page',
    contentCategory: 'features',
  }, debug);
}

// Track pricing page view
export function trackViewPricing(debug?: boolean): void {
  trackViewContent({
    contentName: 'Pricing Page',
    contentCategory: 'pricing',
  }, debug);
}

// Track gallery/examples page view
export function trackViewGallery(debug?: boolean): void {
  trackViewContent({
    contentName: 'Gallery Page',
    contentCategory: 'gallery',
  }, debug);
}

// ═══════════════════════════════════════════════════════════════════
// CHECKOUT EVENTS (with event_id for CAPI dedup)
// ═══════════════════════════════════════════════════════════════════

// Track when user selects a credit pack (AddToCart)
export function trackSelectCreditPack(params: {
  packName: string;
  packId: string;
  price: number;
  credits: number;
}, debug?: boolean): void {
  trackAddToCart({
    contentName: params.packName,
    contentId: params.packId,
    value: params.price,
    quantity: 1,
  }, debug);
}

// Track when user starts Stripe checkout (returns event_id for CAPI)
export function trackStartCheckout(params: {
  packId: string;
  packName?: string;
  price: number;
  credits: number;
}, debug?: boolean): string {
  const eventId = generateEventId('checkout');
  trackInitiateCheckout({
    contentIds: [params.packId],
    value: params.price,
    numItems: 1,
  }, debug);
  // Store event_id for passing to Stripe metadata (for CAPI dedup)
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('bl_checkout_event_id', eventId);
  }
  return eventId;
}

// Track successful credit purchase
export function trackCreditPurchase(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
  orderId?: string;
}, debug?: boolean): void {
  trackPurchase({
    contentIds: [params.packId],
    contentName: params.packName,
    value: params.price,
    numItems: 1,
    orderId: params.orderId,
  }, debug);
}

// Track subscription purchase (client-side mirror for CAPI dedup)
export function trackSubscriptionPurchase(params: {
  planId: string;
  planName: string;
  price: number;
  interval?: 'month' | 'year';
  eventId?: string; // Must match CAPI event_id
}, debug?: boolean): void {
  const eventId = params.eventId || sessionStorage.getItem('bl_checkout_event_id') || generateEventId('sub');
  trackSubscribe({
    contentIds: [params.planId],
    contentName: params.planName,
    value: params.price,
    eventId,
  }, debug);
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM EVENTS: MEDIA JOB FLOW (for retargeting)
// ═══════════════════════════════════════════════════════════════════

// GenerateRequested - user clicks "Remove Watermark" button
export function trackGenerateRequested(params: {
  platform: string;
  processingMode: string;
  jobId?: string;
}, debug?: boolean): void {
  trackCustomEvent('GenerateRequested', {
    content_category: 'watermark_removal',
    content_name: params.platform,
    content_ids: params.jobId ? [params.jobId] : undefined,
    processing_mode: params.processingMode,
  }, { debug });
}

// JobStarted - job status becomes "processing"
export function trackJobStarted(params: {
  jobId: string;
  platform: string;
}, debug?: boolean): void {
  trackCustomEvent('JobStarted', {
    content_category: 'watermark_removal',
    content_ids: [params.jobId],
    content_name: params.platform,
  }, { debug });
}

// MediaReady - job completed, output available (key activation moment)
export function trackMediaReady(params: {
  jobId: string;
  platform: string;
  processingTimeMs?: number;
}, debug?: boolean): void {
  trackCustomEvent('MediaReady', {
    content_category: 'watermark_removal',
    content_ids: [params.jobId],
    content_name: params.platform,
    processing_time_ms: params.processingTimeMs,
  }, { debug });
}

// Download - user downloads the artifact
export function trackDownload(params: {
  jobId: string;
  platform?: string;
  fileSizeBytes?: number;
}, debug?: boolean): void {
  trackCustomEvent('Download', {
    content_category: 'watermark_removal',
    content_ids: [params.jobId],
    content_name: params.platform,
    file_size_bytes: params.fileSizeBytes,
  }, { debug });
}

// Share - user shares/copies link
export function trackShare(params: {
  jobId: string;
  method?: 'copy_link' | 'social' | 'email';
}, debug?: boolean): void {
  trackCustomEvent('Share', {
    content_category: 'watermark_removal',
    content_ids: [params.jobId],
    share_method: params.method,
  }, { debug });
}

// ═══════════════════════════════════════════════════════════════════
// LEGACY ALIAS (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════

// @deprecated Use trackGenerateRequested instead
export const trackJobCreated = trackGenerateRequested;

/**
 * Meta Pixel Integration
 * 
 * Client-side tracking for Meta Ads (Facebook/Instagram)
 * Standard events: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
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
  [key: string]: unknown;
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

// Initialize Meta Pixel
export function initMetaPixel(config: MetaPixelConfig): void {
  if (typeof window === 'undefined') return;
  
  const { pixelId, autoConfig = true, debug = false } = config;
  
  if (!pixelId) {
    if (debug) console.warn('[Meta Pixel] No pixel ID provided');
    return;
  }

  // Check if already initialized
  if (typeof window.fbq === 'function') {
    if (debug) console.log('[Meta Pixel] Already initialized');
    return;
  }

  // Load the Meta Pixel script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.onload = () => {
    // Initialize pixel after script loads
    if (window.fbq) {
      window.fbq('init', pixelId);
      
      if (autoConfig) {
        window.fbq('track', 'PageView');
      }

      if (debug) {
        console.log('[Meta Pixel] Initialized with ID:', pixelId);
      }
    }
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

// ═══════════════════════════════════════════════════════════════════
// BLANKLOGO-SPECIFIC EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track when user views pricing page
export function trackViewPricing(debug?: boolean): void {
  trackViewContent({
    contentName: 'Pricing Page',
    contentCategory: 'pricing',
  }, debug);
}

// Track when user selects a credit pack
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

// Track when user starts Stripe checkout
export function trackStartCheckout(params: {
  packId: string;
  price: number;
  credits: number;
}, debug?: boolean): void {
  trackInitiateCheckout({
    contentIds: [params.packId],
    value: params.price,
    numItems: 1,
  }, debug);
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

// Track job creation
export function trackJobCreated(params: {
  platform: string;
  processingMode: string;
}, debug?: boolean): void {
  trackCustomEvent('JobCreated', {
    content_category: 'watermark_removal',
    content_name: params.platform,
  }, { debug });
}

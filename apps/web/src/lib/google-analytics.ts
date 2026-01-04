/**
 * Google Analytics 4 (GA4) Integration
 * 
 * Client-side tracking for Google Analytics
 * Uses gtag.js for event tracking
 */

// Configuration
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

// Types
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

// Initialize Google Analytics
export function initGA(): void {
  if (typeof window === 'undefined') return;
  
  if (!GA_MEASUREMENT_ID) {
    console.warn('[GA4] No measurement ID provided');
    return;
  }

  // Check if already initialized
  if (typeof window.gtag === 'function') {
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Set initial timestamp
  window.gtag('js', new Date().toISOString());
  
  // Configure GA4
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
    send_page_view: true,
  });

  // Load the GA4 script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  console.log('[GA4] Initialized with ID:', GA_MEASUREMENT_ID);
}

// Track page views
export function trackPageView(url: string, title?: string): void {
  if (typeof window === 'undefined' || !window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
    page_title: title,
  });
}

// Track custom events
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number,
  additionalParams?: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
    ...additionalParams,
  });
}

// ═══════════════════════════════════════════════════════════════════
// E-COMMERCE EVENTS (GA4 Enhanced E-commerce)
// ═══════════════════════════════════════════════════════════════════

// View item (product page)
export function trackViewItem(params: {
  itemId: string;
  itemName: string;
  price: number;
  currency?: string;
  category?: string;
}): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'view_item', {
    currency: params.currency || 'USD',
    value: params.price,
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      price: params.price,
      item_category: params.category,
      quantity: 1,
    }],
  });
}

// Add to cart
export function trackAddToCart(params: {
  itemId: string;
  itemName: string;
  price: number;
  quantity?: number;
  currency?: string;
}): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'add_to_cart', {
    currency: params.currency || 'USD',
    value: params.price * (params.quantity || 1),
    items: [{
      item_id: params.itemId,
      item_name: params.itemName,
      price: params.price,
      quantity: params.quantity || 1,
    }],
  });
}

// Begin checkout
export function trackBeginCheckout(params: {
  items: Array<{ itemId: string; itemName: string; price: number; quantity?: number }>;
  value: number;
  currency?: string;
  coupon?: string;
}): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'begin_checkout', {
    currency: params.currency || 'USD',
    value: params.value,
    coupon: params.coupon,
    items: params.items.map(item => ({
      item_id: item.itemId,
      item_name: item.itemName,
      price: item.price,
      quantity: item.quantity || 1,
    })),
  });
}

// Purchase complete
export function trackPurchase(params: {
  transactionId: string;
  items: Array<{ itemId: string; itemName: string; price: number; quantity?: number }>;
  value: number;
  currency?: string;
  tax?: number;
  coupon?: string;
}): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'purchase', {
    transaction_id: params.transactionId,
    currency: params.currency || 'USD',
    value: params.value,
    tax: params.tax,
    coupon: params.coupon,
    items: params.items.map(item => ({
      item_id: item.itemId,
      item_name: item.itemName,
      price: item.price,
      quantity: item.quantity || 1,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════
// USER EVENTS
// ═══════════════════════════════════════════════════════════════════

// User signup
export function trackSignUp(method?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'sign_up', {
    method: method || 'email',
  });
}

// User login
export function trackLogin(method?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'login', {
    method: method || 'email',
  });
}

// Set user ID (for cross-device tracking)
export function setUserId(userId: string): void {
  if (typeof window === 'undefined' || !window.gtag || !GA_MEASUREMENT_ID) return;

  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: userId,
  });
}

// ═══════════════════════════════════════════════════════════════════
// BLANKLOGO-SPECIFIC EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track credit pack selection
export function trackSelectCreditPack(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
}): void {
  trackAddToCart({
    itemId: params.packId,
    itemName: params.packName,
    price: params.price,
  });
}

// Track credit purchase
export function trackCreditPurchase(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
  transactionId?: string;
}): void {
  trackPurchase({
    transactionId: params.transactionId || `txn_${Date.now()}`,
    items: [{
      itemId: params.packId,
      itemName: params.packName,
      price: params.price,
    }],
    value: params.price,
  });
}

// Track job creation
export function trackJobCreated(params: {
  platform: string;
  processingMode: string;
}): void {
  trackEvent('job_created', 'watermark_removal', params.platform, undefined, {
    processing_mode: params.processingMode,
  });
}

// Track job completion
export function trackJobCompleted(params: {
  platform: string;
  processingTimeMs: number;
}): void {
  trackEvent('job_completed', 'watermark_removal', params.platform, params.processingTimeMs);
}

// Check if GA is configured
export function isConfigured(): boolean {
  return !!GA_MEASUREMENT_ID;
}

export default {
  initGA,
  trackPageView,
  trackEvent,
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackSignUp,
  trackLogin,
  setUserId,
  trackSelectCreditPack,
  trackCreditPurchase,
  trackJobCreated,
  trackJobCompleted,
  isConfigured,
};

/**
 * PostHog Integration
 * 
 * Product analytics, feature flags, session recording
 * https://posthog.com/docs/libraries/js
 */

import posthog from 'posthog-js';

// Configuration
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

// Initialize PostHog
export function initPostHog(): void {
  if (typeof window === 'undefined') return;
  
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] No API key provided');
    return;
  }

  if (initialized) {
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
    },
    loaded: () => {
      // Disable in development if needed
      if (process.env.NODE_ENV === 'development') {
        // posthog.opt_out_capturing(); // Uncomment to disable in dev
        console.log('[PostHog] Initialized (dev mode)');
      }
    },
  });

  initialized = true;
  console.log('[PostHog] Initialized');
}

// Track page views manually (if autocapture disabled)
export function trackPageView(url?: string): void {
  if (!initialized) return;
  
  posthog.capture('$pageview', {
    $current_url: url || window.location.href,
  });
}

// Track custom events
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  
  posthog.capture(eventName, properties);
}

// ═══════════════════════════════════════════════════════════════════
// USER IDENTIFICATION
// ═══════════════════════════════════════════════════════════════════

// Identify user
export function identify(
  userId: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  
  posthog.identify(userId, properties);
}

// Set user properties
export function setUserProperties(properties: Record<string, unknown>): void {
  if (!initialized) return;
  
  posthog.people.set(properties);
}

// Reset user (on logout)
export function reset(): void {
  if (!initialized) return;
  
  posthog.reset();
}

// ═══════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════

// Check if feature flag is enabled
export function isFeatureEnabled(flagKey: string): boolean {
  if (!initialized) return false;
  
  return posthog.isFeatureEnabled(flagKey) ?? false;
}

// Get feature flag value
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!initialized) return undefined;
  
  return posthog.getFeatureFlag(flagKey);
}

// Get all feature flags
export function getAllFeatureFlags(): Record<string, string | boolean> {
  if (!initialized) return {};
  
  return posthog.featureFlags.getFlagVariants() || {};
}

// Reload feature flags
export function reloadFeatureFlags(): void {
  if (!initialized) return;
  
  posthog.reloadFeatureFlags();
}

// ═══════════════════════════════════════════════════════════════════
// GROUPS (for B2B analytics)
// ═══════════════════════════════════════════════════════════════════

// Set group
export function setGroup(
  groupType: string,
  groupKey: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized) return;
  
  posthog.group(groupType, groupKey, properties);
}

// ═══════════════════════════════════════════════════════════════════
// E-COMMERCE EVENTS
// ═══════════════════════════════════════════════════════════════════

// View product
export function trackViewProduct(params: {
  productId: string;
  productName: string;
  price: number;
  currency?: string;
  category?: string;
}): void {
  trackEvent('product_viewed', {
    product_id: params.productId,
    product_name: params.productName,
    price: params.price,
    currency: params.currency || 'USD',
    category: params.category,
  });
}

// Add to cart
export function trackAddToCart(params: {
  productId: string;
  productName: string;
  price: number;
  quantity?: number;
  currency?: string;
}): void {
  trackEvent('product_added_to_cart', {
    product_id: params.productId,
    product_name: params.productName,
    price: params.price,
    quantity: params.quantity || 1,
    currency: params.currency || 'USD',
    value: params.price * (params.quantity || 1),
  });
}

// Begin checkout
export function trackBeginCheckout(params: {
  products: Array<{ id: string; name: string; price: number; quantity?: number }>;
  value: number;
  currency?: string;
}): void {
  trackEvent('checkout_started', {
    products: params.products,
    value: params.value,
    currency: params.currency || 'USD',
  });
}

// Purchase complete
export function trackPurchase(params: {
  orderId: string;
  products: Array<{ id: string; name: string; price: number; quantity?: number }>;
  value: number;
  currency?: string;
}): void {
  trackEvent('purchase_completed', {
    order_id: params.orderId,
    products: params.products,
    value: params.value,
    currency: params.currency || 'USD',
    revenue: params.value,
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
    productId: params.packId,
    productName: params.packName,
    price: params.price,
  });
}

// Track credit purchase
export function trackCreditPurchase(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
  orderId?: string;
}): void {
  trackPurchase({
    orderId: params.orderId || `order_${Date.now()}`,
    products: [{
      id: params.packId,
      name: params.packName,
      price: params.price,
    }],
    value: params.price,
  });
  
  // Also track as revenue event
  trackEvent('revenue', {
    amount: params.price,
    currency: 'USD',
    product: params.packName,
    credits: params.credits,
  });
}

// Track job creation
export function trackJobCreated(params: {
  jobId: string;
  platform: string;
  processingMode: string;
  inputType: 'url' | 'upload';
}): void {
  trackEvent('job_created', {
    job_id: params.jobId,
    platform: params.platform,
    processing_mode: params.processingMode,
    input_type: params.inputType,
  });
}

// Track job completion
export function trackJobCompleted(params: {
  jobId: string;
  platform: string;
  processingTimeMs: number;
  success: boolean;
}): void {
  trackEvent('job_completed', {
    job_id: params.jobId,
    platform: params.platform,
    processing_time_ms: params.processingTimeMs,
    success: params.success,
  });
}

// Track user signup
export function trackSignUp(params: {
  userId: string;
  method: string;
  email?: string;
}): void {
  identify(params.userId, {
    email: params.email,
    signup_method: params.method,
    created_at: new Date().toISOString(),
  });
  
  trackEvent('user_signed_up', {
    method: params.method,
  });
}

// Track user login
export function trackLogin(params: {
  userId: string;
  method: string;
}): void {
  identify(params.userId);
  
  trackEvent('user_logged_in', {
    method: params.method,
  });
}

// Check if PostHog is configured
export function isConfigured(): boolean {
  return !!POSTHOG_KEY;
}

// Get PostHog instance (for advanced usage)
export function getPostHog() {
  return initialized ? posthog : null;
}

export default {
  initPostHog,
  trackPageView,
  trackEvent,
  identify,
  setUserProperties,
  reset,
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  reloadFeatureFlags,
  setGroup,
  trackViewProduct,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
  trackSelectCreditPack,
  trackCreditPurchase,
  trackJobCreated,
  trackJobCompleted,
  trackSignUp,
  trackLogin,
  isConfigured,
  getPostHog,
};

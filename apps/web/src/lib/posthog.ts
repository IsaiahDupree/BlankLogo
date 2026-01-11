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

// Track user logout
export function trackLogout(): void {
  trackEvent('user_logged_out');
  reset();
}

// ═══════════════════════════════════════════════════════════════════
// VIDEO UPLOAD & PROCESSING EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track video upload started
export function trackVideoUploadStarted(params: {
  fileSize: number;
  fileType: string;
  platform: string;
}): void {
  trackEvent('video_upload_started', {
    file_size_mb: Math.round(params.fileSize / 1024 / 1024 * 100) / 100,
    file_type: params.fileType,
    platform: params.platform,
  });
}

// Track video upload completed
export function trackVideoUploadCompleted(params: {
  fileSize: number;
  uploadTimeMs: number;
  platform: string;
}): void {
  trackEvent('video_upload_completed', {
    file_size_mb: Math.round(params.fileSize / 1024 / 1024 * 100) / 100,
    upload_time_ms: params.uploadTimeMs,
    platform: params.platform,
  });
}

// Track URL submitted
export function trackUrlSubmitted(params: {
  platform: string;
  urlDomain?: string;
}): void {
  trackEvent('url_submitted', {
    platform: params.platform,
    url_domain: params.urlDomain,
  });
}

// Track platform selected
export function trackPlatformSelected(params: {
  platform: string;
  previousPlatform?: string;
}): void {
  trackEvent('platform_selected', {
    platform: params.platform,
    previous_platform: params.previousPlatform,
  });
}

// Track job progress update
export function trackJobProgress(params: {
  jobId: string;
  progress: number;
  status: string;
}): void {
  trackEvent('job_progress', {
    job_id: params.jobId,
    progress: params.progress,
    status: params.status,
  });
}

// Track job failed
export function trackJobFailed(params: {
  jobId: string;
  platform: string;
  errorCode?: string;
  errorMessage?: string;
}): void {
  trackEvent('job_failed', {
    job_id: params.jobId,
    platform: params.platform,
    error_code: params.errorCode,
    error_message: params.errorMessage,
  });
}

// Track video download
export function trackVideoDownload(params: {
  jobId: string;
  platform: string;
  fileSize?: number;
}): void {
  trackEvent('video_downloaded', {
    job_id: params.jobId,
    platform: params.platform,
    file_size_mb: params.fileSize ? Math.round(params.fileSize / 1024 / 1024 * 100) / 100 : undefined,
  });
}

// ═══════════════════════════════════════════════════════════════════
// CREDITS & BILLING EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track credits viewed
export function trackCreditsViewed(params: {
  currentBalance: number;
}): void {
  trackEvent('credits_viewed', {
    current_balance: params.currentBalance,
  });
}

// Track credit pack viewed
export function trackCreditPackViewed(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
}): void {
  trackEvent('credit_pack_viewed', {
    pack_id: params.packId,
    pack_name: params.packName,
    price: params.price,
    credits: params.credits,
    price_per_credit: Math.round(params.price / params.credits * 100) / 100,
  });
}

// Track checkout started
export function trackCheckoutStarted(params: {
  packId: string;
  packName: string;
  price: number;
  credits: number;
}): void {
  trackEvent('checkout_started', {
    pack_id: params.packId,
    pack_name: params.packName,
    price: params.price,
    credits: params.credits,
  });
}

// Track checkout abandoned
export function trackCheckoutAbandoned(params: {
  packId: string;
  reason?: string;
}): void {
  trackEvent('checkout_abandoned', {
    pack_id: params.packId,
    reason: params.reason,
  });
}

// Track insufficient credits
export function trackInsufficientCredits(params: {
  currentBalance: number;
  requiredCredits: number;
  action: string;
}): void {
  trackEvent('insufficient_credits', {
    current_balance: params.currentBalance,
    required_credits: params.requiredCredits,
    action: params.action,
  });
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION & ENGAGEMENT EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track page time spent
export function trackTimeOnPage(params: {
  page: string;
  timeSpentMs: number;
}): void {
  trackEvent('time_on_page', {
    page: params.page,
    time_spent_seconds: Math.round(params.timeSpentMs / 1000),
  });
}

// Track CTA clicked
export function trackCtaClicked(params: {
  ctaName: string;
  ctaLocation: string;
  page: string;
}): void {
  trackEvent('cta_clicked', {
    cta_name: params.ctaName,
    cta_location: params.ctaLocation,
    page: params.page,
  });
}

// Track feature used
export function trackFeatureUsed(params: {
  feature: string;
  context?: string;
}): void {
  trackEvent('feature_used', {
    feature: params.feature,
    context: params.context,
  });
}

// Track settings changed
export function trackSettingsChanged(params: {
  setting: string;
  oldValue?: string | boolean | number;
  newValue: string | boolean | number;
}): void {
  trackEvent('settings_changed', {
    setting: params.setting,
    old_value: params.oldValue,
    new_value: params.newValue,
  });
}

// ═══════════════════════════════════════════════════════════════════
// ERROR & SUPPORT EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track error occurred
export function trackError(params: {
  errorType: string;
  errorMessage: string;
  page?: string;
  component?: string;
}): void {
  trackEvent('error_occurred', {
    error_type: params.errorType,
    error_message: params.errorMessage,
    page: params.page,
    component: params.component,
  });
}

// Track API error
export function trackApiError(params: {
  endpoint: string;
  statusCode: number;
  errorMessage?: string;
}): void {
  trackEvent('api_error', {
    endpoint: params.endpoint,
    status_code: params.statusCode,
    error_message: params.errorMessage,
  });
}

// Track support requested
export function trackSupportRequested(params: {
  type: 'chat' | 'email' | 'docs';
  page: string;
}): void {
  trackEvent('support_requested', {
    type: params.type,
    page: params.page,
  });
}

// ═══════════════════════════════════════════════════════════════════
// ONBOARDING & ACTIVATION EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track onboarding step
export function trackOnboardingStep(params: {
  step: number;
  stepName: string;
  completed: boolean;
}): void {
  trackEvent('onboarding_step', {
    step: params.step,
    step_name: params.stepName,
    completed: params.completed,
  });
}

// Track first job completed (activation)
export function trackActivation(params: {
  userId: string;
  platform: string;
  daysFromSignup: number;
}): void {
  trackEvent('user_activated', {
    platform: params.platform,
    days_from_signup: params.daysFromSignup,
  });
  
  setUserProperties({
    activated: true,
    activation_date: new Date().toISOString(),
    activation_platform: params.platform,
  });
}

// ═══════════════════════════════════════════════════════════════════
// MARKETING & ATTRIBUTION EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track UTM parameters
export function trackUtmParams(params: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): void {
  if (params.utmSource || params.utmMedium || params.utmCampaign) {
    trackEvent('utm_captured', {
      utm_source: params.utmSource,
      utm_medium: params.utmMedium,
      utm_campaign: params.utmCampaign,
      utm_content: params.utmContent,
      utm_term: params.utmTerm,
    });
    
    setUserProperties({
      initial_utm_source: params.utmSource,
      initial_utm_medium: params.utmMedium,
      initial_utm_campaign: params.utmCampaign,
    });
  }
}

// Track referral
export function trackReferral(params: {
  referralCode: string;
  referrerId?: string;
}): void {
  trackEvent('referral_used', {
    referral_code: params.referralCode,
    referrer_id: params.referrerId,
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
  trackLogout,
  trackVideoUploadStarted,
  trackVideoUploadCompleted,
  trackUrlSubmitted,
  trackPlatformSelected,
  trackJobProgress,
  trackJobFailed,
  trackVideoDownload,
  trackCreditsViewed,
  trackCreditPackViewed,
  trackCheckoutStarted,
  trackCheckoutAbandoned,
  trackInsufficientCredits,
  trackTimeOnPage,
  trackCtaClicked,
  trackFeatureUsed,
  trackSettingsChanged,
  trackError,
  trackApiError,
  trackSupportRequested,
  trackOnboardingStep,
  trackActivation,
  trackUtmParams,
  trackReferral,
  isConfigured,
  getPostHog,
};

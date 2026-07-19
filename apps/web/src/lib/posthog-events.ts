/**
 * PostHog Event Taxonomy for BlankLogo
 * 
 * Event naming: past-tense (e.g., auth_signed_in, job_completed)
 * Categories: auth_*, upload_*, job_*, billing_*, error_*, system_*
 * 
 * Required correlation IDs on most events:
 * - user_id, session_id, request_id, job_id (when applicable)
 */

import posthog from 'posthog-js';

// ═══════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════

export type Environment = 'development' | 'staging' | 'production';
export type Platform = 'web' | 'worker' | 'modal';
export type Source = 'ui' | 'api' | 'worker' | 'modal';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type FailureStage = 'validate' | 'download' | 'modal' | 'upload' | 'db_update';

// Normalized error codes
export type ErrorCode = 
  | 'E_INPUT_INVALID'
  | 'E_AUTH_FAILED'
  | 'E_AUTH_EXPIRED'
  | 'E_STORAGE_DOWNLOAD'
  | 'E_STORAGE_UPLOAD'
  | 'E_MODAL_429'
  | 'E_MODAL_TIMEOUT'
  | 'E_MODAL_500'
  | 'E_MODAL_COLD_START'
  | 'E_DB_UPDATE'
  | 'E_INSUFFICIENT_CREDITS'
  | 'E_RATE_LIMITED'
  | 'E_UNKNOWN';

// Base properties included in all events
export interface BaseProperties {
  environment: Environment;
  app_version?: string;
  git_sha?: string;
  platform: Platform;
  source: Source;
}

// Correlation IDs
export interface CorrelationIds {
  user_id?: string;
  session_id?: string;
  request_id?: string;
  job_id?: string;
  video_id?: string;
}

// Timing properties
export interface TimingProperties {
  duration_ms?: number;
  queue_wait_ms?: number;
  download_ms?: number;
  process_ms?: number;
  upload_ms?: number;
  cold_start_ms?: number;
}

// Size properties
export interface SizeProperties {
  payload_mb?: number;
  output_mb?: number;
  input_mb?: number;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

// Get current environment
function getEnvironment(): Environment {
  if (typeof window === 'undefined') return 'production';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'development';
  if (host.includes('staging') || host.includes('preview')) return 'staging';
  return 'production';
}

// Get base properties for all events
function getBaseProperties(): BaseProperties {
  return {
    environment: getEnvironment(),
    app_version: process.env.NEXT_PUBLIC_APP_VERSION,
    git_sha: process.env.NEXT_PUBLIC_GIT_SHA,
    platform: 'web',
    source: 'ui',
  };
}

// Generate request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export function initPostHog(): void {
  if (typeof window === 'undefined') return;
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] No API key provided');
    return;
  }
  if (initialized) return;

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
      if (getEnvironment() === 'development') {
        console.log('[PostHog] Initialized (dev mode)');
      }
    },
  });

  initialized = true;
}

// Core track function with base properties
function track<T extends object>(eventName: string, properties: T): void {
  if (!initialized) return;
  
  posthog.capture(eventName, {
    ...getBaseProperties(),
    ...properties,
    timestamp: new Date().toISOString(),
  } as Record<string, unknown>);
}

// Identify user
export function identify(userId: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

// Reset on logout
export function reset(): void {
  if (!initialized) return;
  posthog.reset();
}

// Get session ID
export function getSessionId(): string | undefined {
  if (!initialized) return undefined;
  return posthog.get_session_id();
}

// ═══════════════════════════════════════════════════════════════════
// ATTRIBUTION HELPERS
// ═══════════════════════════════════════════════════════════════════

export interface AttributionParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ad_platform?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  creative_id?: string;
  ad_angle?: string;
  landing_variant?: string;
  referrer?: string;
}

// Get attribution from URL params (call on landing)
export function getAttributionFromUrl(): AttributionParams {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    utm_term: params.get('utm_term') || undefined,
    fbclid: params.get('fbclid') || undefined,
    gclid: params.get('gclid') || undefined,
    campaign_id: params.get('campaign_id') || undefined,
    adset_id: params.get('adset_id') || undefined,
    ad_id: params.get('ad_id') || undefined,
    referrer: document.referrer || undefined,
  };
}

// Store attribution in sessionStorage for later events
export function persistAttribution(attrs: AttributionParams): void {
  if (typeof window === 'undefined') return;
  const existing = getPersistedAttribution();
  const merged = { ...existing, ...attrs };
  sessionStorage.setItem('bl_attribution', JSON.stringify(merged));
}

// Get persisted attribution
export function getPersistedAttribution(): AttributionParams {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem('bl_attribution');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACQUISITION EVENTS (ad → site)
// ═══════════════════════════════════════════════════════════════════

export const acquisition = {
  /** Landing page viewed (from ad or organic) */
  landingView: (props: AttributionParams & { 
    page_path: string; 
    device?: string; 
    geo?: string;
  }) => {
    // Auto-persist attribution on landing
    persistAttribution(props);
    track('landing_view', { ...getPersistedAttribution(), ...props });
  },

  /** CTA clicked (Get Free Credits, Get Started, etc.) */
  ctaClick: (props: { 
    cta_text: string; 
    cta_location: 'hero' | 'pricing' | 'sticky' | 'footer' | string;
    page_path: string;
  }) => {
    track('cta_click', { ...getPersistedAttribution(), ...props });
  },

  /** Pricing page viewed */
  pricingView: (props?: { plan_viewed?: string }) => {
    track('pricing_view', { ...getPersistedAttribution(), ...props });
  },

  /** FAQ section expanded */
  faqExpand: (props: { question: string; category?: string }) => {
    track('faq_expand', props);
  },

  /** Scroll depth milestone reached */
  scrollDepth: (props: { depth: 25 | 50 | 75 | 100; page_path: string }) => {
    track('scroll_depth', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// A) AUTH EVENTS
// ═══════════════════════════════════════════════════════════════════

export const auth = {
  /** User viewed login page */
  loginViewed: (props: { referrer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }) => {
    track('auth_login_viewed', props);
  },

  /** Signup flow started (form opened) */
  signupStart: (props?: { source?: string }) => {
    track('signup_start', { ...getPersistedAttribution(), ...props });
  },

  /** Signup form submitted */
  signupSubmit: (props: { email_domain: string }) => {
    track('signup_submit', { ...getPersistedAttribution(), ...props });
  },

  /** Magic link requested */
  magicLinkRequested: (props: { email_domain: string; is_existing_user?: boolean }) => {
    track('auth_magic_link_requested', props);
  },

  /** Auth email sent (server-side, mirrored here) */
  authEmailSent: (props: { email_domain: string }) => {
    track('auth_email_sent', props);
  },

  /** Auth email link clicked (callback loaded) */
  authEmailLinkClicked: () => {
    track('auth_email_link_clicked', {});
  },

  /** Magic link request failed */
  magicLinkRequestFailed: (props: { error_code: ErrorCode; http_status?: number }) => {
    track('auth_magic_link_request_failed', props);
  },

  /** Magic link opened (callback page loaded) */
  magicLinkOpened: (props: { provider?: string } = {}) => {
    track('auth_magic_link_opened', { provider: props.provider || 'supabase' });
  },

  /** User signed in */
  signedIn: (props: { user_id: string; method: 'magic_link' | 'email' | 'oauth'; is_new_user: boolean; email?: string }) => {
    identify(props.user_id, { email: props.email, signup_method: props.method });
    track('auth_signed_in', props);
  },

  /** User signed out */
  signedOut: () => {
    track('auth_signed_out', {});
    reset();
  },

  /** Session expired */
  sessionExpired: (props: { user_id?: string }) => {
    track('auth_session_expired', props);
  },

  /** User provisioning started (profile creation) */
  provisioningStarted: (props: { user_id: string }) => {
    track('auth_provisioning_started', props);
  },

  /** User provisioning completed */
  provisioningCompleted: (props: { user_id: string; credits_granted?: number }) => {
    track('auth_provisioning_completed', props);
  },

  /** User provisioning failed */
  provisioningFailed: (props: { user_id: string; error_code: ErrorCode }) => {
    track('auth_provisioning_failed', props);
  },

  /** Activation complete - user is ready to use the product */
  activationComplete: (props: { user_id: string; credits_balance: number; time_to_activate_ms?: number }) => {
    track('activation_complete', { ...getPersistedAttribution(), ...props });
  },
};

// ═══════════════════════════════════════════════════════════════════
// RETENTION EVENTS
// ═══════════════════════════════════════════════════════════════════

export const retention = {
  /** Return session - user came back after X hours/days */
  returnSession: (props: { 
    days_since_last_visit: number; 
    hours_since_last_visit: number;
    is_first_return?: boolean;
  }) => {
    track('return_session', props);
  },

  /** First upload in a returning session */
  uploadReturningUser: (props: CorrelationIds & { days_since_last_job?: number }) => {
    track('upload_returning_user', props);
  },

  /** Job completed by returning user */
  jobCompletedReturningUser: (props: CorrelationIds & { 
    days_since_last_job: number;
    total_jobs_completed: number;
  }) => {
    track('job_completed_returning_user', props);
  },

  /** Low credits warning shown */
  lowCreditsWarningShown: (props: { 
    credits_balance: number; 
    threshold: number;
    location: 'upload' | 'dashboard' | 'post_job';
  }) => {
    track('low_credits_warning_shown', props);
  },

  /** Low credits topup clicked */
  lowCreditsTopupClicked: (props: { credits_balance: number; location: string }) => {
    track('low_credits_topup_clicked', props);
  },

  /** Notification sent (job complete email/webhook) */
  notificationSent: (props: CorrelationIds & { 
    type: 'job_complete' | 'job_failed' | 'credits_low' | 'weekly_summary';
    channel: 'email' | 'webhook';
  }) => {
    track('notification_sent', props);
  },

  /** Notification clicked (user clicked link in email) */
  notificationClicked: (props: CorrelationIds & { 
    type: string;
    channel: 'email' | 'webhook';
  }) => {
    track('notification_clicked', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// B) ONBOARDING & BILLING EVENTS
// ═══════════════════════════════════════════════════════════════════

export const onboarding = {
  started: (props: CorrelationIds) => {
    track('onboarding_started', props);
  },

  stepCompleted: (props: CorrelationIds & { step: number; step_name: string }) => {
    track('onboarding_step_completed', props);
  },

  completed: (props: CorrelationIds) => {
    track('onboarding_completed', props);
  },

  skipped: (props: CorrelationIds & { step?: number }) => {
    track('onboarding_skipped', props);
  },
};

export const billing = {
  /** Paywall viewed */
  paywallViewed: (props: CorrelationIds & { placement: 'upload_gate' | 'export_gate' | 'credits_page' }) => {
    track('billing_paywall_viewed', props);
  },

  /** Checkout started */
  checkoutStarted: (props: CorrelationIds & { plan: string; price_id: string; credits: number; amount_cents: number }) => {
    track('billing_checkout_started', props);
  },

  /** Checkout completed */
  checkoutCompleted: (props: CorrelationIds & { plan: string; price_id: string; credits: number; amount_cents: number; order_id?: string }) => {
    track('billing_checkout_completed', { ...props, revenue: props.amount_cents / 100 });
  },

  /** Checkout failed */
  checkoutFailed: (props: CorrelationIds & { plan: string; error_code?: ErrorCode; http_status?: number }) => {
    track('billing_checkout_failed', props);
  },

  /** Checkout abandoned */
  checkoutAbandoned: (props: CorrelationIds & { plan: string; reason?: string }) => {
    track('billing_checkout_abandoned', props);
  },

  /** Credits insufficient */
  insufficientCredits: (props: CorrelationIds & { current_balance: number; required: number; action: string }) => {
    track('billing_insufficient_credits', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// C) UPLOAD EVENTS
// ═══════════════════════════════════════════════════════════════════

export const upload = {
  /** Upload started */
  started: (props: CorrelationIds & { file_ext: string; file_mb: number; codec?: string }) => {
    track('upload_started', props);
  },

  /** Upload progress (sampled: 0, 25, 50, 75, 100) */
  progress: (props: CorrelationIds & { percent: number }) => {
    if ([0, 25, 50, 75, 100].includes(props.percent)) {
      track('upload_progress', props);
    }
  },

  /** Upload completed */
  completed: (props: CorrelationIds & { upload_ms: number; storage_provider?: string; file_mb: number }) => {
    track('upload_completed', props);
  },

  /** Upload failed */
  failed: (props: CorrelationIds & { failure_reason: string; error_code?: ErrorCode }) => {
    track('upload_failed', props);
  },

  /** URL submitted (instead of file upload) */
  urlSubmitted: (props: CorrelationIds & { url_domain: string; platform: string }) => {
    track('upload_url_submitted', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// D) JOB LIFECYCLE EVENTS
// ═══════════════════════════════════════════════════════════════════

export const job = {
  // --- Created / Queued ---
  
  /** Job created (Vercel API) */
  created: (props: CorrelationIds & { job_type: string; input_mb?: number; platform: string; input_type: 'url' | 'upload' }) => {
    track('job_created', { ...props, status: 'created' as JobStatus });
  },

  /** Job queued */
  queued: (props: CorrelationIds & { queue?: string }) => {
    track('job_queued', { ...props, status: 'queued' as JobStatus });
  },

  // --- Dispatch / Worker ---

  /** Job dequeued by worker */
  dequeued: (props: CorrelationIds & { attempt: number }) => {
    track('job_dequeued', props);
  },

  /** Job dispatched to Modal */
  dispatched: (props: CorrelationIds & { provider: 'modal'; gpu_type?: string }) => {
    track('job_dispatched', props);
  },

  /** Job dispatch failed */
  dispatchFailed: (props: CorrelationIds & { http_status?: number; attempt: number; error_code: ErrorCode }) => {
    track('job_dispatch_failed', props);
  },

  // --- Execution (Modal) ---

  /** Job started processing */
  started: (props: CorrelationIds & { cold_start_ms?: number; gpu_type?: string }) => {
    track('job_started', { ...props, status: 'running' as JobStatus });
  },

  /** Job stage started */
  stageStarted: (props: CorrelationIds & { stage: 'yolo_detect' | 'lama_inpaint' | 'encode' | string }) => {
    track('job_stage_started', props);
  },

  /** Job stage completed */
  stageCompleted: (props: CorrelationIds & { stage: string; duration_ms: number }) => {
    track('job_stage_completed', props);
  },

  /** Job progress (sampled: 0, 25, 50, 75, 100) */
  progress: (props: CorrelationIds & { percent: number; stage?: string }) => {
    if ([0, 25, 50, 75, 100].includes(props.percent)) {
      track('job_progress', props);
    }
  },

  // --- Output ---

  /** Output upload started */
  outputUploadStarted: (props: CorrelationIds & { output_mb?: number }) => {
    track('job_output_upload_started', props);
  },

  /** Output upload completed */
  outputUploadCompleted: (props: CorrelationIds & { upload_ms: number; output_mb?: number }) => {
    track('job_output_upload_completed', props);
  },

  /** Job completed successfully */
  completed: (props: CorrelationIds & { 
    total_duration_ms: number; 
    output_mb?: number; 
    watermarks_detected?: number;
    platform: string;
  }) => {
    track('job_completed', { ...props, status: 'completed' as JobStatus });
  },

  /** Job failed */
  failed: (props: CorrelationIds & { 
    failure_stage: FailureStage; 
    error_code: ErrorCode; 
    http_status?: number; 
    attempt?: number;
    platform: string;
  }) => {
    track('job_failed', { ...props, status: 'failed' as JobStatus });
  },

  // --- User Interaction ---

  /** Result viewed */
  resultViewed: (props: CorrelationIds) => {
    track('job_result_viewed', props);
  },

  /** Download clicked */
  downloadClicked: (props: CorrelationIds & { platform: string }) => {
    track('job_download_clicked', props);
  },

  /** Download completed */
  downloadCompleted: (props: CorrelationIds & { file_mb?: number }) => {
    track('job_download_completed', props);
  },

  // --- Retry / Queue Management ---

  /** Retry scheduled */
  retryScheduled: (props: CorrelationIds & { attempt: number; backoff_ms: number; reason: string }) => {
    track('job_retry_scheduled', props);
  },

  /** Dead lettered */
  deadLettered: (props: CorrelationIds & { attempts: number; final_error_code: ErrorCode }) => {
    track('job_dead_lettered', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// E) ERROR EVENTS
// ═══════════════════════════════════════════════════════════════════

export const error = {
  /** UI error */
  ui: (props: CorrelationIds & { error_code: ErrorCode; route: string; component?: string; message?: string }) => {
    track('error_ui', props);
  },

  /** API error */
  api: (props: CorrelationIds & { route: string; http_status: number; error_code: ErrorCode; message?: string }) => {
    track('error_api', props);
  },

  /** Worker error */
  worker: (props: CorrelationIds & { failure_stage: FailureStage; attempt: number; error_code: ErrorCode; message?: string }) => {
    track('error_worker', props);
  },

  /** Modal error */
  modal: (props: CorrelationIds & { stage: string; error_code: ErrorCode; gpu_type?: string; cold_start_ms?: number; message?: string }) => {
    track('error_modal', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// F) SYSTEM EVENTS
// ═══════════════════════════════════════════════════════════════════

export const system = {
  /** Health check */
  healthCheck: (props: { 
    service: 'vercel_api' | 'supabase_db' | 'supabase_storage' | 'redis' | 'modal_health';
    status: 'ok' | 'degraded' | 'down';
    latency_ms?: number;
  }) => {
    track('system_health_check', props);
  },

  /** Queue depth sampled (periodic) */
  queueDepthSampled: (props: { queue_depth: number; active_jobs: number; delayed_jobs: number }) => {
    track('system_queue_depth_sampled', props);
  },

  /** Provider capacity warning */
  capacityWarning: (props: { provider: string; gpu_type?: string; reason: 'no_capacity' | 'rate_limited' }) => {
    track('system_capacity_warning', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// G) PROMO EVENTS
// ═══════════════════════════════════════════════════════════════════

export const promo = {
  /** Promo landing page viewed */
  landingViewed: (props: { 
    campaign_id: string; 
    utm_source?: string; 
    utm_campaign?: string; 
    fbclid_present?: boolean;
    gclid_present?: boolean;
  }) => {
    track('promo_landing_viewed', props);
  },

  /** Promo token issued (cookie set) */
  tokenIssued: (props: { campaign_id: string; expires_at: number }) => {
    track('promo_token_issued', props);
  },

  /** Promo redemption attempted */
  redeemAttempted: (props: { campaign_id: string }) => {
    track('promo_redeem_attempted', props);
  },

  /** Promo credits awarded successfully */
  creditsAwarded: (props: { campaign_id: string; credits: number; new_balance: number }) => {
    track('promo_credits_awarded', props);
  },

  /** Promo redemption blocked */
  redeemBlocked: (props: { 
    campaign_id: string; 
    reason: 'no_token' | 'invalid_token' | 'expired' | 'already_redeemed' | 'user_not_new' | 'campaign_maxed' | 'campaign_disabled' | 'rate_limited';
  }) => {
    track('promo_redeem_blocked', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// H) CREDIT EVENTS
// ═══════════════════════════════════════════════════════════════════

export const credits = {
  /** Credits awarded (any reason) */
  awarded: (props: { 
    rule_id?: string; 
    credits_delta: number; 
    reason: string; 
    event_id?: string;
    new_balance: number;
  }) => {
    track('credits_awarded', props);
  },

  /** Credits spent (job charge) */
  spent: (props: CorrelationIds & { 
    credits_delta: number; 
    balance_after: number;
  }) => {
    track('credits_spent', props);
  },

  /** Credits balance low warning */
  balanceLow: (props: { balance: number; threshold: number }) => {
    track('credits_balance_low', props);
  },

  /** Credits balance depleted */
  depleted: (props: CorrelationIds) => {
    track('credits_depleted', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// I) NAVIGATION & PAGE EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const navigation = {
  /** Page viewed with full context */
  pageViewed: (props: {
    page_path: string;
    page_title?: string;
    referrer?: string;
    time_on_previous_page_ms?: number;
    scroll_depth_previous?: number;
    entry_type?: 'direct' | 'internal' | 'external' | 'back';
  }) => {
    track('page_viewed', { ...getPersistedAttribution(), ...props });
  },

  /** Page left (for session analysis) */
  pageLeft: (props: {
    page_path: string;
    time_on_page_ms: number;
    scroll_depth_max: number;
    interactions_count: number;
    exit_type: 'navigation' | 'close' | 'external';
  }) => {
    track('page_left', props);
  },

  /** Internal navigation clicked */
  linkClicked: (props: {
    from_path: string;
    to_path: string;
    link_text?: string;
    link_location: 'nav' | 'sidebar' | 'content' | 'footer' | 'cta' | 'card';
  }) => {
    track('link_clicked', props);
  },

  /** Back/forward navigation */
  historyNavigation: (props: {
    direction: 'back' | 'forward';
    from_path: string;
    to_path: string;
  }) => {
    track('history_navigation', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// J) UI INTERACTION EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const ui = {
  /** Button clicked */
  buttonClicked: (props: {
    button_text: string;
    button_id?: string;
    button_type: 'primary' | 'secondary' | 'icon' | 'link' | 'submit' | 'toggle';
    page_path: string;
    section?: string;
  }) => {
    track('button_clicked', props);
  },

  /** Tab/mode switched */
  tabSwitched: (props: {
    from_tab: string;
    to_tab: string;
    tab_group: string;
    page_path: string;
  }) => {
    track('tab_switched', props);
  },

  /** Dropdown/select changed */
  selectChanged: (props: {
    field_name: string;
    from_value?: string;
    to_value: string;
    page_path: string;
  }) => {
    track('select_changed', props);
  },

  /** Toggle switched */
  toggleSwitched: (props: {
    toggle_name: string;
    new_value: boolean;
    page_path: string;
    section?: string;
  }) => {
    track('toggle_switched', props);
  },

  /** Modal/dialog opened */
  modalOpened: (props: {
    modal_name: string;
    trigger: string;
    page_path: string;
  }) => {
    track('modal_opened', props);
  },

  /** Modal/dialog closed */
  modalClosed: (props: {
    modal_name: string;
    close_method: 'button' | 'backdrop' | 'escape' | 'action';
    time_open_ms: number;
    page_path: string;
  }) => {
    track('modal_closed', props);
  },

  /** Tooltip/popover shown */
  tooltipShown: (props: {
    tooltip_id: string;
    trigger_element: string;
    page_path: string;
  }) => {
    track('tooltip_shown', props);
  },

  /** Accordion/expandable expanded */
  sectionExpanded: (props: {
    section_name: string;
    is_expanded: boolean;
    page_path: string;
  }) => {
    track('section_expanded', props);
  },

  /** Copy to clipboard */
  copiedToClipboard: (props: {
    content_type: 'url' | 'code' | 'text' | 'id';
    page_path: string;
    element_id?: string;
  }) => {
    track('copied_to_clipboard', props);
  },

  /** Drag and drop action */
  dragDropAction: (props: {
    action: 'drag_start' | 'drag_end' | 'drop';
    element_type: string;
    page_path: string;
    success?: boolean;
  }) => {
    track('drag_drop_action', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// K) FORM INTERACTION EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const form = {
  /** Form started (first interaction) */
  formStarted: (props: {
    form_name: string;
    page_path: string;
    first_field?: string;
  }) => {
    track('form_started', props);
  },

  /** Form field focused */
  fieldFocused: (props: {
    form_name: string;
    field_name: string;
    field_type: 'text' | 'email' | 'password' | 'url' | 'file' | 'select' | 'textarea' | 'checkbox';
    page_path: string;
  }) => {
    track('field_focused', props);
  },

  /** Form field blurred (left) */
  fieldBlurred: (props: {
    form_name: string;
    field_name: string;
    has_value: boolean;
    time_focused_ms: number;
    page_path: string;
  }) => {
    track('field_blurred', props);
  },

  /** Form field validation error shown */
  fieldError: (props: {
    form_name: string;
    field_name: string;
    error_type: 'required' | 'format' | 'length' | 'custom';
    error_message?: string;
    page_path: string;
  }) => {
    track('field_error', props);
  },

  /** Form submitted */
  formSubmitted: (props: {
    form_name: string;
    page_path: string;
    time_to_complete_ms: number;
    fields_filled: number;
    fields_total: number;
  }) => {
    track('form_submitted', props);
  },

  /** Form abandoned (left without submit) */
  formAbandoned: (props: {
    form_name: string;
    page_path: string;
    time_spent_ms: number;
    last_field_focused?: string;
    fields_filled: number;
    fields_total: number;
  }) => {
    track('form_abandoned', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// L) VIDEO PLAYER EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const video = {
  /** Video player loaded */
  playerLoaded: (props: {
    video_id?: string;
    video_type: 'input' | 'output' | 'preview' | 'comparison';
    page_path: string;
    autoplay: boolean;
  }) => {
    track('video_player_loaded', props);
  },

  /** Video play started */
  playStarted: (props: {
    video_id?: string;
    video_type: 'input' | 'output' | 'preview' | 'comparison';
    page_path: string;
    current_time_sec: number;
  }) => {
    track('video_play_started', props);
  },

  /** Video paused */
  paused: (props: {
    video_id?: string;
    video_type: string;
    page_path: string;
    current_time_sec: number;
    watch_duration_sec: number;
  }) => {
    track('video_paused', props);
  },

  /** Video seeked */
  seeked: (props: {
    video_id?: string;
    video_type: string;
    page_path: string;
    from_time_sec: number;
    to_time_sec: number;
  }) => {
    track('video_seeked', props);
  },

  /** Video ended (watched to completion) */
  ended: (props: {
    video_id?: string;
    video_type: string;
    page_path: string;
    total_watch_time_sec: number;
    video_duration_sec: number;
    completion_percent: number;
  }) => {
    track('video_ended', props);
  },

  /** Video fullscreen toggled */
  fullscreenToggled: (props: {
    video_id?: string;
    video_type: string;
    page_path: string;
    is_fullscreen: boolean;
  }) => {
    track('video_fullscreen_toggled', props);
  },

  /** Video mute toggled */
  muteToggled: (props: {
    video_id?: string;
    video_type: string;
    page_path: string;
    is_muted: boolean;
  }) => {
    track('video_mute_toggled', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// M) ENGAGEMENT & SESSION EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const engagement = {
  /** Scroll milestone reached */
  scrollMilestone: (props: {
    page_path: string;
    depth_percent: 25 | 50 | 75 | 90 | 100;
    time_to_reach_ms: number;
  }) => {
    track('scroll_milestone', props);
  },

  /** User idle detected (no activity for X seconds) */
  userIdle: (props: {
    page_path: string;
    idle_duration_sec: number;
    last_interaction_type?: string;
  }) => {
    track('user_idle', props);
  },

  /** User returned from idle */
  userReturned: (props: {
    page_path: string;
    idle_duration_sec: number;
    return_interaction_type: string;
  }) => {
    track('user_returned', props);
  },

  /** Rage click detected (multiple rapid clicks) */
  rageClick: (props: {
    page_path: string;
    element_selector?: string;
    click_count: number;
    time_window_ms: number;
  }) => {
    track('rage_click', props);
  },

  /** Element hovered for significant time */
  elementHovered: (props: {
    element_type: string;
    element_id?: string;
    hover_duration_ms: number;
    page_path: string;
  }) => {
    // Only track if hovered > 1 second (meaningful engagement)
    if (props.hover_duration_ms >= 1000) {
      track('element_hovered', props);
    }
  },

  /** Session heartbeat (periodic engagement check) */
  sessionHeartbeat: (props: {
    page_path: string;
    session_duration_sec: number;
    pages_viewed: number;
    interactions_count: number;
    is_active: boolean;
  }) => {
    track('session_heartbeat', props);
  },

  /** Tab visibility changed */
  tabVisibilityChanged: (props: {
    page_path: string;
    is_visible: boolean;
    hidden_duration_sec?: number;
  }) => {
    track('tab_visibility_changed', props);
  },

  /** Feature discovered (first time using a feature) */
  featureDiscovered: (props: {
    feature_name: string;
    discovery_method: 'click' | 'hover' | 'scroll' | 'search';
    page_path: string;
  }) => {
    track('feature_discovered', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// N) SETTINGS & PREFERENCES EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const settings = {
  /** Settings page viewed */
  settingsViewed: (props: { section?: string }) => {
    track('settings_viewed', props);
  },

  /** Setting changed */
  settingChanged: (props: {
    setting_name: string;
    setting_category: 'notifications' | 'privacy' | 'display' | 'account';
    old_value: string | boolean | number;
    new_value: string | boolean | number;
  }) => {
    track('setting_changed', props);
  },

  /** Notification preference changed */
  notificationPrefChanged: (props: {
    notification_type: string;
    enabled: boolean;
  }) => {
    track('notification_pref_changed', props);
  },

  /** Account action taken */
  accountAction: (props: {
    action: 'password_change' | 'email_change' | 'delete_request' | 'export_data';
    success: boolean;
  }) => {
    track('account_action', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// O) SEARCH & FILTER EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const search = {
  /** Search performed */
  searchPerformed: (props: {
    query: string;
    query_length: number;
    search_type: 'jobs' | 'history' | 'global';
    results_count: number;
    page_path: string;
  }) => {
    track('search_performed', props);
  },

  /** Search result clicked */
  searchResultClicked: (props: {
    query: string;
    result_position: number;
    result_type: string;
    page_path: string;
  }) => {
    track('search_result_clicked', props);
  },

  /** Filter applied */
  filterApplied: (props: {
    filter_name: string;
    filter_value: string;
    page_path: string;
    results_count_before: number;
    results_count_after: number;
  }) => {
    track('filter_applied', props);
  },

  /** Sort changed */
  sortChanged: (props: {
    sort_field: string;
    sort_direction: 'asc' | 'desc';
    page_path: string;
  }) => {
    track('sort_changed', props);
  },

  /** Pagination */
  paginationUsed: (props: {
    from_page: number;
    to_page: number;
    page_path: string;
    items_per_page: number;
  }) => {
    track('pagination_used', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// P) PLATFORM SELECTION EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const platform = {
  /** Platform selected for watermark removal */
  platformSelected: (props: {
    platform_id: string;
    platform_name: string;
    selection_method: 'click' | 'auto' | 'url_detect';
    previous_platform?: string;
  }) => {
    track('platform_selected', props);
  },

  /** Platform info viewed (hover or click for details) */
  platformInfoViewed: (props: {
    platform_id: string;
    view_duration_ms: number;
  }) => {
    track('platform_info_viewed', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// Q) HELP & SUPPORT EVENTS (ML Training Data)
// ═══════════════════════════════════════════════════════════════════

export const help = {
  /** Help content viewed */
  helpViewed: (props: {
    help_type: 'tooltip' | 'faq' | 'docs' | 'video';
    help_topic: string;
    page_path: string;
  }) => {
    track('help_viewed', props);
  },

  /** FAQ expanded */
  faqExpanded: (props: {
    question: string;
    category?: string;
    position: number;
  }) => {
    track('faq_expanded', props);
  },

  /** Support link clicked */
  supportClicked: (props: {
    support_type: 'email' | 'chat' | 'docs' | 'social';
    page_path: string;
    context?: string;
  }) => {
    track('support_clicked', props);
  },

  /** Feedback submitted */
  feedbackSubmitted: (props: {
    feedback_type: 'rating' | 'comment' | 'bug_report' | 'feature_request';
    rating?: number;
    page_path: string;
  }) => {
    track('feedback_submitted', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  initPostHog,
  identify,
  reset,
  getSessionId,
  generateRequestId,
  getAttributionFromUrl,
  persistAttribution,
  getPersistedAttribution,
  acquisition,
  auth,
  onboarding,
  billing,
  upload,
  job,
  error,
  system,
  promo,
  credits,
  retention,
  // New ML training events
  navigation,
  ui,
  form,
  video,
  engagement,
  settings,
  search,
  platform,
  help,
};

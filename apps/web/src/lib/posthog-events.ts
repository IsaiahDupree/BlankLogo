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
// A) AUTH EVENTS
// ═══════════════════════════════════════════════════════════════════

export const auth = {
  /** User viewed login page */
  loginViewed: (props: { referrer?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string }) => {
    track('auth_login_viewed', props);
  },

  /** Magic link requested */
  magicLinkRequested: (props: { email_domain: string; is_existing_user?: boolean }) => {
    track('auth_magic_link_requested', props);
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
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  initPostHog,
  identify,
  reset,
  getSessionId,
  generateRequestId,
  auth,
  onboarding,
  billing,
  upload,
  job,
  error,
  system,
  promo,
  credits,
};

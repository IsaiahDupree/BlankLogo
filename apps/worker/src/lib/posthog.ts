/**
 * PostHog Server-Side Analytics for Render Worker
 * 
 * Uses posthog-node for server-side event tracking
 * Mirrors event taxonomy from web app posthog-events.ts
 */

import { PostHog } from 'posthog-node';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export type Environment = 'development' | 'staging' | 'production';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type FailureStage = 'validate' | 'download' | 'modal' | 'upload' | 'db_update';

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

export interface CorrelationIds {
  user_id?: string;
  request_id?: string;
  job_id?: string;
  video_id?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const POSTHOG_KEY = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV;
  if (env === 'development') return 'development';
  if (process.env.RENDER_SERVICE_NAME?.includes('staging')) return 'staging';
  return 'production';
}

function getBaseProperties() {
  return {
    environment: getEnvironment(),
    platform: 'worker' as const,
    source: 'worker' as const,
    app_version: process.env.npm_package_version,
    git_sha: process.env.RENDER_GIT_COMMIT,
    worker_id: process.env.RENDER_INSTANCE_ID,
  };
}

// ═══════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

export function initPostHog(): PostHog | null {
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] No API key provided - analytics disabled');
    return null;
  }

  if (client) return client;

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10000,
  });

  console.log('[PostHog] Worker analytics initialized');
  return client;
}

export function shutdownPostHog(): Promise<void> {
  if (client) {
    return client.shutdown();
  }
  return Promise.resolve();
}

// Core capture function
function capture(
  distinctId: string,
  eventName: string,
  properties: Record<string, unknown> = {}
): void {
  if (!client) {
    initPostHog();
  }
  if (!client) return;

  client.capture({
    distinctId,
    event: eventName,
    properties: {
      ...getBaseProperties(),
      ...properties,
      timestamp: new Date().toISOString(),
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// JOB LIFECYCLE EVENTS (Worker-side)
// ═══════════════════════════════════════════════════════════════════

export const job = {
  /** Job dequeued by worker */
  dequeued: (props: CorrelationIds & { attempt: number }) => {
    capture(props.user_id || 'system', 'job_dequeued', props);
  },

  /** Job dispatched to Modal */
  dispatched: (props: CorrelationIds & { provider: 'modal'; gpu_type?: string }) => {
    capture(props.user_id || 'system', 'job_dispatched', props);
  },

  /** Job dispatch failed */
  dispatchFailed: (props: CorrelationIds & { 
    http_status?: number; 
    attempt: number; 
    error_code: ErrorCode;
    error_message?: string;
  }) => {
    capture(props.user_id || 'system', 'job_dispatch_failed', props);
  },

  /** Job started processing (Modal callback) */
  started: (props: CorrelationIds & { cold_start_ms?: number; gpu_type?: string }) => {
    capture(props.user_id || 'system', 'job_started', { ...props, status: 'running' });
  },

  /** Job stage started */
  stageStarted: (props: CorrelationIds & { stage: string }) => {
    capture(props.user_id || 'system', 'job_stage_started', props);
  },

  /** Job stage completed */
  stageCompleted: (props: CorrelationIds & { stage: string; duration_ms: number }) => {
    capture(props.user_id || 'system', 'job_stage_completed', props);
  },

  /** Job progress update */
  progress: (props: CorrelationIds & { percent: number; stage?: string }) => {
    // Sample progress: only send at 0, 25, 50, 75, 100
    if ([0, 25, 50, 75, 100].includes(props.percent)) {
      capture(props.user_id || 'system', 'job_progress', props);
    }
  },

  /** Output upload started */
  outputUploadStarted: (props: CorrelationIds & { output_mb?: number }) => {
    capture(props.user_id || 'system', 'job_output_upload_started', props);
  },

  /** Output upload completed */
  outputUploadCompleted: (props: CorrelationIds & { upload_ms: number; output_mb?: number }) => {
    capture(props.user_id || 'system', 'job_output_upload_completed', props);
  },

  /** Job completed successfully */
  completed: (props: CorrelationIds & {
    total_duration_ms: number;
    queue_wait_ms?: number;
    download_ms?: number;
    process_ms?: number;
    upload_ms?: number;
    output_mb?: number;
    watermarks_detected?: number;
    platform: string;
  }) => {
    capture(props.user_id || 'system', 'job_completed', { ...props, status: 'completed' });
  },

  /** Job failed */
  failed: (props: CorrelationIds & {
    failure_stage: FailureStage;
    error_code: ErrorCode;
    error_message?: string;
    http_status?: number;
    attempt?: number;
    platform: string;
  }) => {
    capture(props.user_id || 'system', 'job_failed', { ...props, status: 'failed' });
  },

  /** Retry scheduled */
  retryScheduled: (props: CorrelationIds & { 
    attempt: number; 
    backoff_ms: number; 
    reason: string 
  }) => {
    capture(props.user_id || 'system', 'job_retry_scheduled', props);
  },

  /** Dead lettered (max retries exceeded) */
  deadLettered: (props: CorrelationIds & { 
    attempts: number; 
    final_error_code: ErrorCode 
  }) => {
    capture(props.user_id || 'system', 'job_dead_lettered', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// ERROR EVENTS
// ═══════════════════════════════════════════════════════════════════

export const error = {
  /** Worker error */
  worker: (props: CorrelationIds & {
    failure_stage: FailureStage;
    attempt: number;
    error_code: ErrorCode;
    message?: string;
  }) => {
    capture(props.user_id || 'system', 'error_worker', props);
  },

  /** Modal error */
  modal: (props: CorrelationIds & {
    stage: string;
    error_code: ErrorCode;
    gpu_type?: string;
    cold_start_ms?: number;
    message?: string;
  }) => {
    capture(props.user_id || 'system', 'error_modal', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// SYSTEM EVENTS
// ═══════════════════════════════════════════════════════════════════

export const system = {
  /** Health check */
  healthCheck: (props: {
    service: 'vercel_api' | 'supabase_db' | 'supabase_storage' | 'redis' | 'modal_health';
    status: 'ok' | 'degraded' | 'down';
    latency_ms?: number;
  }) => {
    capture('system', 'system_health_check', props);
  },

  /** Queue depth sampled (periodic) */
  queueDepthSampled: (props: { 
    queue_depth: number; 
    active_jobs: number; 
    delayed_jobs: number 
  }) => {
    capture('system', 'system_queue_depth_sampled', props);
  },

  /** Provider capacity warning */
  capacityWarning: (props: { 
    provider: string; 
    gpu_type?: string; 
    reason: 'no_capacity' | 'rate_limited' 
  }) => {
    capture('system', 'system_capacity_warning', props);
  },

  /** Worker started */
  workerStarted: (props: { worker_id?: string }) => {
    capture('system', 'system_worker_started', props);
  },

  /** Worker shutdown */
  workerShutdown: (props: { worker_id?: string; reason?: string }) => {
    capture('system', 'system_worker_shutdown', props);
  },
};

// ═══════════════════════════════════════════════════════════════════
// HELPER: Map raw errors to normalized error codes
// ═══════════════════════════════════════════════════════════════════

export function normalizeErrorCode(error: unknown): ErrorCode {
  if (!error) return 'E_UNKNOWN';
  
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Modal errors
  if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) return 'E_MODAL_429';
  if (lowerMessage.includes('timeout')) return 'E_MODAL_TIMEOUT';
  if (lowerMessage.includes('500') || lowerMessage.includes('internal server')) return 'E_MODAL_500';
  if (lowerMessage.includes('cold start')) return 'E_MODAL_COLD_START';

  // Storage errors
  if (lowerMessage.includes('download')) return 'E_STORAGE_DOWNLOAD';
  if (lowerMessage.includes('upload')) return 'E_STORAGE_UPLOAD';

  // Auth errors
  if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized')) return 'E_AUTH_FAILED';
  if (lowerMessage.includes('expired')) return 'E_AUTH_EXPIRED';

  // Input errors
  if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) return 'E_INPUT_INVALID';

  // Database errors
  if (lowerMessage.includes('database') || lowerMessage.includes('db')) return 'E_DB_UPDATE';

  // Credits
  if (lowerMessage.includes('credit') || lowerMessage.includes('insufficient')) return 'E_INSUFFICIENT_CREDITS';

  return 'E_UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  initPostHog,
  shutdownPostHog,
  job,
  error,
  system,
  normalizeErrorCode,
};

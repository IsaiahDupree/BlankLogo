/**
 * Observability & Control Plane Types
 * Full fidelity job system with state machine, event log, and service registry
 */

// ============================================================================
// JOB STATUS STATE MACHINE
// ============================================================================

export const JOB_STATUSES = [
  'queued',           // Accepted, waiting for worker
  'claimed',          // Worker locked it
  'running',          // Actively processing
  'uploading',        // Uploading output to storage
  'finalizing',       // Final verification/cleanup
  'succeeded',        // Complete with verified output
  'failed_retryable', // Failed but can retry
  'failed_terminal',  // Failed permanently
  'canceled',         // User or system canceled
  'timed_out',        // No progress within timeout
] as const;

export type JobStatus = typeof JOB_STATUSES[number];

// Allowed status transitions
export const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ['claimed', 'canceled', 'timed_out'],
  claimed: ['running', 'queued', 'failed_retryable', 'timed_out'],
  running: ['uploading', 'failed_retryable', 'failed_terminal', 'timed_out'],
  uploading: ['finalizing', 'failed_retryable', 'failed_terminal'],
  finalizing: ['succeeded', 'failed_retryable', 'failed_terminal'],
  failed_retryable: ['queued', 'failed_terminal', 'canceled'],
  succeeded: [],
  failed_terminal: [],
  canceled: [],
  timed_out: [],
};

export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: JobStatus): boolean {
  return ['succeeded', 'failed_terminal', 'canceled', 'timed_out'].includes(status);
}

export function isFailedStatus(status: JobStatus): boolean {
  return status.startsWith('failed_') || status === 'timed_out';
}

// ============================================================================
// ERROR TAXONOMY
// ============================================================================

export const ERROR_STAGES = [
  'validation',
  'queue',
  'claim',
  'download',
  'openai',
  'render',
  'upload',
  'webhook',
  'notification',
  'entitlement',
  'unknown',
] as const;

export type ErrorStage = typeof ERROR_STAGES[number];

export const ERROR_CODES = {
  // OpenAI errors
  OPENAI_TIMEOUT: { category: 'openai', severity: 'high', retryable: true },
  OPENAI_RATE_LIMIT: { category: 'openai', severity: 'medium', retryable: true },
  OPENAI_INVALID_RESPONSE: { category: 'openai', severity: 'high', retryable: true },
  OPENAI_MODEL_UNAVAILABLE: { category: 'openai', severity: 'critical', retryable: false },
  
  // Stripe errors
  STRIPE_WEBHOOK_SIGNATURE_INVALID: { category: 'stripe', severity: 'critical', retryable: false },
  STRIPE_EVENT_OUT_OF_ORDER: { category: 'stripe', severity: 'medium', retryable: true },
  STRIPE_CUSTOMER_NOT_FOUND: { category: 'stripe', severity: 'high', retryable: false },
  
  // Storage errors
  STORAGE_UPLOAD_FAILED: { category: 'storage', severity: 'high', retryable: true },
  STORAGE_DOWNLOAD_FAILED: { category: 'storage', severity: 'high', retryable: true },
  STORAGE_SIGNED_URL_EXPIRED: { category: 'storage', severity: 'low', retryable: true },
  
  // Worker errors
  WORKER_OOM: { category: 'worker', severity: 'critical', retryable: true },
  WORKER_CRASH: { category: 'worker', severity: 'critical', retryable: true },
  JOB_LOCK_LOST: { category: 'worker', severity: 'high', retryable: true },
  JOB_TIMEOUT: { category: 'worker', severity: 'high', retryable: true },
  
  // Validation errors
  INVALID_VIDEO_URL: { category: 'validation', severity: 'low', retryable: false },
  UNSUPPORTED_FORMAT: { category: 'validation', severity: 'low', retryable: false },
  VIDEO_TOO_LONG: { category: 'validation', severity: 'low', retryable: false },
  VIDEO_TOO_LARGE: { category: 'validation', severity: 'low', retryable: false },
  
  // Entitlement errors
  INSUFFICIENT_CREDITS: { category: 'entitlement', severity: 'low', retryable: false },
  SUBSCRIPTION_EXPIRED: { category: 'entitlement', severity: 'low', retryable: false },
  
  // Notification errors
  EMAIL_SEND_FAILED: { category: 'notification', severity: 'medium', retryable: true },
  WEBHOOK_DELIVERY_FAILED: { category: 'notification', severity: 'medium', retryable: true },
  
  // System errors
  DATABASE_ERROR: { category: 'system', severity: 'critical', retryable: true },
  REDIS_ERROR: { category: 'system', severity: 'critical', retryable: true },
  INTERNAL_ERROR: { category: 'system', severity: 'critical', retryable: true },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface JobError {
  code: ErrorCode;
  message: string;
  stage: ErrorStage;
  detail?: Record<string, unknown>;
  retryable: boolean;
  recommendedAction?: string;
}

export function createJobError(
  code: ErrorCode,
  message: string,
  stage: ErrorStage,
  detail?: Record<string, unknown>
): JobError {
  const errorDef = ERROR_CODES[code];
  return {
    code,
    message,
    stage,
    detail,
    retryable: errorDef.retryable,
  };
}

// ============================================================================
// JOB EVENT LOG
// ============================================================================

export const EVENT_TYPES = [
  // Lifecycle events
  'job_created',
  'job_claimed',
  'job_started',
  'job_completed',
  'job_failed',
  'job_retried',
  'job_canceled',
  
  // Progress events
  'progress_updated',
  'status_transition',
  
  // Processing events
  'download_started',
  'download_completed',
  'openai_requested',
  'openai_completed',
  'openai_failed',
  'render_started',
  'render_completed',
  'render_failed',
  'storage_upload_started',
  'storage_upload_completed',
  'storage_upload_failed',
  
  // Notification events
  'user_notified',
  'webhook_sent',
  'alert_triggered',
  
  // System events
  'worker_heartbeat',
  'worker_registered',
  'invalid_transition_attempt',
] as const;

export type EventType = typeof EVENT_TYPES[number];

export interface JobEvent {
  id?: string;
  job_id: string;
  trace_id: string;
  event_type: EventType;
  event_ts?: Date;
  service: string;
  service_version?: string;
  environment?: string;
  payload?: Record<string, unknown>;
  previous_status?: JobStatus;
  new_status?: JobStatus;
  error_code?: ErrorCode;
  error_message?: string;
  error_stage?: ErrorStage;
  error_retryable?: boolean;
  duration_ms?: number;
}

// ============================================================================
// SERVICE CAPABILITIES REGISTRY
// ============================================================================

export interface ServiceCapabilities {
  supported_media_types?: string[];
  max_duration_seconds?: number;
  max_resolution?: string;
  max_file_size_mb?: number;
  supported_platforms?: string[];
  feature_flags?: Record<string, boolean>;
  concurrency?: {
    max_jobs: number;
    current_jobs?: number;
  };
  queue_names?: string[];
  models?: string[];
}

export interface ServiceRegistration {
  service_name: string;
  instance_id: string;
  environment: string;
  version: string;
  build_time?: Date;
  status?: 'healthy' | 'degraded' | 'unhealthy';
  capabilities: ServiceCapabilities;
  host?: string;
  region?: string;
}

// ============================================================================
// PROGRESS MODEL
// ============================================================================

export const PROGRESS_STAGES = {
  queued: { min: 0, max: 10, label: 'Queued' },
  claimed: { min: 10, max: 15, label: 'Starting' },
  downloading: { min: 15, max: 25, label: 'Downloading video' },
  analyzing: { min: 25, max: 35, label: 'Analyzing watermark' },
  processing: { min: 35, max: 80, label: 'Removing watermark' },
  uploading: { min: 80, max: 95, label: 'Uploading result' },
  finalizing: { min: 95, max: 100, label: 'Finalizing' },
} as const;

export type ProgressStage = keyof typeof PROGRESS_STAGES;

export interface JobProgress {
  stage: ProgressStage;
  percent: number;
  label: string;
  last_update: Date;
  eta_seconds?: number;
  last_error?: string;
}

export function calculateProgress(stage: ProgressStage, stageProgress: number = 0): number {
  const stageDef = PROGRESS_STAGES[stage];
  const range = stageDef.max - stageDef.min;
  return Math.min(100, Math.max(0, stageDef.min + (range * stageProgress / 100)));
}

// ============================================================================
// ALERTS
// ============================================================================

export type AlertSeverity = 'p0' | 'p1' | 'p2';

export const ALERT_TYPES = {
  // P0 - Page immediately
  JOB_BACKLOG_GROWING: { severity: 'p0' as AlertSeverity, description: 'Job backlog growing with healthy workers' },
  TERMINAL_FAILURE_SPIKE: { severity: 'p0' as AlertSeverity, description: 'Spike in terminal failure rate' },
  WEBHOOK_FAILURE_RATE: { severity: 'p0' as AlertSeverity, description: 'Stripe webhook failure rate above threshold' },
  STORAGE_FAILURES: { severity: 'p0' as AlertSeverity, description: 'Storage upload/download failures' },
  NO_WORKER_HEARTBEATS: { severity: 'p0' as AlertSeverity, description: 'No heartbeats from worker pool' },
  
  // P1 - High priority
  OPENAI_LATENCY_SPIKE: { severity: 'p1' as AlertSeverity, description: 'OpenAI latency spike' },
  EMAIL_SEND_FAILURES: { severity: 'p1' as AlertSeverity, description: 'Email send failures above threshold' },
  JOB_DURATION_SLA: { severity: 'p1' as AlertSeverity, description: 'Job duration above SLA' },
  
  // P2 - Ticket
  ELEVATED_RETRY_RATE: { severity: 'p2' as AlertSeverity, description: 'Elevated retry rate' },
  CAPABILITY_DEGRADED: { severity: 'p2' as AlertSeverity, description: 'Non-critical capability down' },
} as const;

export type AlertType = keyof typeof ALERT_TYPES;

export interface SystemAlert {
  id?: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  affected_jobs?: string[];
  error_code?: ErrorCode;
  status: 'active' | 'acknowledged' | 'resolved';
  metadata?: Record<string, unknown>;
  created_at?: Date;
}

// ============================================================================
// TRACE ID GENERATION
// ============================================================================

export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `trace-${timestamp}-${random}`;
}

export function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 14);
  return `job_${random}${timestamp.slice(-4)}`;
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

export interface StructuredLog {
  trace_id: string;
  job_id?: string;
  user_id?: string;
  service: string;
  environment: string;
  version?: string;
  stage?: string;
  event_type: string;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  duration_ms?: number;
  timestamp: string;
}

export function createStructuredLog(
  params: Omit<StructuredLog, 'timestamp'>
): StructuredLog {
  return {
    ...params,
    timestamp: new Date().toISOString(),
  };
}

export function logStructured(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}

// ============================================================================
// OUTPUT MANIFEST
// ============================================================================

export interface OutputManifest {
  version: '1.0';
  job_id: string;
  created_at: string;
  
  input: {
    url: string;
    filename?: string;
    size_bytes?: number;
    duration_seconds?: number;
    format?: string;
  };
  
  output: {
    storage_path: string;
    signed_url?: string;
    signed_url_expires_at?: string;
    filename: string;
    size_bytes: number;
    duration_seconds?: number;
    format: string;
    checksum?: string;
  };
  
  processing: {
    platform: string;
    crop_pixels: number;
    worker_version: string;
    duration_ms: number;
  };
  
  verified: boolean;
  verified_at?: string;
}

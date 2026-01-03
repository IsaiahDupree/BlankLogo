/**
 * BlankLogo Job Types & State Machine
 * Comprehensive job pipeline for watermark removal
 */

// Job States (State Machine)
export type JobState =
  | "created"           // Initial state after job creation
  | "validating"        // Validating input file/URL
  | "queued"            // Waiting in processing queue
  | "processing"        // Active watermark removal
  | "preview_ready"     // Low-res preview available (free tier)
  | "awaiting_payment"  // Waiting for credit/payment
  | "processing_final"  // High-res final render
  | "completed"         // Successfully finished
  | "failed_retryable"  // Failed but can retry
  | "failed_permanent"  // Failed, cannot retry
  | "cancelled"         // User cancelled
  | "expired";          // Job expired (cleanup)

// Valid state transitions
export const JOB_STATE_TRANSITIONS: Record<JobState, JobState[]> = {
  created: ["validating", "cancelled"],
  validating: ["queued", "failed_retryable", "failed_permanent", "cancelled"],
  queued: ["processing", "cancelled"],
  processing: ["preview_ready", "completed", "failed_retryable", "failed_permanent", "cancelled"],
  preview_ready: ["awaiting_payment", "processing_final", "cancelled", "expired"],
  awaiting_payment: ["processing_final", "cancelled", "expired"],
  processing_final: ["completed", "failed_retryable", "failed_permanent"],
  completed: ["expired"],
  failed_retryable: ["queued", "cancelled"],
  failed_permanent: [],
  cancelled: [],
  expired: [],
};

// Job Types
export type JobType =
  | "watermark_removal"
  | "background_removal"
  | "object_removal"
  | "upscale"
  | "batch_convert"
  | "video_watermark"
  | "noise_removal"
  | "text_removal";

// Processing Modes
export type ProcessingMode =
  | "crop"      // Fast: trim edges
  | "inpaint"   // AI: fill watermark area
  | "auto"      // Auto-detect best method
  | "mask";     // User-defined mask

// Platform Presets (watermark positions)
export type Platform =
  | "sora"
  | "tiktok"
  | "runway"
  | "pika"
  | "kling"
  | "luma"
  | "midjourney"
  | "instagram"
  | "facebook"
  | "meta"
  | "custom";

// Watermark Position
export interface WatermarkPosition {
  location: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "custom";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// Job Input Types
export interface JobInput {
  type: "file" | "url" | "storage";
  source: string;          // URL, file path, or storage key
  filename: string;
  mimeType: string;
  size: number;            // bytes
  checksum?: string;       // MD5/SHA256 for dedup
}

// Job Output Types
export interface JobOutput {
  type: "storage" | "url";
  path: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  expiresAt?: string;
}

// Job Options
export interface JobOptions {
  platform?: Platform;
  mode: ProcessingMode;
  watermarkPosition?: WatermarkPosition;
  cropPixels?: number;
  preserveAudio?: boolean;     // for video
  outputFormat?: string;
  outputQuality?: number;      // 1-100
  generatePreview?: boolean;
  previewOnly?: boolean;       // free tier
}

// Main Job Interface
export interface Job {
  id: string;
  userId: string;
  type: JobType;
  state: JobState;
  
  // Input/Output
  input: JobInput;
  output?: JobOutput;
  previewOutput?: JobOutput;
  
  // Processing
  options: JobOptions;
  progress: number;          // 0-100
  
  // Rights confirmation
  rightsConfirmed: boolean;
  rightsConfirmedAt?: string;
  
  // Timing
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  
  // Credits
  creditsRequired: number;
  creditsCharged: number;
  
  // Error handling
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

// Batch Job
export interface BatchJob {
  id: string;
  userId: string;
  name: string;
  
  // Batch settings
  totalItems: number;
  processedItems: number;
  failedItems: number;
  
  // Common options for all items
  options: JobOptions;
  
  // State
  state: "created" | "processing" | "completed" | "partial_failure" | "failed" | "cancelled";
  
  // Items
  jobIds: string[];
  
  // Timing
  createdAt: string;
  completedAt?: string;
  
  // Credits
  creditsRequired: number;
  creditsCharged: number;
}

// Job Event (audit trail)
export interface JobEvent {
  id: string;
  jobId: string;
  type: "state_change" | "progress" | "error" | "retry" | "payment" | "output_ready";
  fromState?: JobState;
  toState?: JobState;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Credits Ledger Entry
export interface CreditLedgerEntry {
  id: string;
  userId: string;
  type: "purchase" | "subscription" | "job_charge" | "refund" | "bonus" | "adjustment";
  amount: number;          // positive = credit, negative = debit
  balance: number;         // balance after this entry
  jobId?: string;
  description: string;
  createdAt: string;
}

// API Request/Response Types
export interface CreateJobRequest {
  type: JobType;
  input: {
    type: "file" | "url";
    source: string;
    filename?: string;
  };
  options: Partial<JobOptions>;
  rightsConfirmed: boolean;
}

export interface CreateJobResponse {
  job: Job;
  uploadUrl?: string;      // For file uploads
}

export interface JobStatusResponse {
  job: Job;
  events: JobEvent[];
}

export interface BatchCreateRequest {
  name: string;
  items: Array<{
    source: string;
    filename?: string;
  }>;
  options: Partial<JobOptions>;
  rightsConfirmed: boolean;
}

export interface BatchStatusResponse {
  batch: BatchJob;
  jobs: Job[];
  summary: {
    completed: number;
    processing: number;
    failed: number;
    pending: number;
  };
}

// Webhook Events
export type WebhookEventType =
  | "job.created"
  | "job.processing"
  | "job.preview_ready"
  | "job.completed"
  | "job.failed"
  | "batch.completed"
  | "credits.low";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: {
    jobId?: string;
    batchId?: string;
    userId: string;
    state?: JobState;
    outputUrl?: string;
    error?: string;
  };
}

// Platform Presets Configuration
export const PLATFORM_PRESETS: Record<Platform, { cropPixels: number; position: WatermarkPosition }> = {
  sora: { cropPixels: 100, position: { location: "bottom-right" } },
  tiktok: { cropPixels: 80, position: { location: "bottom-right" } },
  runway: { cropPixels: 60, position: { location: "bottom-left" } },
  pika: { cropPixels: 50, position: { location: "bottom-right" } },
  kling: { cropPixels: 70, position: { location: "bottom-right" } },
  luma: { cropPixels: 55, position: { location: "bottom-left" } },
  midjourney: { cropPixels: 0, position: { location: "bottom-left" } },
  instagram: { cropPixels: 0, position: { location: "bottom-right" } },  // Meta/Instagram Reels
  facebook: { cropPixels: 0, position: { location: "bottom-right" } },   // Meta/Facebook Videos
  meta: { cropPixels: 0, position: { location: "bottom-right" } },       // Generic Meta watermarks
  custom: { cropPixels: 0, position: { location: "custom" } },
};

// Job state validation helper
export function canTransitionTo(currentState: JobState, newState: JobState): boolean {
  return JOB_STATE_TRANSITIONS[currentState]?.includes(newState) ?? false;
}

// Calculate credits for job
export function calculateCredits(job: Partial<Job>): number {
  const baseCredits = 1;
  
  // Video costs more
  if (job.type === "video_watermark") {
    return baseCredits * 3;
  }
  
  // Inpaint costs more than crop
  if (job.options?.mode === "inpaint") {
    return baseCredits * 2;
  }
  
  return baseCredits;
}

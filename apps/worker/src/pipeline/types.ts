import type { JobStatus, JobErrorCode } from "@blanklogo/shared";

// ============================================
// WORKER PIPELINE TYPES
// ============================================

// Job row from database
export interface JobRow {
  id: string;
  project_id: string;
  user_id: string;
  status: JobStatus;
  progress: number;
  error_code: string | null;
  error_message: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  cost_credits_reserved: number;
  cost_credits_final: number;
  created_at: string;
  updated_at: string;
}

// Project row from database
export interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  niche_preset: string;
  target_minutes: number;
  status: string;
  template_id: string;
  visual_preset_id: string;
  voice_profile_id: string | null;
  image_density: string;
  target_resolution: string;
  timeline_path: string | null;
  created_at: string;
  updated_at: string;
}

// Project input from database
export interface ProjectInput {
  id: string;
  project_id: string;
  type: "text" | "file" | "url";
  title: string | null;
  content_text: string | null;
  storage_path: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// ============================================
// PIPELINE CONTEXT (shared across all steps)
// ============================================

export interface PipelineContext {
  job: JobRow;
  project: ProjectRow;
  userId: string;
  projectId: string;
  jobId: string;
  
  // Storage paths
  basePath: string;  // project-assets/u_{userId}/p_{projectId}/j_{jobId}/
  outputPath: string; // project-outputs/u_{userId}/p_{projectId}/j_{jobId}/
  
  // Artifacts accumulated during pipeline
  artifacts: PipelineArtifacts;
}

export interface PipelineArtifacts {
  // Inputs
  mergedInputText?: string;
  
  // Script
  outline?: ScriptOutline;
  script?: Script;
  
  // Audio
  sectionAudioPaths?: string[];
  narrationPath?: string;
  narrationDurationMs?: number;
  
  // Alignment
  whisperWords?: WhisperWord[];
  whisperSegments?: WhisperSegment[];
  captionsSrtPath?: string;
  
  // Visuals
  visualPlan?: VisualPlan;
  imagePaths?: string[];
  
  // Timeline (uses local type matching TimelineContractV1)
  timeline?: Record<string, unknown>;
  timelinePath?: string;
  
  // Output
  videoPath?: string;
  zipPath?: string;
}

// ============================================
// SCRIPT TYPES
// ============================================

export interface ScriptOutline {
  title: string;
  hook: string;
  sections: {
    id: string;
    headline: string;
    keyPoints: string[];
    estimatedDurationMs: number;
  }[];
  totalEstimatedDurationMs: number;
}

export interface ScriptSection {
  id: string;
  order: number;
  headline: string;
  narrationText: string;
  visualKeywords: string[];
  onScreenText?: string;
  paceHint: "slow" | "normal" | "fast";
  estimatedDurationMs: number;
}

export interface Script {
  title: string;
  sections: ScriptSection[];
  totalWordCount: number;
  estimatedDurationMs: number;
  generatedAt: string;
}

// ============================================
// WHISPER / ALIGNMENT TYPES
// ============================================

export interface WhisperWord {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

export interface WhisperSegment {
  id: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

// ============================================
// VISUAL PLAN TYPES
// ============================================

export interface VisualSlot {
  id: string;
  startMs: number;
  endMs: number;
  text: string;           // what's being said
  prompt: string;         // image generation prompt
  stylePreset: string;    // visual preset id
  seed?: number;          // for reproducibility
}

export interface VisualPlan {
  slots: VisualSlot[];
  totalImages: number;
  cadenceMs: number;      // average time per image
}

// ============================================
// STEP RESULT TYPES
// ============================================

export interface StepResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: JobErrorCode;
    message: string;
    details?: unknown;
  };
}

// ============================================
// STEP INTERFACE
// ============================================

export interface PipelineStep<TInput = void, TOutput = void> {
  name: string;
  status: JobStatus;
  
  execute(
    ctx: PipelineContext,
    input: TInput
  ): Promise<StepResult<TOutput>>;
  
  // Optional retry config
  maxRetries?: number;
  retryDelayMs?: number;
}

// ============================================
// STEP IMPLEMENTATIONS INTERFACE
// ============================================

export interface StepFunctions {
  ingestInputs: (ctx: PipelineContext) => Promise<StepResult<{ mergedText: string }>>;
  generateScript: (ctx: PipelineContext) => Promise<StepResult<{ script: Script }>>;
  generateVoice: (ctx: PipelineContext) => Promise<StepResult<{ narrationPath: string; durationMs: number }>>;
  runAlignment: (ctx: PipelineContext) => Promise<StepResult<{ segments: WhisperSegment[]; srtPath: string }>>;
  planVisuals: (ctx: PipelineContext) => Promise<StepResult<{ plan: VisualPlan }>>;
  generateImages: (ctx: PipelineContext) => Promise<StepResult<{ imagePaths: string[] }>>;
  buildTimeline: (ctx: PipelineContext) => Promise<StepResult<{ timeline: Record<string, unknown> }>>;
  renderVideo: (ctx: PipelineContext) => Promise<StepResult<{ videoPath: string }>>;
  packageAssets: (ctx: PipelineContext) => Promise<StepResult<{ zipPath: string }>>;
}

// ============================================
// JOB EVENT LOGGING
// ============================================

export interface JobEventPayload {
  job_id: string;
  stage: JobStatus;
  message: string;
  meta?: Record<string, unknown>;
}

// ============================================
// HELPERS
// ============================================

export function createBasePath(userId: string, projectId: string, jobId: string): string {
  return `project-assets/u_${userId}/p_${projectId}/j_${jobId}`;
}

export function createOutputPath(userId: string, projectId: string, jobId: string): string {
  return `project-outputs/u_${userId}/p_${projectId}/j_${jobId}`;
}

export function createStepResult<T>(data: T): StepResult<T> {
  return { success: true, data };
}

export function createStepError(code: JobErrorCode, message: string, details?: unknown): StepResult<never> {
  return { success: false, error: { code, message, details } };
}

// Database types (matches Supabase schema)

export type ProjectStatus = "draft" | "generating" | "ready" | "failed";

export type JobStatus =
  | "QUEUED"
  | "CLAIMED"
  | "SCRIPTING"
  | "VOICE_GEN"
  | "ALIGNMENT"
  | "VISUAL_PLAN"
  | "IMAGE_GEN"
  | "TIMELINE_BUILD"
  | "RENDERING"
  | "PACKAGING"
  | "READY"
  | "FAILED"
  | "CANCELED";

// Job error codes for debugging
export type JobErrorCode =
  | "ERR_INPUT_FETCH"
  | "ERR_SCRIPT_GEN"
  | "ERR_TTS"
  | "ERR_WHISPER"
  | "ERR_VISUAL_PLAN"
  | "ERR_IMAGE_GEN"
  | "ERR_TIMELINE"
  | "ERR_RENDER"
  | "ERR_PACKAGING"
  | "ERR_CREDITS"
  | "ERR_UNKNOWN";

export type AssetType =
  | "script"
  | "audio"
  | "image"
  | "captions"
  | "video"
  | "zip"
  | "timeline"
  | "outline"
  | "other";

export type LedgerType =
  | "purchase"
  | "reserve"
  | "release"
  | "spend"
  | "refund"
  | "admin_adjust";

export interface Project {
  id: string;
  user_id: string;
  title: string;
  niche_preset: string;
  target_minutes: number;
  status: ProjectStatus;
  timeline_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Job {
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

export interface Asset {
  id: string;
  project_id: string;
  user_id: string;
  job_id: string | null;
  type: AssetType;
  path: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  type: LedgerType;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface UserNotificationPrefs {
  user_id: string;
  email_job_started: boolean;
  email_job_completed: boolean;
  email_job_failed: boolean;
  email_credits_low: boolean;
  email_account_status: boolean;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  marketing_opt_in_source: string | null;
  marketing_unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfile {
  id: string;
  user_id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  model_ref: string | null;
  endpoint_ref: string | null;
  samples_path: string | null;
  created_at: string;
  updated_at: string;
}

// Niche presets
export const NICHE_PRESETS = [
  { id: "explainer", name: "Explainer", description: "Educational content that breaks down complex topics" },
  { id: "motivation", name: "Motivation", description: "Inspirational content to uplift and encourage" },
  { id: "facts", name: "Facts & Trivia", description: "Interesting facts and surprising information" },
  { id: "history", name: "History", description: "Historical events, figures, and stories" },
  { id: "science", name: "Science", description: "Scientific concepts and discoveries" },
  { id: "finance", name: "Finance", description: "Money, investing, and financial literacy" },
  { id: "tech", name: "Technology", description: "Tech news, tutorials, and explanations" },
  { id: "storytelling", name: "Storytelling", description: "Narrative-driven content and stories" },
  { id: "true_crime", name: "True Crime", description: "Crime stories and investigations" },
  { id: "documentary", name: "Documentary", description: "In-depth documentary-style content" },
] as const;

export type NichePresetId = (typeof NICHE_PRESETS)[number]["id"];

// Default voices
export const DEFAULT_VOICES = [
  { id: "voice_male_1", name: "James", gender: "male", description: "Professional male narrator" },
  { id: "voice_female_1", name: "Sarah", gender: "female", description: "Warm female narrator" },
  { id: "voice_male_2", name: "Marcus", gender: "male", description: "Deep, authoritative voice" },
  { id: "voice_female_2", name: "Emma", gender: "female", description: "Energetic and engaging" },
] as const;

export type DefaultVoiceId = (typeof DEFAULT_VOICES)[number]["id"];

// Pricing & Credits
export const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    credits: 60,
    description: "Perfect for weekly creators",
    features: [
      "60 minutes of video generation",
      "All niche templates",
      "1080p MP4 output",
      "Captions (SRT)",
      "Script + asset pack",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    credits: 200,
    description: "For consistent content creators",
    popular: true,
    features: [
      "200 minutes of video generation",
      "All niche templates",
      "1080p MP4 output",
      "Captions (SRT)",
      "Script + asset pack",
      "Voice cloning (bring your voice)",
      "Priority rendering queue",
    ],
  },
  {
    id: "creator_plus",
    name: "Creator+",
    price: 99,
    credits: 500,
    description: "For daily posters and agencies",
    features: [
      "500 minutes of video generation",
      "All niche templates",
      "1080p MP4 output",
      "Captions (SRT)",
      "Script + asset pack",
      "Voice cloning (bring your voice)",
      "Priority rendering queue",
      "Custom voice profiles (5)",
      "Bulk project creation",
    ],
  },
] as const;

export const CREDIT_PACKS = [
  { id: "pack_25", credits: 25, price: 10, perCredit: 0.40 },
  { id: "pack_80", credits: 80, price: 25, perCredit: 0.31 },
  { id: "pack_250", credits: 250, price: 60, perCredit: 0.24 },
  { id: "pack_500", credits: 500, price: 99, perCredit: 0.20 },
] as const;

export const QUALITY_MODIFIERS = {
  image_quality: {
    low: 0,        // default, no extra cost
    medium: 0.3,   // +0.3 credits/min
    high: 1.2,     // +1.2 credits/min
  },
  resolution: {
    "1080p": 0,    // default
    "4k": 0.1,     // +10% credits
  },
  image_density: {
    normal: 0,     // 1 image per 8-10 sec
    high: 0.2,     // faster cuts
    ultra: 0.4,    // very fast cuts
  },
} as const;

export type PricingTierId = (typeof PRICING_TIERS)[number]["id"];
export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export type ImageQuality = keyof typeof QUALITY_MODIFIERS.image_quality;
export type Resolution = keyof typeof QUALITY_MODIFIERS.resolution;

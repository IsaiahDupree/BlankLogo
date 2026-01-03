import { z } from "zod";

// ============================================
// AUDIO TRACK
// ============================================
export const AudioTrackSchema = z.object({
  src: z.string(),
  startFrame: z.number().int().min(0).default(0),
  durationFrames: z.number().int().min(1).optional(),
  volume: z.number().min(0).max(1).default(1),
});

export const BackgroundMusicSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(1).default(0.1),
  fadeInFrames: z.number().int().min(0).default(30),
  fadeOutFrames: z.number().int().min(0).default(60),
});

// ============================================
// VISUAL SEGMENT
// ============================================
export const TransitionSchema = z.object({
  type: z.enum(["none", "fade", "crossfade", "slide-left", "slide-right", "zoom", "blur"]),
  durationFrames: z.number().int().min(0).default(15),
});

export const MotionSchema = z.object({
  type: z.enum(["none", "ken-burns", "pan-left", "pan-right", "zoom-in", "zoom-out", "float"]),
  intensity: z.number().min(0).max(1).default(0.3),
});

export const SegmentSchema = z.object({
  id: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  durationFrames: z.number().int().min(1),
  imageSrc: z.string(),
  imageAlt: z.string().optional(),
  transition: TransitionSchema.optional(),
  motion: MotionSchema.optional(),
  overlayText: z.string().optional(),
  overlayPosition: z.enum(["top", "center", "bottom"]).optional(),
  sectionId: z.string().optional(),
  beatId: z.string().optional(),
});

// ============================================
// CAPTIONS
// ============================================
export const CaptionSchema = z.object({
  id: z.number().int(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  text: z.string(),
  style: z.object({
    fontSize: z.number().optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
    position: z.enum(["bottom", "top", "center"]).optional(),
  }).optional(),
});

// ============================================
// THEME CONFIG
// ============================================
export const ThemeConfigSchema = z.object({
  primaryColor: z.string().default("#6366f1"),
  secondaryColor: z.string().default("#22c55e"),
  backgroundColor: z.string().default("#000000"),
  textColor: z.string().default("#ffffff"),
  fontFamily: z.string().default("Inter, sans-serif"),
  captionFontSize: z.number().default(48),
  captionPosition: z.enum(["bottom", "top", "center"]).default("bottom"),
  captionBackground: z.boolean().default(true),
  captionBackgroundOpacity: z.number().min(0).max(1).default(0.7),
  defaultTransition: TransitionSchema.default({ type: "crossfade", durationFrames: 15 }),
  defaultMotion: MotionSchema.default({ type: "ken-burns", intensity: 0.2 }),
  showWatermark: z.boolean().default(false),
  watermarkSrc: z.string().optional(),
  watermarkOpacity: z.number().min(0).max(1).default(0.3),
});

// ============================================
// METADATA
// ============================================
export const TimelineMetadataSchema = z.object({
  projectId: z.string(),
  jobId: z.string(),
  title: z.string(),
  generatedAt: z.string(),
  pipelineVersion: z.string().default("1.0"),
  nichePreset: z.string(),
  templateId: z.string(),
  visualPresetId: z.string(),
  totalSections: z.number().int(),
  totalImages: z.number().int(),
  totalCaptions: z.number().int(),
  estimatedCredits: z.number(),
});

// ============================================
// FULL TIMELINE
// ============================================
export const TimelineSchema = z.object({
  version: z.literal("1.0"),
  fps: z.number().int().min(24).max(60).default(30),
  width: z.number().int().default(1920),
  height: z.number().int().default(1080),
  durationFrames: z.number().int().min(1),
  durationMs: z.number().int().min(1),
  audio: AudioTrackSchema,
  backgroundMusic: BackgroundMusicSchema.optional(),
  segments: z.array(SegmentSchema).min(1),
  captions: z.array(CaptionSchema),
  theme: ThemeConfigSchema.optional(),
  metadata: TimelineMetadataSchema,
});

// ============================================
// TYPE EXPORTS
// ============================================
export type Timeline = z.infer<typeof TimelineSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
export type BackgroundMusic = z.infer<typeof BackgroundMusicSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type TimelineMetadata = z.infer<typeof TimelineMetadataSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Motion = z.infer<typeof MotionSchema>;

// ============================================
// HELPERS
// ============================================
export function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

export function framesToMs(frames: number, fps: number): number {
  return Math.round((frames / fps) * 1000);
}

export function validateTimeline(timeline: unknown): Timeline {
  return TimelineSchema.parse(timeline);
}

export function validateTimelineSegments(timeline: Timeline): string[] {
  const errors: string[] = [];
  let lastEndFrame = 0;
  
  for (const segment of timeline.segments) {
    if (segment.startFrame !== lastEndFrame) {
      errors.push(`Gap or overlap at frame ${lastEndFrame}-${segment.startFrame}`);
    }
    lastEndFrame = segment.endFrame;
  }
  
  if (lastEndFrame !== timeline.durationFrames) {
    errors.push(`Segments end at ${lastEndFrame} but duration is ${timeline.durationFrames}`);
  }
  
  return errors;
}

export function getTimelineDurationMs(timeline: Timeline): number {
  return timeline.durationMs;
}

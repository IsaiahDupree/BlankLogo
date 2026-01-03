import { z } from "zod";

// ============================================
// Timeline Contract v1 (Canonical)
// ============================================

export const TimelineTrackType = z.enum(["audio", "image", "caption", "sfx"]);

export const TimelineOverlay = z.object({
  text: z.string(),
  x: z.number().min(0).max(1).default(0.08),
  y: z.number().min(0).max(1).default(0.78),
  size: z.number().int().min(12).max(96).default(44),
  weight: z.number().int().min(300).max(900).default(700),
});

export const TimelineTransition = z.object({
  type: z.enum(["cut", "fade"]).default("cut"),
  durationFrames: z.number().int().min(0).max(30).default(0),
});

export const TimelineImage = z.object({
  src: z.string().min(1),
  fit: z.enum(["cover", "contain"]).default("cover"),
  zoom: z.number().min(1).max(1.2).default(1),
});

export const TimelineSegment = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  text: z.string().optional(),
  image: TimelineImage.optional(),
  captions: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
  overlays: z.array(TimelineOverlay).default([]),
  transition: TimelineTransition.default({ type: "cut", durationFrames: 0 }),
});

export const TimelineTrack = z.object({
  type: TimelineTrackType,
  src: z.string().min(1).optional(),
  volume: z.number().min(0).max(1).optional(),
});

export const TimelineTheme = z.object({
  primary: z.string().default("#2F2B4A"),
  secondary: z.string().default("#4B6B4D"),
  accent: z.string().default("#3E356C"),
  text: z.string().default("#111827"),
  fontFamily: z.string().default("Inter"),
});

export const TimelineCaptionStyle = z.object({
  enabled: z.boolean().default(true),
  position: z.enum(["bottom", "center"]).default("bottom"),
  maxWidthPct: z.number().min(0.4).max(0.95).default(0.86),
  fontSize: z.number().int().min(18).max(72).default(44),
  lineHeight: z.number().min(1).max(1.6).default(1.15),
  textColor: z.string().default("#F7F7F7"),
  strokeColor: z.string().default("#111827"),
  strokeWidth: z.number().min(0).max(8).default(3),
  bgColor: z.string().default("rgba(17,24,39,0.35)"),
  bgPadding: z.number().int().min(0).max(40).default(16),
  borderRadius: z.number().int().min(0).max(40).default(18),
});

export const TimelineCaptions = z.object({
  src: z.string().min(1).optional(),
  style: TimelineCaptionStyle.default({}),
});

export const TimelineContractV1 = z.object({
  version: z.literal(1),
  fps: z.number().int().min(24).max(60).default(30),
  width: z.number().int().min(720).max(3840).default(1920),
  height: z.number().int().min(720).max(2160).default(1080),
  durationFrames: z.number().int().min(1).optional(),
  theme: TimelineTheme.default({}),
  tracks: z.array(TimelineTrack).default([]),
  captions: TimelineCaptions.default({}),
  segments: z.array(TimelineSegment).min(1),
});

// ============================================
// Type exports
// ============================================
export type TimelineV1 = z.infer<typeof TimelineContractV1>;
export type TimelineSegmentType = z.infer<typeof TimelineSegment>;
export type TimelineTrackTypeEnum = z.infer<typeof TimelineTrackType>;
export type TimelineThemeType = z.infer<typeof TimelineTheme>;
export type TimelineCaptionsType = z.infer<typeof TimelineCaptions>;
export type TimelineOverlayType = z.infer<typeof TimelineOverlay>;
export type TimelineTransitionType = z.infer<typeof TimelineTransition>;
export type TimelineImageType = z.infer<typeof TimelineImage>;

// ============================================
// Helpers
// ============================================
export function validateTimelineV1(timeline: unknown): TimelineV1 {
  return TimelineContractV1.parse(timeline);
}

export function calculateDurationFrames(segments: TimelineSegmentType[]): number {
  if (segments.length === 0) return 0;
  return Math.max(...segments.map(s => s.endFrame));
}

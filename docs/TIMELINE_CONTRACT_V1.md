# CanvasCast Timeline Contract v1

The `timeline.json` file is the core data contract between the AI pipeline and Remotion templates.

---

## Purpose

The timeline is a **complete, self-contained specification** for rendering a video. It includes:
- All timing information (frames, not milliseconds)
- All asset paths (relative to timeline location)
- All rendering instructions (transitions, captions, effects)

A Remotion template reads this file and renders the video without needing any other context.

---

## Schema Overview

```
Timeline
├── version: string
├── fps: number
├── width: number
├── height: number
├── durationFrames: number
├── durationMs: number
├── audio: AudioTrack
├── segments: Segment[]
├── captions: Caption[]
├── metadata: TimelineMetadata
└── theme: ThemeConfig (optional)
```

---

## Full Zod Schema

```typescript
// packages/shared/src/timeline.ts

import { z } from 'zod';

// ============================================
// AUDIO TRACK
// ============================================
export const AudioTrackSchema = z.object({
  src: z.string(), // Relative path: "audio/merged.mp3"
  startFrame: z.number().int().min(0).default(0),
  durationFrames: z.number().int().min(1).optional(), // If omitted, use full audio
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
  type: z.enum(['none', 'fade', 'crossfade', 'slide-left', 'slide-right', 'zoom', 'blur']),
  durationFrames: z.number().int().min(0).default(15), // 0.5s at 30fps
});

export const MotionSchema = z.object({
  type: z.enum(['none', 'ken-burns', 'pan-left', 'pan-right', 'zoom-in', 'zoom-out', 'float']),
  intensity: z.number().min(0).max(1).default(0.3), // How much movement
});

export const SegmentSchema = z.object({
  id: z.string(),
  
  // Timing (in frames)
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  durationFrames: z.number().int().min(1),
  
  // Visual
  imageSrc: z.string(), // Relative path: "images/beat_001.png"
  imageAlt: z.string().optional(), // Accessibility
  
  // Effects
  transition: TransitionSchema.optional(),
  motion: MotionSchema.optional(),
  
  // Overlay text (optional hero text)
  overlayText: z.string().optional(),
  overlayPosition: z.enum(['top', 'center', 'bottom']).optional(),
  
  // Metadata
  sectionId: z.string().optional(), // Link to script section
  beatId: z.string().optional(),
});

// ============================================
// CAPTIONS
// ============================================
export const CaptionSchema = z.object({
  id: z.number().int(),
  
  // Timing (in frames)
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  
  // Content
  text: z.string(),
  
  // Styling (optional overrides)
  style: z.object({
    fontSize: z.number().optional(),
    fontWeight: z.enum(['normal', 'bold']).optional(),
    color: z.string().optional(), // Hex color
    backgroundColor: z.string().optional(),
    position: z.enum(['bottom', 'top', 'center']).optional(),
  }).optional(),
});

// ============================================
// THEME CONFIG
// ============================================
export const ThemeConfigSchema = z.object({
  // Colors
  primaryColor: z.string().default('#6366f1'), // Brand purple
  secondaryColor: z.string().default('#22c55e'),
  backgroundColor: z.string().default('#000000'),
  textColor: z.string().default('#ffffff'),
  
  // Typography
  fontFamily: z.string().default('Inter, sans-serif'),
  captionFontSize: z.number().default(48),
  captionPosition: z.enum(['bottom', 'top', 'center']).default('bottom'),
  captionBackground: z.boolean().default(true),
  captionBackgroundOpacity: z.number().min(0).max(1).default(0.7),
  
  // Effects
  defaultTransition: TransitionSchema.default({ type: 'crossfade', durationFrames: 15 }),
  defaultMotion: MotionSchema.default({ type: 'ken-burns', intensity: 0.2 }),
  
  // Branding
  showWatermark: z.boolean().default(false),
  watermarkSrc: z.string().optional(),
  watermarkOpacity: z.number().min(0).max(1).default(0.3),
});

// ============================================
// METADATA
// ============================================
export const TimelineMetadataSchema = z.object({
  // Project info
  projectId: z.string(),
  jobId: z.string(),
  title: z.string(),
  
  // Generation info
  generatedAt: z.string().datetime(),
  pipelineVersion: z.string().default('1.0'),
  
  // Source info
  nichePreset: z.string(),
  templateId: z.string(),
  visualPresetId: z.string(),
  
  // Stats
  totalSections: z.number().int(),
  totalImages: z.number().int(),
  totalCaptions: z.number().int(),
  
  // Cost tracking
  estimatedCredits: z.number(),
});

// ============================================
// FULL TIMELINE
// ============================================
export const TimelineSchema = z.object({
  // Version for schema evolution
  version: z.literal('1.0'),
  
  // Video specs
  fps: z.number().int().min(24).max(60).default(30),
  width: z.number().int().default(1920),
  height: z.number().int().default(1080),
  
  // Duration
  durationFrames: z.number().int().min(1),
  durationMs: z.number().int().min(1),
  
  // Audio
  audio: AudioTrackSchema,
  backgroundMusic: BackgroundMusicSchema.optional(),
  
  // Visual segments (must cover all frames)
  segments: z.array(SegmentSchema).min(1),
  
  // Captions
  captions: z.array(CaptionSchema),
  
  // Theme/styling
  theme: ThemeConfigSchema.optional(),
  
  // Metadata
  metadata: TimelineMetadataSchema,
});

// ============================================
// TYPE EXPORTS
// ============================================
export type Timeline = z.infer<typeof TimelineSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type AudioTrack = z.infer<typeof AudioTrackSchema>;
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
  
  // Check segments cover all frames
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
```

---

## Example timeline.json

```json
{
  "version": "1.0",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "durationFrames": 18000,
  "durationMs": 600000,
  
  "audio": {
    "src": "audio/merged.mp3",
    "startFrame": 0,
    "volume": 1.0
  },
  
  "backgroundMusic": {
    "src": "audio/background.mp3",
    "volume": 0.08,
    "fadeInFrames": 60,
    "fadeOutFrames": 90
  },
  
  "segments": [
    {
      "id": "seg_001",
      "startFrame": 0,
      "endFrame": 150,
      "durationFrames": 150,
      "imageSrc": "images/beat_001.png",
      "imageAlt": "Sun energy visualization",
      "transition": {
        "type": "fade",
        "durationFrames": 30
      },
      "motion": {
        "type": "zoom-in",
        "intensity": 0.2
      },
      "sectionId": "section_001",
      "beatId": "beat_001"
    },
    {
      "id": "seg_002",
      "startFrame": 150,
      "endFrame": 300,
      "durationFrames": 150,
      "imageSrc": "images/beat_002.png",
      "imageAlt": "Solar panel array",
      "transition": {
        "type": "crossfade",
        "durationFrames": 15
      },
      "motion": {
        "type": "ken-burns",
        "intensity": 0.3
      },
      "sectionId": "section_001",
      "beatId": "beat_002"
    }
  ],
  
  "captions": [
    {
      "id": 1,
      "startFrame": 0,
      "endFrame": 96,
      "text": "Every hour, the sun delivers enough energy"
    },
    {
      "id": 2,
      "startFrame": 96,
      "endFrame": 180,
      "text": "to power humanity for an entire year."
    },
    {
      "id": 3,
      "startFrame": 180,
      "endFrame": 270,
      "text": "So why aren't we using more of it?"
    }
  ],
  
  "theme": {
    "primaryColor": "#6366f1",
    "secondaryColor": "#22c55e",
    "backgroundColor": "#000000",
    "textColor": "#ffffff",
    "fontFamily": "Inter, sans-serif",
    "captionFontSize": 48,
    "captionPosition": "bottom",
    "captionBackground": true,
    "captionBackgroundOpacity": 0.7,
    "defaultTransition": {
      "type": "crossfade",
      "durationFrames": 15
    },
    "defaultMotion": {
      "type": "ken-burns",
      "intensity": 0.2
    },
    "showWatermark": false
  },
  
  "metadata": {
    "projectId": "proj_abc123",
    "jobId": "job_xyz789",
    "title": "How Solar Panels Work",
    "generatedAt": "2026-01-02T10:30:00Z",
    "pipelineVersion": "1.0",
    "nichePreset": "science",
    "templateId": "minimal",
    "visualPresetId": "photorealistic",
    "totalSections": 6,
    "totalImages": 45,
    "totalCaptions": 120,
    "estimatedCredits": 10
  }
}
```

---

## Remotion Integration

The Remotion composition consumes this timeline:

```tsx
// packages/remotion/src/compositions/CanvasCastVideo.tsx

import { useCurrentFrame, Audio, Img, AbsoluteFill, interpolate } from 'remotion';
import type { Timeline, Segment, Caption } from '@canvascast/shared';

interface Props {
  timeline: Timeline;
}

export const CanvasCastVideo: React.FC<Props> = ({ timeline }) => {
  const frame = useCurrentFrame();
  
  // Find current segment
  const currentSegment = timeline.segments.find(
    seg => frame >= seg.startFrame && frame < seg.endFrame
  );
  
  // Find current caption
  const currentCaption = timeline.captions.find(
    cap => frame >= cap.startFrame && frame < cap.endFrame
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: timeline.theme?.backgroundColor ?? '#000' }}>
      {/* Background Image with Motion */}
      {currentSegment && (
        <SegmentImage segment={currentSegment} frame={frame} />
      )}
      
      {/* Audio Track */}
      <Audio src={timeline.audio.src} volume={timeline.audio.volume} />
      
      {/* Background Music */}
      {timeline.backgroundMusic && (
        <Audio 
          src={timeline.backgroundMusic.src} 
          volume={timeline.backgroundMusic.volume}
        />
      )}
      
      {/* Captions */}
      {currentCaption && (
        <CaptionDisplay 
          caption={currentCaption} 
          theme={timeline.theme}
          frame={frame}
        />
      )}
    </AbsoluteFill>
  );
};
```

---

## Validation Rules

1. **Segments must be contiguous** - No gaps or overlaps
2. **All asset paths must be relative** - No absolute paths
3. **Duration must match** - `durationFrames` = last segment's `endFrame`
4. **Caption timing must be within video** - All captions within `durationFrames`
5. **FPS must be consistent** - All frame calculations use same FPS

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-02 | Initial contract |

---

*This contract is the source of truth for the pipeline ↔ Remotion interface.*

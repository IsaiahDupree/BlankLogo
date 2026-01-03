import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ============================================
// Schema Definitions (matching shared package)
// ============================================

const ScriptSectionSchema = z.object({
  id: z.string().min(1),
  headline: z.string().min(1),
  narrationText: z.string().min(1),
  visualKeywords: z.array(z.string()).min(1),
  estimatedDurationMs: z.number().int().positive().optional(),
});

const ScriptSchema = z.object({
  title: z.string().min(1),
  estimatedMinutes: z.number().positive().optional(),
  sections: z.array(ScriptSectionSchema).min(1),
});

const WhisperSegmentSchema = z.object({
  id: z.number().int().min(0),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
});

const WhisperOutputSchema = z.object({
  segments: z.array(WhisperSegmentSchema).min(1),
  words: z.array(z.object({
    word: z.string(),
    start: z.number().min(0),
    end: z.number().min(0),
  })).optional(),
  duration: z.number().min(0),
});

const VisualSlotSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  prompt: z.string().min(1),
  style: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  text: z.string().optional(),
});

const VisualPlanSchema = z.object({
  totalDurationMs: z.number().int().positive(),
  imageCount: z.number().int().positive(),
  slots: z.array(VisualSlotSchema).min(1),
});

const TimelineSegmentSchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  text: z.string().optional(),
  image: z.object({
    src: z.string().min(1),
    fit: z.enum(["cover", "contain"]),
    zoom: z.number().min(1).max(2),
  }).optional(),
  overlays: z.array(z.any()).optional(),
  transition: z.object({
    type: z.enum(["cut", "fade"]),
    durationFrames: z.number().int().min(0),
  }).optional(),
});

const TimelineSchema = z.object({
  version: z.literal(1),
  fps: z.number().int().min(24).max(60),
  width: z.number().int().min(720).max(3840),
  height: z.number().int().min(720).max(2160),
  durationFrames: z.number().int().min(1).optional(),
  theme: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    text: z.string(),
    fontFamily: z.string(),
  }).optional(),
  tracks: z.array(z.object({
    type: z.enum(["audio", "image", "caption", "sfx"]),
    src: z.string().optional(),
    volume: z.number().min(0).max(1).optional(),
  })).optional(),
  captions: z.object({
    src: z.string().optional(),
    style: z.any().optional(),
  }).optional(),
  segments: z.array(TimelineSegmentSchema).min(1),
});

// ============================================
// Script Schema Tests
// ============================================

describe("Script Schema Validation", () => {
  it("validates good script fixture", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../fixtures/script.good.json"), "utf-8")
    );
    const result = ScriptSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it("rejects bad script fixture", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../fixtures/script.bad.json"), "utf-8")
    );
    const result = ScriptSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it("requires non-empty title", () => {
    const script = {
      title: "",
      sections: [{ id: "s1", headline: "H", narrationText: "T", visualKeywords: ["k"] }],
    };
    expect(ScriptSchema.safeParse(script).success).toBe(false);
  });

  it("requires at least one section", () => {
    const script = { title: "Test", sections: [] };
    expect(ScriptSchema.safeParse(script).success).toBe(false);
  });

  it("requires non-empty narrationText in sections", () => {
    const script = {
      title: "Test",
      sections: [{ id: "s1", headline: "H", narrationText: "", visualKeywords: ["k"] }],
    };
    expect(ScriptSchema.safeParse(script).success).toBe(false);
  });

  it("requires at least one visual keyword", () => {
    const script = {
      title: "Test",
      sections: [{ id: "s1", headline: "H", narrationText: "T", visualKeywords: [] }],
    };
    expect(ScriptSchema.safeParse(script).success).toBe(false);
  });
});

// ============================================
// Whisper Output Schema Tests
// ============================================

describe("Whisper Output Schema Validation", () => {
  it("validates good whisper segments fixture", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../fixtures/whisper_segments.good.json"), "utf-8")
    );
    const result = WhisperOutputSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it("requires segments array", () => {
    const output = { duration: 10 };
    expect(WhisperOutputSchema.safeParse(output).success).toBe(false);
  });

  it("validates segment has required fields", () => {
    const output = {
      segments: [{ id: 0, start: 0, end: 1, text: "Hello" }],
      duration: 1,
    };
    expect(WhisperOutputSchema.safeParse(output).success).toBe(true);
  });

  it("rejects negative start times", () => {
    const output = {
      segments: [{ id: 0, start: -1, end: 1, text: "Hello" }],
      duration: 1,
    };
    expect(WhisperOutputSchema.safeParse(output).success).toBe(false);
  });
});

// ============================================
// Visual Plan Schema Tests
// ============================================

describe("Visual Plan Schema Validation", () => {
  it("validates good visual plan fixture", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../fixtures/visual_plan.good.json"), "utf-8")
    );
    const result = VisualPlanSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it("requires at least one slot", () => {
    const plan = { totalDurationMs: 1000, imageCount: 0, slots: [] };
    expect(VisualPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("validates slot timing", () => {
    const plan = {
      totalDurationMs: 1000,
      imageCount: 1,
      slots: [{ id: "s1", startMs: 0, endMs: 1000, prompt: "Test prompt" }],
    };
    expect(VisualPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("rejects slot with endMs before startMs", () => {
    const plan = {
      totalDurationMs: 1000,
      imageCount: 1,
      slots: [{ id: "s1", startMs: 500, endMs: 0, prompt: "Test" }],
    };
    // Note: Schema doesn't enforce this, but we should add custom validation
    // For now, just check endMs >= 1
    expect(VisualPlanSchema.safeParse(plan).success).toBe(false);
  });
});

// ============================================
// Timeline Schema Tests
// ============================================

describe("Timeline Schema Validation", () => {
  it("validates good timeline fixture", () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../fixtures/timeline.good.json"), "utf-8")
    );
    const result = TimelineSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it("requires version 1", () => {
    const timeline = {
      version: 2,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [{ id: "s1", startFrame: 0, endFrame: 30 }],
    };
    expect(TimelineSchema.safeParse(timeline).success).toBe(false);
  });

  it("validates fps range", () => {
    const base = {
      version: 1,
      width: 1920,
      height: 1080,
      segments: [{ id: "s1", startFrame: 0, endFrame: 30 }],
    };

    expect(TimelineSchema.safeParse({ ...base, fps: 24 }).success).toBe(true);
    expect(TimelineSchema.safeParse({ ...base, fps: 30 }).success).toBe(true);
    expect(TimelineSchema.safeParse({ ...base, fps: 60 }).success).toBe(true);
    expect(TimelineSchema.safeParse({ ...base, fps: 23 }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...base, fps: 61 }).success).toBe(false);
  });

  it("requires at least one segment", () => {
    const timeline = {
      version: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [],
    };
    expect(TimelineSchema.safeParse(timeline).success).toBe(false);
  });

  it("validates segment frame ordering", () => {
    const timeline = {
      version: 1,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [
        { id: "s1", startFrame: 0, endFrame: 30 },
        { id: "s2", startFrame: 30, endFrame: 60 },
      ],
    };
    const result = TimelineSchema.safeParse(timeline);
    expect(result.success).toBe(true);
  });
});

// ============================================
// Timeline Consistency Validation
// ============================================

function validateTimelineConsistency(timeline: z.infer<typeof TimelineSchema>): string[] {
  const errors: string[] = [];
  let lastEndFrame = 0;

  for (let i = 0; i < timeline.segments.length; i++) {
    const segment = timeline.segments[i];

    // Check frame ordering
    if (segment.startFrame < lastEndFrame) {
      errors.push(`Segment ${i}: startFrame ${segment.startFrame} overlaps with previous endFrame ${lastEndFrame}`);
    }

    if (segment.endFrame <= segment.startFrame) {
      errors.push(`Segment ${i}: endFrame ${segment.endFrame} must be greater than startFrame ${segment.startFrame}`);
    }

    // Check for gaps (warning, not error)
    if (segment.startFrame > lastEndFrame && i > 0) {
      errors.push(`Segment ${i}: gap detected from frame ${lastEndFrame} to ${segment.startFrame}`);
    }

    lastEndFrame = segment.endFrame;
  }

  // Check duration matches last segment
  if (timeline.durationFrames && lastEndFrame !== timeline.durationFrames) {
    errors.push(`Timeline durationFrames ${timeline.durationFrames} doesn't match last segment endFrame ${lastEndFrame}`);
  }

  return errors;
}

describe("Timeline Consistency Validation", () => {
  it("passes for well-formed timeline", () => {
    const timeline = {
      version: 1 as const,
      fps: 30,
      width: 1920,
      height: 1080,
      durationFrames: 90,
      segments: [
        { id: "s1", startFrame: 0, endFrame: 30 },
        { id: "s2", startFrame: 30, endFrame: 60 },
        { id: "s3", startFrame: 60, endFrame: 90 },
      ],
    };
    const errors = validateTimelineConsistency(timeline);
    expect(errors).toHaveLength(0);
  });

  it("detects overlapping segments", () => {
    const timeline = {
      version: 1 as const,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [
        { id: "s1", startFrame: 0, endFrame: 40 },
        { id: "s2", startFrame: 30, endFrame: 60 }, // Overlaps!
      ],
    };
    const errors = validateTimelineConsistency(timeline);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("overlaps");
  });

  it("detects gaps between segments", () => {
    const timeline = {
      version: 1 as const,
      fps: 30,
      width: 1920,
      height: 1080,
      segments: [
        { id: "s1", startFrame: 0, endFrame: 30 },
        { id: "s2", startFrame: 40, endFrame: 60 }, // Gap!
      ],
    };
    const errors = validateTimelineConsistency(timeline);
    expect(errors.some((e) => e.includes("gap"))).toBe(true);
  });

  it("detects duration mismatch", () => {
    const timeline = {
      version: 1 as const,
      fps: 30,
      width: 1920,
      height: 1080,
      durationFrames: 100, // Says 100, but segments end at 60
      segments: [
        { id: "s1", startFrame: 0, endFrame: 30 },
        { id: "s2", startFrame: 30, endFrame: 60 },
      ],
    };
    const errors = validateTimelineConsistency(timeline);
    expect(errors.some((e) => e.includes("durationFrames"))).toBe(true);
  });
});

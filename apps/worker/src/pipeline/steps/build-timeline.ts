import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset, heartbeat } from "../../lib/db";

const supabase = createAdminSupabase();

const FPS = 30;

// Helper function to convert ms to frames
function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

// Timeline types (matching TimelineContractV1)
type TimelineSegment = {
  id: string;
  startFrame: number;
  endFrame: number;
  text?: string;
  image?: {
    src: string;
    fit: "cover" | "contain";
    zoom: number;
  };
  overlays: Array<{
    text: string;
    x?: number;
    y?: number;
    size?: number;
    weight?: number;
  }>;
  transition: {
    type: "cut" | "fade";
    durationFrames: number;
  };
};

type TimelineV1 = {
  version: 1;
  fps: number;
  width: number;
  height: number;
  durationFrames?: number;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    fontFamily: string;
  };
  tracks: Array<{
    type: "audio" | "image" | "caption" | "sfx";
    src?: string;
    volume?: number;
  }>;
  captions: {
    src?: string;
    style: {
      enabled: boolean;
      position: "bottom" | "center";
      maxWidthPct: number;
      fontSize: number;
      lineHeight: number;
      textColor: string;
      strokeColor: string;
      strokeWidth: number;
      bgColor: string;
      bgPadding: number;
      borderRadius: number;
    };
  };
  segments: TimelineSegment[];
};

export async function buildTimeline(
  ctx: PipelineContext
): Promise<StepResult<{ timeline: TimelineV1 }>> {
  try {
    const plan = ctx.artifacts.visualPlan;
    const imagePaths = ctx.artifacts.imagePaths;
    const narrationPath = ctx.artifacts.narrationPath;
    const captionsPath = ctx.artifacts.captionsSrtPath;
    const durationMs = ctx.artifacts.narrationDurationMs ?? 0;

    if (!plan || !imagePaths || imagePaths.length === 0) {
      return createStepError("ERR_TIMELINE", "Missing visual plan or images");
    }

    // Build segments
    const segments = plan.slots.map((slot, idx) => {
      const startFrame = msToFrames(slot.startMs, FPS);
      const endFrame = msToFrames(slot.endMs, FPS);
      const imagePath = imagePaths[idx] ?? imagePaths[imagePaths.length - 1];

      // Get signed URL for image
      const imageUrl = getStorageUrl(imagePath);

      return {
        id: slot.id,
        startFrame,
        endFrame,
        text: slot.text,
        image: {
          src: imageUrl,
          fit: "cover" as const,
          zoom: 1.03,
        },
        overlays: [],
        transition: {
          type: idx === 0 ? "cut" as const : "fade" as const,
          durationFrames: idx === 0 ? 0 : 12,
        },
      };
    });

    const timeline: TimelineV1 = {
      version: 1,
      fps: FPS,
      width: 1920,
      height: 1080,
      durationFrames: msToFrames(durationMs, FPS),
      theme: {
        primary: "#2F2B4A",
        secondary: "#4B6B4D",
        accent: "#3E356C",
        text: "#111827",
        fontFamily: "Inter",
      },
      tracks: [
        {
          type: "audio",
          src: getStorageUrl(narrationPath ?? ""),
          volume: 1,
        },
      ],
      captions: {
        src: captionsPath ? getStorageUrl(captionsPath) : undefined,
        style: {
          enabled: true,
          position: "bottom",
          maxWidthPct: 0.86,
          fontSize: 44,
          lineHeight: 1.15,
          textColor: "#F7F7F7",
          strokeColor: "#111827",
          strokeWidth: 3,
          bgColor: "rgba(17,24,39,0.35)",
          bgPadding: 16,
          borderRadius: 18,
        },
      },
      segments,
    };

    // Upload timeline
    const timelinePath = `${ctx.basePath}/timeline/timeline.json`;
    await supabase.storage
      .from("project-assets")
      .upload(timelinePath, new Blob([JSON.stringify(timeline, null, 2)], { type: "application/json" }), { upsert: true });

    // Create asset record
    await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "timeline",
      path: timelinePath,
      meta: { segments: segments.length, durationMs },
    });

    ctx.artifacts.timelinePath = timelinePath;

    return createStepResult({ timeline });
  } catch (error) {
    return createStepError(
      "ERR_TIMELINE",
      error instanceof Error ? error.message : "Unknown error building timeline"
    );
  }
}

function getStorageUrl(path: string): string {
  if (!path) return "";
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  return `${supabaseUrl}/storage/v1/object/public/project-assets/${path}`;
}

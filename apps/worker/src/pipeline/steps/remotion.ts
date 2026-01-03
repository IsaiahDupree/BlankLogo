import type { PipelineContext } from "../index.js";
import type { ScriptResult } from "./scripting.js";
import type { TTSResult } from "./tts.js";
import type { VisualsResult } from "./visuals.js";
import { TimelineSchema, type Timeline, type Segment, type Caption } from "@canvascast/shared";
import fs from "node:fs/promises";
import path from "node:path";

export async function runRemotion(
  ctx: PipelineContext,
  script: ScriptResult,
  tts: TTSResult,
  visuals: VisualsResult
): Promise<Timeline> {
  const { supabase, userId, projectId, jobId, tmpDir } = ctx;
  const fps = 30;

  // Build timeline segments and captions from script + TTS + visuals
  const segments: Segment[] = [];
  const captions: Caption[] = [];
  let currentFrame = 0;
  let captionId = 0;

  for (let i = 0; i < script.segments.length; i++) {
    const seg = script.segments[i];
    const ttsSeg = tts.segments.find((t) => t.segmentId === seg.id);
    const visualSeg = visuals.segments.find((v) => v.segmentId === seg.id);

    if (!ttsSeg || !visualSeg) {
      console.warn(`Missing TTS or visual for segment ${seg.id}`);
      continue;
    }

    // Calculate frames from duration
    const durationFrames = Math.ceil((ttsSeg.durationMs / 1000) * fps);
    const startFrame = currentFrame;
    const endFrame = currentFrame + durationFrames;

    // Get primary image for this segment
    const primaryImage = visualSeg.images[0];

    segments.push({
      id: seg.id,
      startFrame,
      endFrame,
      durationFrames,
      imageSrc: primaryImage?.storagePath || "",
      imageAlt: seg.narrationText.substring(0, 100),
      transition: { type: "crossfade", durationFrames: 15 },
      motion: primaryImage?.motion ? { type: primaryImage.motion as any, intensity: 0.3 } : undefined,
      overlayText: i === 0 ? script.title.toUpperCase() : undefined,
      sectionId: seg.id,
    });

    // Add captions from TTS
    if (ttsSeg.captions) {
      for (const cap of ttsSeg.captions) {
        captions.push({
          id: captionId++,
          startFrame: startFrame + Math.round((cap.startMs / 1000) * fps),
          endFrame: startFrame + Math.round((cap.endMs / 1000) * fps),
          text: cap.text,
        });
      }
    }

    currentFrame = endFrame;
  }

  // Create timeline object conforming to schema
  const timeline: Timeline = TimelineSchema.parse({
    version: "1.0",
    fps,
    width: 1920,
    height: 1080,
    durationFrames: currentFrame,
    durationMs: Math.round((currentFrame / fps) * 1000),
    audio: {
      src: tts.segments[0]?.storagePath || "",
      startFrame: 0,
      volume: 1,
    },
    segments,
    captions,
    metadata: {
      projectId,
      jobId,
      title: script.title,
      generatedAt: new Date().toISOString(),
      pipelineVersion: "1.0",
      nichePreset: "default",
      templateId: "default",
      visualPresetId: "default",
      totalSections: segments.length,
      totalImages: segments.length,
      totalCaptions: captions.length,
      estimatedCredits: Math.ceil(currentFrame / fps / 60),
    },
  });

  // Save timeline to file
  const timelineFile = path.join(tmpDir, "timeline.json");
  await fs.writeFile(timelineFile, JSON.stringify(timeline, null, 2), "utf-8");

  // Upload timeline to storage
  const timelineStoragePath = `u_${userId}/p_${projectId}/timeline/timeline.json`;
  const { error: uploadErr } = await supabase.storage
    .from("project-assets")
    .upload(timelineStoragePath, await fs.readFile(timelineFile), {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadErr) {
    console.warn("Timeline upload failed:", uploadErr.message);
  }

  // Log asset
  await supabase.from("assets").insert({
    user_id: userId,
    project_id: projectId,
    job_id: jobId,
    type: "timeline",
    path: `project-assets/${timelineStoragePath}`,
    meta: { segments: segments.length, totalFrames: currentFrame },
  });

  // Update project with timeline path
  await supabase
    .from("projects")
    .update({ timeline_path: `project-assets/${timelineStoragePath}` })
    .eq("id", projectId);

  // For MVP: Skip actual Remotion rendering (would need Remotion CLI/bundler)
  // In production, you'd call renderMedia here
  console.log(`[${jobId}] Timeline created with ${segments.length} segments, ${currentFrame} frames`);

  // Create placeholder video (in production, use Remotion renderMedia)
  await createPlaceholderVideo(ctx, timeline);

  return timeline;
}

async function createPlaceholderVideo(
  ctx: PipelineContext,
  timeline: Timeline
): Promise<void> {
  const { supabase, userId, projectId, jobId, tmpDir } = ctx;

  // For MVP, create a simple placeholder MP4
  // In production, use @remotion/renderer to render the actual video
  const videoPath = path.join(tmpDir, "final.mp4");

  // Create a minimal valid MP4 header (placeholder)
  // In production, this would be the actual Remotion render output
  const placeholderMp4 = Buffer.from([
    0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
    0x6d, 0x70, 0x34, 0x31,
  ]);

  await fs.writeFile(videoPath, placeholderMp4);

  // Upload to storage
  const videoStoragePath = `u_${userId}/p_${projectId}/outputs/final.mp4`;
  const { error } = await supabase.storage
    .from("project-outputs")
    .upload(videoStoragePath, await fs.readFile(videoPath), {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    console.warn("Video upload failed:", error.message);
  }

  // Log asset
  await supabase.from("assets").insert({
    user_id: userId,
    project_id: projectId,
    job_id: jobId,
    type: "video",
    path: `project-outputs/${videoStoragePath}`,
    meta: {
      durationMs: timeline.segments.reduce(
        (acc, s) => acc + ((s.endFrame - s.startFrame) / timeline.fps) * 1000,
        0
      ),
      fps: timeline.fps,
      width: timeline.width,
      height: timeline.height,
    },
  });
}

import { createClient } from "@supabase/supabase-js";
import type { JobStatus, JobErrorCode } from "@blanklogo/shared";
import {
  type PipelineContext,
  type JobRow,
  type ProjectRow,
  type JobEventPayload,
  createBasePath,
  createOutputPath,
} from "./types";
import { notifyJobCompleted, notifyJobFailed, notifyCreditsLow } from "../userNotify";

// Step imports
import { ingestInputs } from "./steps/ingest-inputs";
import { generateScript } from "./steps/generate-script";
import { generateVoice } from "./steps/generate-voice";
import { runAlignment } from "./steps/run-alignment";
import { planVisuals } from "./steps/plan-visuals";
import { generateImages } from "./steps/generate-images";
import { buildTimeline } from "./steps/build-timeline";
import { renderVideo } from "./steps/render-video";
import { packageAssets } from "./steps/package-assets";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// PIPELINE RUNNER
// ============================================

export async function runPipeline(job: JobRow): Promise<void> {
  console.log(`[Pipeline] Starting job ${job.id}`);

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", job.project_id)
    .single();

  if (projectError || !project) {
    await failJob(job.id, "ERR_UNKNOWN", "Failed to fetch project");
    return;
  }

  // Build context
  const ctx: PipelineContext = {
    job,
    project: project as ProjectRow,
    userId: job.user_id,
    projectId: job.project_id,
    jobId: job.id,
    basePath: createBasePath(job.user_id, job.project_id, job.id),
    outputPath: createOutputPath(job.user_id, job.project_id, job.id),
    artifacts: {},
  };

  try {
    // Step 1: Ingest inputs
    await updateJobStatus(job.id, "SCRIPTING", 5);
    await logEvent(job.id, "SCRIPTING", "Ingesting inputs...");
    const inputsResult = await ingestInputs(ctx);
    if (!inputsResult.success) {
      await failJob(job.id, inputsResult.error!.code, inputsResult.error!.message);
      return;
    }
    ctx.artifacts.mergedInputText = inputsResult.data!.mergedText;

    // Step 2: Generate script
    await updateJobStatus(job.id, "SCRIPTING", 15);
    await logEvent(job.id, "SCRIPTING", "Generating script...");
    const scriptResult = await generateScript(ctx);
    if (!scriptResult.success) {
      await failJob(job.id, scriptResult.error!.code, scriptResult.error!.message);
      return;
    }
    ctx.artifacts.script = scriptResult.data!.script;

    // Step 3: Generate voice
    await updateJobStatus(job.id, "VOICE_GEN", 25);
    await logEvent(job.id, "VOICE_GEN", "Generating voice narration...");
    const voiceResult = await generateVoice(ctx);
    if (!voiceResult.success) {
      await failJob(job.id, voiceResult.error!.code, voiceResult.error!.message);
      return;
    }
    ctx.artifacts.narrationPath = voiceResult.data!.narrationPath;
    ctx.artifacts.narrationDurationMs = voiceResult.data!.durationMs;

    // Step 4: Run alignment (Whisper)
    await updateJobStatus(job.id, "ALIGNMENT", 40);
    await logEvent(job.id, "ALIGNMENT", "Running speech alignment...");
    const alignmentResult = await runAlignment(ctx);
    if (!alignmentResult.success) {
      await failJob(job.id, alignmentResult.error!.code, alignmentResult.error!.message);
      return;
    }
    ctx.artifacts.whisperSegments = alignmentResult.data!.segments;
    ctx.artifacts.captionsSrtPath = alignmentResult.data!.srtPath;

    // Step 5: Plan visuals
    await updateJobStatus(job.id, "VISUAL_PLAN", 50);
    await logEvent(job.id, "VISUAL_PLAN", "Planning visual timeline...");
    const planResult = await planVisuals(ctx);
    if (!planResult.success) {
      await failJob(job.id, planResult.error!.code, planResult.error!.message);
      return;
    }
    ctx.artifacts.visualPlan = planResult.data!.plan;

    // Step 6: Generate images
    await updateJobStatus(job.id, "IMAGE_GEN", 55);
    await logEvent(job.id, "IMAGE_GEN", `Generating ${ctx.artifacts.visualPlan?.totalImages ?? 0} images...`);
    const imagesResult = await generateImages(ctx);
    if (!imagesResult.success) {
      await failJob(job.id, imagesResult.error!.code, imagesResult.error!.message);
      return;
    }
    ctx.artifacts.imagePaths = imagesResult.data!.imagePaths;

    // Step 7: Build timeline
    await updateJobStatus(job.id, "TIMELINE_BUILD", 75);
    await logEvent(job.id, "TIMELINE_BUILD", "Building timeline...");
    const timelineResult = await buildTimeline(ctx);
    if (!timelineResult.success) {
      await failJob(job.id, timelineResult.error!.code, timelineResult.error!.message);
      return;
    }
    ctx.artifacts.timeline = timelineResult.data!.timeline;

    // Step 8: Render video
    await updateJobStatus(job.id, "RENDERING", 80);
    await logEvent(job.id, "RENDERING", "Rendering video with Remotion...");
    const renderResult = await renderVideo(ctx);
    if (!renderResult.success) {
      await failJob(job.id, renderResult.error!.code, renderResult.error!.message);
      return;
    }
    ctx.artifacts.videoPath = renderResult.data!.videoPath;

    // Step 9: Package assets
    await updateJobStatus(job.id, "PACKAGING", 95);
    await logEvent(job.id, "PACKAGING", "Packaging assets...");
    const packageResult = await packageAssets(ctx);
    if (!packageResult.success) {
      // If packaging fails but video exists, still mark as ready
      console.warn(`[Pipeline] Packaging failed but video exists: ${packageResult.error?.message}`);
    } else {
      ctx.artifacts.zipPath = packageResult.data!.zipPath;
    }

    // Success!
    await completeJob(job.id, ctx);

  } catch (error) {
    console.error(`[Pipeline] Unexpected error:`, error);
    await failJob(job.id, "ERR_UNKNOWN", error instanceof Error ? error.message : "Unknown error");
  }
}

// ============================================
// HELPERS
// ============================================

async function updateJobStatus(jobId: string, status: JobStatus, progress: number): Promise<void> {
  await supabase
    .from("jobs")
    .update({ status, progress, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

async function logEvent(jobId: string, stage: JobStatus, message: string, meta?: Record<string, unknown>): Promise<void> {
  await supabase.from("job_events").insert({
    job_id: jobId,
    stage,
    message,
    meta: meta ?? {},
  });
}

async function failJob(jobId: string, errorCode: JobErrorCode, errorMessage: string, userId?: string): Promise<void> {
  console.error(`[Pipeline] Job ${jobId} failed: ${errorCode} - ${errorMessage}`);
  
  await supabase
    .from("jobs")
    .update({
      status: "FAILED",
      error_code: errorCode,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await logEvent(jobId, "FAILED", errorMessage, { error_code: errorCode });

  // Release reserved credits
  await supabase.rpc("release_job_credits", { p_job_id: jobId });

  // Send failure notification email
  if (userId) {
    try {
      await notifyJobFailed(userId, jobId, errorMessage, 'pipeline');
      console.log(`[Pipeline] Failure notification sent for job ${jobId}`);
    } catch (err) {
      console.error(`[Pipeline] Failed to send failure notification:`, err);
    }
  }
}

async function completeJob(jobId: string, ctx: PipelineContext): Promise<void> {
  console.log(`[Pipeline] Job ${jobId} completed successfully`);

  // Calculate final credits
  const durationMinutes = Math.ceil((ctx.artifacts.narrationDurationMs ?? 0) / 60000);
  const finalCredits = Math.max(1, durationMinutes);

  await supabase
    .from("jobs")
    .update({
      status: "READY",
      progress: 100,
      cost_credits_final: finalCredits,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  await logEvent(jobId, "READY", "Job completed successfully", {
    duration_ms: ctx.artifacts.narrationDurationMs,
    images_count: ctx.artifacts.imagePaths?.length ?? 0,
    final_credits: finalCredits,
  });

  // Finalize credits
  await supabase.rpc("finalize_job_credits", {
    p_user_id: ctx.userId,
    p_job_id: jobId,
    p_final_cost: finalCredits,
  });

  // Update project status
  await supabase
    .from("projects")
    .update({
      status: "ready",
      timeline_path: ctx.artifacts.timelinePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.projectId);

  // Send completion notification email
  if (ctx.userId) {
    try {
      const outputUrl = ctx.artifacts.timelinePath || '';
      const processingTime = ctx.artifacts.narrationDurationMs || 0;
      await notifyJobCompleted(ctx.userId, jobId, outputUrl, processingTime, 'pipeline');
      console.log(`[Pipeline] Completion notification sent for job ${jobId}`);
      
      // Check if credits are low and notify
      const { data: profile } = await supabase
        .from('bl_profiles')
        .select('credits_balance')
        .eq('id', ctx.userId)
        .single();
      
      if (profile && profile.credits_balance <= 5) {
        await notifyCreditsLow(ctx.userId, profile.credits_balance);
      }
    } catch (err) {
      console.error(`[Pipeline] Failed to send completion notification:`, err);
    }
  }
}

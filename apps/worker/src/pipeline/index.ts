import type { SupabaseClient } from "@supabase/supabase-js";
import { runScripting } from "./steps/scripting.js";
import { runTTS } from "./steps/tts.js";
import { runVisuals } from "./steps/visuals.js";
import { runRemotion } from "./steps/remotion.js";
import { runPackaging } from "./steps/packaging.js";
import { notifyJobEvent } from "./notify.js";

export type JobRow = {
  id: string;
  project_id: string;
  user_id: string;
  status: string;
  progress: number;
};

export type PipelineContext = {
  job: JobRow;
  supabase: SupabaseClient;
  tmpDir: string;
  userId: string;
  projectId: string;
  jobId: string;
};

async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
  if (error) {
    console.error(`Failed to update job ${jobId}:`, error.message);
  }
}

async function updateProject(
  supabase: SupabaseClient,
  projectId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId);
  if (error) {
    console.error(`Failed to update project ${projectId}:`, error.message);
  }
}

export async function processJob(job: JobRow, supabase: SupabaseClient) {
  const { id: jobId, project_id: projectId, user_id: userId } = job;

  // Create temp directory
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const os = await import("node:os");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `blanklogo-${jobId}-`));

  const ctx: PipelineContext = {
    job,
    supabase,
    tmpDir,
    userId,
    projectId,
    jobId,
  };

  try {
    // Notify job started
    await notifyJobEvent(jobId, "JOB_STARTED");

    // 1. SCRIPTING
    console.log(`  [${jobId}] Step: SCRIPTING`);
    await updateJob(supabase, jobId, { status: "SCRIPTING", progress: 5 });
    const scriptResult = await runScripting(ctx);

    // 2. TTS
    console.log(`  [${jobId}] Step: TTS`);
    await updateJob(supabase, jobId, { status: "TTS", progress: 20 });
    const ttsResult = await runTTS(ctx, scriptResult);

    // 3. ALIGNMENT (embedded in TTS for now)
    await updateJob(supabase, jobId, { status: "ALIGNMENT", progress: 35 });

    // 4. VISUALS
    console.log(`  [${jobId}] Step: VISUALS`);
    await updateJob(supabase, jobId, { status: "VISUALS", progress: 45 });
    const visualsResult = await runVisuals(ctx, scriptResult);

    // 5. REMOTION_RENDER
    console.log(`  [${jobId}] Step: REMOTION_RENDER`);
    await updateJob(supabase, jobId, { status: "REMOTION_RENDER", progress: 65 });
    const timeline = await runRemotion(ctx, scriptResult, ttsResult, visualsResult);

    // 6. PACKAGING
    console.log(`  [${jobId}] Step: PACKAGING`);
    await updateJob(supabase, jobId, { status: "PACKAGING", progress: 90 });
    await runPackaging(ctx, timeline);

    // DONE
    await updateJob(supabase, jobId, {
      status: "READY",
      progress: 100,
      finished_at: new Date().toISOString(),
    });

    await updateProject(supabase, projectId, { status: "ready" });

    console.log(`  [${jobId}] ✅ READY`);
    await notifyJobEvent(jobId, "JOB_COMPLETED");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  [${jobId}] ❌ FAILED:`, message);

    await updateJob(supabase, jobId, {
      status: "FAILED",
      error_code: "WORKER_FAILED",
      error_message: message,
      finished_at: new Date().toISOString(),
    });

    await updateProject(supabase, projectId, { status: "failed" });

    await notifyJobEvent(jobId, "JOB_FAILED");
  } finally {
    // Cleanup temp directory
    const fs = await import("node:fs/promises");
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

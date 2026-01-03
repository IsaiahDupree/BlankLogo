import { createAdminSupabase } from "./supabase";

const supabase = createAdminSupabase();

export type EventLevel = "info" | "warn" | "error" | "debug";

export async function insertJobEvent(
  jobId: string,
  stage: string,
  message: string,
  level: EventLevel = "info",
  meta: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase.from("job_events").insert({
    job_id: jobId,
    event_type: stage, // Required column
    stage,
    message,
    level,
    meta,
  });

  if (error) {
    console.error(`Failed to insert job event: ${error.message}`);
  }
}

export interface AssetInput {
  user_id: string;
  project_id: string;
  job_id: string;
  type: string;
  path: string;
  meta?: Record<string, unknown>;
}

export async function upsertAsset(asset: AssetInput): Promise<void> {
  const { error } = await supabase.from("assets").upsert(
    {
      ...asset,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "job_id,type",
    }
  );

  if (error) {
    console.error(`Failed to upsert asset: ${error.message}`);
  }
}

export async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({
      status,
      progress,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", jobId);

  if (error) {
    console.error(`Failed to update job status: ${error.message}`);
  }
}

export async function failJob(
  jobId: string,
  errorCode: string,
  errorMessage: string
): Promise<void> {
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

  await insertJobEvent(jobId, "FAILED", errorMessage, "error", { error_code: errorCode });
}

export async function completeJob(
  jobId: string,
  finalCredits: number
): Promise<void> {
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

  await insertJobEvent(jobId, "READY", "Job completed successfully", "info", {
    final_credits: finalCredits,
  });
}

export async function heartbeat(jobId: string): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error(`Heartbeat failed for job ${jobId}: ${error.message}`);
  }
}

export async function requeueStaleJobs(
  staleMinutes = 15,
  maxAttempts = 3
): Promise<number> {
  const { data, error } = await supabase.rpc("requeue_stale_jobs", {
    p_stale_minutes: staleMinutes,
    p_max_attempts: maxAttempts,
  });

  if (error) {
    throw new Error(`requeue_stale_jobs failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  return row?.requeued_count ?? 0;
}

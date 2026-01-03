import { createAdminSupabase } from "./supabase";
import type { JobRow, ProjectRow } from "../pipeline/types";

const supabase = createAdminSupabase();

export interface ClaimedJob {
  job: JobRow;
  project: ProjectRow;
}

export async function claimNextJob(
  workerId: string,
  maxActivePerUser = 1
): Promise<ClaimedJob | null> {
  const { data, error } = await supabase.rpc("claim_next_job", {
    p_worker_id: workerId,
    p_max_active_per_user: maxActivePerUser,
  });

  if (error) {
    throw new Error(`claim_next_job RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.job_id) return null;

  // Fetch full job row
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", row.job_id)
    .single();

  if (jobError || !job) {
    console.error("Failed to fetch claimed job:", jobError?.message);
    return null;
  }

  // Fetch project row
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", row.project_id)
    .single();

  if (projectError || !project) {
    console.error("Failed to fetch project:", projectError?.message);
    return null;
  }

  return {
    job: job as JobRow,
    project: project as ProjectRow,
  };
}

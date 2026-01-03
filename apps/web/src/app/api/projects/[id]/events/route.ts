import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.id;

  // Verify user owns this project
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  // Get latest job for project
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, status, progress, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestJob = jobs?.[0];
  if (!latestJob) {
    return NextResponse.json({ ok: true, jobId: null, status: null, events: [] });
  }

  // Get events for this job
  const { data: events } = await supabase
    .from("job_events")
    .select("stage, level, message, meta, created_at")
    .eq("job_id", latestJob.id)
    .order("created_at", { ascending: false })
    .limit(80);

  return NextResponse.json({
    ok: true,
    jobId: latestJob.id,
    status: latestJob.status,
    progress: latestJob.progress,
    events: (events ?? []).reverse(), // oldest -> newest for UI
  });
}

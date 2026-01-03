import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status === "generating") {
    return NextResponse.json({ error: "Project is already generating" }, { status: 400 });
  }

  // Check credits
  const { data: balance } = await adminSupabase.rpc("get_credit_balance", {
    p_user_id: user.id,
  });

  const requiredCredits = project.target_minutes;
  if ((balance ?? 0) < requiredCredits) {
    return NextResponse.json(
      { error: `Insufficient credits. Need ${requiredCredits}, have ${balance ?? 0}` },
      { status: 402 }
    );
  }

  // Create job
  const { data: job, error: jobError } = await adminSupabase
    .from("jobs")
    .insert({
      project_id: projectId,
      user_id: user.id,
      status: "QUEUED",
      progress: 0,
      cost_credits_reserved: requiredCredits,
    })
    .select()
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  // Reserve credits
  const { error: reserveError } = await adminSupabase.rpc("reserve_credits", {
    p_user_id: user.id,
    p_job_id: job.id,
    p_amount: requiredCredits,
  });

  if (reserveError) {
    // Rollback job
    await adminSupabase.from("jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: reserveError.message }, { status: 500 });
  }

  // Update project status
  await supabase
    .from("projects")
    .update({ status: "generating" })
    .eq("id", projectId);

  return NextResponse.json({ job }, { status: 201 });
}

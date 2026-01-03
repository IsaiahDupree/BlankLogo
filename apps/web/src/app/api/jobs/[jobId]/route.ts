import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/jobs/[jobId] - Get job details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const { jobId } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get job
    const { data: job, error } = await supabase
      .from("bl_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get job events
    const { data: events } = await supabase
      .from("bl_job_events")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      job,
      events: events || [],
    });
  } catch (err) {
    console.error("Get job error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// PATCH /api/jobs/[jobId] - Update job (cancel, retry)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const { jobId } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Get current job
    const { data: job, error: fetchError } = await supabase
      .from("bl_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (action === "cancel") {
      // Check if job can be cancelled
      const cancellableStates = ["created", "validating", "queued", "processing", "preview_ready", "awaiting_payment"];
      
      if (!cancellableStates.includes(job.status)) {
        return NextResponse.json(
          { error: `Cannot cancel job in ${job.status} state` },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("bl_jobs")
        .update({
          status: "cancelled",
          updated_at: now,
        })
        .eq("id", jobId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Log event
      await logJobEvent(supabase, jobId, "state_change", {
        fromState: job.status,
        toState: "cancelled",
        message: "Job cancelled by user",
      });

      // Refund credits if charged
      if (job.credits_charged > 0) {
        await refundCredits(supabase, user.id, jobId, job.credits_charged);
      }

      return NextResponse.json({
        message: "Job cancelled",
        job: { ...job, status: "cancelled" },
      });
    }

    if (action === "retry") {
      // Check if job can be retried
      if (job.status !== "failed_retryable") {
        return NextResponse.json(
          { error: `Cannot retry job in ${job.status} state` },
          { status: 400 }
        );
      }

      if (job.retry_count >= job.max_retries) {
        return NextResponse.json(
          { error: "Maximum retry attempts reached" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("bl_jobs")
        .update({
          status: "queued",
          retry_count: job.retry_count + 1,
          error_code: null,
          error_message: null,
          updated_at: now,
        })
        .eq("id", jobId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Log event
      await logJobEvent(supabase, jobId, "retry", {
        fromState: job.status,
        toState: "queued",
        message: `Retry attempt ${job.retry_count + 1}`,
        metadata: { retryCount: job.retry_count + 1 },
      });

      return NextResponse.json({
        message: "Job queued for retry",
        job: { ...job, status: "queued", retry_count: job.retry_count + 1 },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Update job error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// DELETE /api/jobs/[jobId] - Delete job
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const supabase = await createClient();
  const { jobId } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get job first
    const { data: job } = await supabase
      .from("bl_jobs")
      .select("status, credits_charged")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Only allow deletion of completed, failed, or cancelled jobs
    const deletableStates = ["completed", "failed_permanent", "cancelled", "expired"];
    if (!deletableStates.includes(job.status)) {
      return NextResponse.json(
        { error: "Cannot delete active job. Cancel it first." },
        { status: 400 }
      );
    }

    // Delete job events first
    await supabase.from("bl_job_events").delete().eq("job_id", jobId);

    // Delete job
    const { error } = await supabase
      .from("bl_jobs")
      .delete()
      .eq("id", jobId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Job deleted" });
  } catch (err) {
    console.error("Delete job error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper: Log job event
async function logJobEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  type: string,
  data: Record<string, unknown>
) {
  await supabase.from("bl_job_events").insert({
    id: crypto.randomUUID(),
    job_id: jobId,
    type,
    from_state: data.fromState,
    to_state: data.toState,
    message: data.message,
    metadata: data.metadata,
    created_at: new Date().toISOString(),
  });
}

// Helper: Refund credits
async function refundCredits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  amount: number
) {
  // Get current balance
  const { data: profile } = await supabase
    .from("bl_profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  const newBalance = (profile?.credits_balance || 0) + amount;

  // Update balance
  await supabase
    .from("bl_profiles")
    .update({ credits_balance: newBalance })
    .eq("id", userId);

  // Log ledger entry
  await supabase.from("bl_credit_ledger").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    type: "refund",
    amount: amount,
    balance: newBalance,
    job_id: jobId,
    description: `Refund for cancelled job ${jobId}`,
    created_at: new Date().toISOString(),
  });
}

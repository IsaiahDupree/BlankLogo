import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/jobs - List user's jobs
export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("bl_jobs")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }
    if (type) {
      query = query.eq("type", type);
    }

    const { data: jobs, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("List jobs error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST /api/jobs - Create new job
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type = "watermark_removal",
      input,
      options = {},
      rightsConfirmed = false,
    } = body;

    // Validate required fields
    if (!input?.source) {
      return NextResponse.json(
        { error: "Input source is required" },
        { status: 400 }
      );
    }

    if (!rightsConfirmed) {
      return NextResponse.json(
        { error: "Rights confirmation is required" },
        { status: 400 }
      );
    }

    // Check credits balance
    const { data: profile } = await supabase
      .from("bl_profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    const creditsRequired = calculateCredits(type, options);
    
    if ((profile?.credits_balance || 0) < creditsRequired) {
      return NextResponse.json(
        { 
          error: "Insufficient credits",
          creditsRequired,
          creditsAvailable: profile?.credits_balance || 0,
        },
        { status: 402 }
      );
    }

    // Create job
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: job, error } = await supabase
      .from("bl_jobs")
      .insert({
        id: jobId,
        user_id: user.id,
        type,
        status: "created",
        input_type: input.type || "url",
        input_source: input.source,
        input_filename: input.filename || extractFilename(input.source),
        platform: options.platform || "custom",
        mode: options.mode || "crop",
        crop_pixels: options.cropPixels,
        options: options,
        rights_confirmed: true,
        rights_confirmed_at: now,
        credits_required: creditsRequired,
        progress: 0,
        retry_count: 0,
        max_retries: 3,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log job creation event
    await logJobEvent(supabase, jobId, "state_change", {
      toState: "created",
      message: "Job created",
    });

    // Transition to validating state
    await supabase
      .from("bl_jobs")
      .update({ status: "validating", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await logJobEvent(supabase, jobId, "state_change", {
      fromState: "created",
      toState: "validating",
      message: "Validating input",
    });

    return NextResponse.json({
      job: { ...job, status: "validating" },
      message: "Job created successfully",
    }, { status: 201 });
  } catch (err) {
    console.error("Create job error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper: Calculate credits required
function calculateCredits(type: string, options: Record<string, unknown>): number {
  let credits = 1;

  // Video costs more
  if (type === "video_watermark") {
    credits = 3;
  }

  // Inpaint mode costs more
  if (options.mode === "inpaint") {
    credits *= 2;
  }

  return credits;
}

// Helper: Extract filename from URL
function extractFilename(source: string): string {
  try {
    const url = new URL(source);
    const path = url.pathname;
    return path.split("/").pop() || "video.mp4";
  } catch {
    return source.split("/").pop() || "video.mp4";
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/jobs/batch - List batch jobs
export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: batches, error } = await supabase
      .from("bl_batch_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ batches: batches || [] });
  } catch (err) {
    console.error("List batches error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST /api/jobs/batch - Create batch job
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      items = [],
      options = {},
      rightsConfirmed = false,
    } = body;

    if (!items.length) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    if (items.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 items per batch" },
        { status: 400 }
      );
    }

    if (!rightsConfirmed) {
      return NextResponse.json(
        { error: "Rights confirmation is required" },
        { status: 400 }
      );
    }

    // Calculate total credits needed
    const creditsPerItem = options.mode === "inpaint" ? 2 : 1;
    const totalCredits = items.length * creditsPerItem;

    // Check credits balance
    const { data: profile } = await supabase
      .from("bl_profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    if ((profile?.credits_balance || 0) < totalCredits) {
      return NextResponse.json(
        {
          error: "Insufficient credits for batch",
          creditsRequired: totalCredits,
          creditsAvailable: profile?.credits_balance || 0,
        },
        { status: 402 }
      );
    }

    const batchId = crypto.randomUUID();
    const now = new Date().toISOString();
    const jobIds: string[] = [];

    // Create individual jobs
    for (const item of items) {
      const jobId = crypto.randomUUID();
      jobIds.push(jobId);

      await supabase.from("bl_jobs").insert({
        id: jobId,
        user_id: user.id,
        batch_id: batchId,
        type: "watermark_removal",
        status: "created",
        input_type: item.type || "url",
        input_source: item.source,
        input_filename: item.filename || extractFilename(item.source),
        platform: options.platform || "custom",
        mode: options.mode || "crop",
        crop_pixels: options.cropPixels,
        options: options,
        rights_confirmed: true,
        rights_confirmed_at: now,
        credits_required: creditsPerItem,
        progress: 0,
        retry_count: 0,
        max_retries: 3,
        created_at: now,
        updated_at: now,
      });
    }

    // Create batch record
    const { data: batch, error } = await supabase
      .from("bl_batch_jobs")
      .insert({
        id: batchId,
        user_id: user.id,
        name: name || `Batch ${new Date().toLocaleDateString()}`,
        total_items: items.length,
        processed_items: 0,
        failed_items: 0,
        status: "created",
        options: options,
        job_ids: jobIds,
        credits_required: totalCredits,
        credits_charged: 0,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Start processing (transition all jobs to queued)
    await supabase
      .from("bl_jobs")
      .update({ status: "queued", updated_at: now })
      .eq("batch_id", batchId);

    await supabase
      .from("bl_batch_jobs")
      .update({ status: "processing" })
      .eq("id", batchId);

    return NextResponse.json({
      batch: { ...batch, status: "processing" },
      jobIds,
      message: "Batch created successfully",
    }, { status: 201 });
  } catch (err) {
    console.error("Create batch error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Helper: Extract filename from URL
function extractFilename(source: string): string {
  try {
    const url = new URL(source);
    const path = url.pathname;
    return path.split("/").pop() || "file";
  } catch {
    return source.split("/").pop() || "file";
  }
}

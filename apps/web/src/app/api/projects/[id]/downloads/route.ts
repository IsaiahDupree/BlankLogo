import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify project belongs to user
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "ready") {
    return NextResponse.json(
      { error: "Project not ready for download" },
      { status: 400 }
    );
  }

  // Get all output assets for this project
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("type, path")
    .eq("project_id", projectId)
    .in("type", ["video", "captions", "zip", "timeline", "script"]);

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  // Generate signed URLs for each asset using admin client (has storage access)
  const adminClient = createAdminClient();
  const downloads: Record<string, string> = {};
  const expiresIn = 3600; // 1 hour

  console.log("[Downloads API] Found assets:", assets?.length ?? 0);

  for (const asset of assets ?? []) {
    // Parse bucket and path from storage path
    const pathParts = asset.path.split("/");
    const bucket = pathParts[0];
    const storagePath = pathParts.slice(1).join("/");

    console.log(`[Downloads API] Creating signed URL for ${asset.type}: bucket=${bucket}, path=${storagePath}`);

    const { data: signedUrl, error: signError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (signError) {
      console.error(`[Downloads API] Failed to sign ${asset.type}:`, signError.message);
    }

    if (!signError && signedUrl?.signedUrl) {
      downloads[asset.type] = signedUrl.signedUrl;
      console.log(`[Downloads API] Success: ${asset.type}`);
    }
  }

  console.log("[Downloads API] Final downloads:", Object.keys(downloads));

  return NextResponse.json({
    projectId,
    expiresIn,
    downloads,
  });
}

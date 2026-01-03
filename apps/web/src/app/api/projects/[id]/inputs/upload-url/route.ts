import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const UploadUrlSchema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.id;

  // Verify user owns project
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = UploadUrlSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { filename, contentType } = parsed.data;

  const bucket = "project-assets";
  const safeName = filename.replace(/[^\w.\-]+/g, "_");
  const path = `u_${user.id}/p_${projectId}/uploads/${Date.now()}_${safeName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Failed to create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    bucket,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    contentType,
  });
}

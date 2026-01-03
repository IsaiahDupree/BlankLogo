import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateInputSchema = z.object({
  type: z.enum(["text", "url", "file"]),
  title: z.string().max(140).optional(),
  content_text: z.string().optional(),
  source_url: z.string().url().optional(),
  storage_path: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

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

  // Verify user owns project
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const { data: inputs, error } = await supabase
    .from("project_inputs")
    .select("id, type, title, content_text, source_url, storage_path, meta, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inputs: inputs ?? [] });
}

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
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const v = parsed.data;

  // Validation by type
  if (v.type === "text" && !(v.content_text ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "content_text required for text input" }, { status: 400 });
  }

  if (v.type === "url" && !(v.source_url ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "source_url required for URL input" }, { status: 400 });
  }

  if (v.type === "file" && !(v.storage_path ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "storage_path required for file input" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_inputs")
    .insert({
      project_id: projectId,
      user_id: user.id,
      type: v.type,
      title: v.title ?? null,
      content_text: v.content_text ?? null,
      source_url: v.source_url ?? null,
      storage_path: v.storage_path ?? null,
      meta: v.meta ?? {},
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inputId: data.id });
}

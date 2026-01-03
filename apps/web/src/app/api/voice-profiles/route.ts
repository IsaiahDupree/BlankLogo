import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profiles, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const voiceFile = formData.get("voice_file") as File;

  if (!name || !voiceFile) {
    return NextResponse.json(
      { error: "Name and voice file are required" },
      { status: 400 }
    );
  }

  // Validate file type
  if (!voiceFile.type.startsWith("audio/")) {
    return NextResponse.json(
      { error: "File must be an audio file (WAV or MP3)" },
      { status: 400 }
    );
  }

  // Validate file size (max 10MB)
  if (voiceFile.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File size must be less than 10MB" },
      { status: 400 }
    );
  }

  // Upload voice file to storage
  const fileExt = voiceFile.name.split(".").pop() ?? "wav";
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("voice-profiles")
    .upload(fileName, voiceFile, {
      contentType: voiceFile.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create voice profile record
  const { data: profile, error: insertError } = await supabase
    .from("voice_profiles")
    .insert({
      user_id: user.id,
      name,
      voice_ref_path: `voice-profiles/${fileName}`,
      status: "pending", // Will be reviewed/auto-approved
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Auto-approve for now (in production, you might want manual review)
  await supabase
    .from("voice_profiles")
    .update({ status: "approved" })
    .eq("id", profile.id);

  return NextResponse.json({
    profile: { ...profile, status: "approved" },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("id");

  if (!profileId) {
    return NextResponse.json(
      { error: "Profile ID is required" },
      { status: 400 }
    );
  }

  // Get profile to find file path
  const { data: profile } = await supabase
    .from("voice_profiles")
    .select("voice_ref_path")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Delete from storage
  const storagePath = profile.voice_ref_path.replace("voice-profiles/", "");
  await supabase.storage.from("voice-profiles").remove([storagePath]);

  // Delete record
  const { error } = await supabase
    .from("voice_profiles")
    .delete()
    .eq("id", profileId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

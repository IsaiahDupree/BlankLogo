import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Get current user info
export async function GET() {
  const supabase = await createClient();

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get profile data
    const { data: profile } = await supabase
      .from("bl_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at != null,
        name: user.user_metadata?.full_name || profile?.full_name,
        avatar: user.user_metadata?.avatar_url || profile?.avatar_url,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
      },
      profile: profile || null,
    });
  } catch (err) {
    console.error("Get user error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Update profile
export async function PATCH(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const updates = await request.json();
    const allowedFields = ["full_name", "avatar_url"];
    const filteredUpdates: Record<string, string> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update auth metadata
    await supabase.auth.updateUser({
      data: filteredUpdates,
    });

    // Update profile table
    const { error } = await supabase
      .from("bl_profiles")
      .upsert({
        id: user.id,
        ...filteredUpdates,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

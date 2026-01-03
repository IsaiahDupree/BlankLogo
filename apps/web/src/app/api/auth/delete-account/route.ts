import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { password, confirmation } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required to delete account" },
        { status: 400 }
      );
    }

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Please type DELETE to confirm" },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify password (re-authentication)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401 }
      );
    }

    // Schedule account deletion (soft delete with 7-day grace period)
    const adminClient = createAdminClient();
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 7);

    const { error: updateError } = await adminClient
      .from("bl_profiles")
      .upsert({
        id: user.id,
        deletion_scheduled_at: deletionDate.toISOString(),
        deletion_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Sign out user
    await supabase.auth.signOut();

    return NextResponse.json({
      message: "Account scheduled for deletion",
      deletionDate: deletionDate.toISOString(),
      canCancel: true,
      cancelBefore: deletionDate.toISOString(),
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Cancel scheduled deletion
export async function DELETE(request: Request) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("bl_profiles")
      .update({
        deletion_scheduled_at: null,
        deletion_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Account deletion cancelled",
    });
  } catch (err) {
    console.error("Cancel deletion error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

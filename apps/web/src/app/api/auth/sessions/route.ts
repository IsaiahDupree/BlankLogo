import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Get user sessions
export async function GET() {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get session info from auth
    const { data: { session } } = await supabase.auth.getSession();

    // In Supabase, we can track sessions via the bl_sessions table
    const adminClient = createAdminClient();
    const { data: sessions } = await adminClient
      .from("bl_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("last_active_at", { ascending: false });

    return NextResponse.json({
      currentSession: session ? {
        expiresAt: session.expires_at,
        accessToken: session.access_token.substring(0, 20) + "...",
      } : null,
      sessions: sessions || [],
    });
  } catch (err) {
    console.error("Get sessions error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Revoke a specific session
export async function DELETE(request: Request) {
  const supabase = await createClient();

  try {
    const { sessionId, revokeAll } = await request.json();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (revokeAll) {
      // Sign out from all devices
      const { error } = await supabase.auth.signOut({ scope: "global" });
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Clear all sessions in our tracking table
      const adminClient = createAdminClient();
      await adminClient
        .from("bl_sessions")
        .delete()
        .eq("user_id", user.id);

      return NextResponse.json({
        message: "All sessions revoked",
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // Revoke specific session from tracking table
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("bl_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Session revoked",
    });
  } catch (err) {
    console.error("Revoke session error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

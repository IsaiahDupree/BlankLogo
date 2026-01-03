import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { newEmail, password } = await request.json();

    if (!newEmail || !password) {
      return NextResponse.json(
        { error: "New email and password are required" },
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

    // Update email (sends verification to new email)
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${process.env.APP_BASE_URL}/auth/callback?next=/settings` }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: "Verification email sent to your new email address",
    });
  } catch (err) {
    console.error("Change email error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

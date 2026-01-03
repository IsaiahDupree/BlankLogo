import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Re-authenticate user for sensitive actions
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
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

    // Verify password
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401 }
      );
    }

    // Generate a short-lived re-auth token
    const reauthToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        exp: Date.now() + 5 * 60 * 1000, // 5 minutes
      })
    ).toString("base64");

    return NextResponse.json({
      message: "Re-authentication successful",
      reauthToken,
      expiresIn: 300, // 5 minutes
    });
  } catch (err) {
    console.error("Re-auth error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Resend verification email
export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.APP_BASE_URL}/auth/callback`,
      },
    });

    // Always return success to prevent email enumeration
    if (error) {
      console.error("Resend verification error:", error.message);
    }

    return NextResponse.json({
      message: "If your email is registered and unverified, you will receive a verification link",
    });
  } catch (err) {
    console.error("Verify email error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

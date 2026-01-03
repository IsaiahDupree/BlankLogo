import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  console.log("[API: FORGOT PASSWORD] 🔑 Request received");
  
  const supabase = await createClient();
  console.log("[API: FORGOT PASSWORD] Supabase client created");

  try {
    const { email } = await request.json();
    console.log("[API: FORGOT PASSWORD] Email:", email);

    if (!email) {
      console.log("[API: FORGOT PASSWORD] ❌ No email provided");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const redirectUrl = `${process.env.APP_BASE_URL || 'http://localhost:3838'}/auth/callback?next=/reset-password`;
    console.log("[API: FORGOT PASSWORD] Redirect URL:", redirectUrl);
    console.log("[API: FORGOT PASSWORD] ⏳ Calling Supabase resetPasswordForEmail...");
    
    const startTime = Date.now();
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    const duration = Date.now() - startTime;
    
    console.log("[API: FORGOT PASSWORD] ⏱️ Supabase call took:", duration, "ms");
    console.log("[API: FORGOT PASSWORD] Response data:", JSON.stringify(data));

    // Always return success to prevent email enumeration
    if (error) {
      console.error("[API: FORGOT PASSWORD] ❌ Supabase error:", error.message);
      console.error("[API: FORGOT PASSWORD] Error details:", JSON.stringify(error));
    } else {
      console.log("[API: FORGOT PASSWORD] ✅ Password reset email requested successfully");
    }

    return NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link",
    });
  } catch (err) {
    console.error("[API: FORGOT PASSWORD] ❌ Exception:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

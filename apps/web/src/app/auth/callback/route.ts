import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const WELCOME_CREDITS = 10;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error_param = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");
  const origin = requestUrl.origin;

  console.log("[Auth Callback] 🔄 Callback received");
  console.log("[Auth Callback] Full URL:", request.url);
  console.log("[Auth Callback] Origin:", origin);
  console.log("[Auth Callback] Code present:", !!code);
  console.log("[Auth Callback] Error param:", error_param);
  console.log("[Auth Callback] Error description:", error_description);

  // Handle OAuth errors from provider
  if (error_param) {
    console.error("[Auth Callback] ❌ OAuth provider error:", error_param);
    console.error("[Auth Callback] ❌ Error description:", error_description);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description || error_param)}`);
  }

  if (!code) {
    console.error("[Auth Callback] ❌ No code parameter received");
    return NextResponse.redirect(`${origin}/login?error=No authorization code received`);
  }

  console.log("[Auth Callback] 🔄 Exchanging code for session...");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  console.log("[Auth Callback] Exchange result - error:", error?.message);
  console.log("[Auth Callback] Exchange result - user:", data?.user?.id);
  console.log("[Auth Callback] Exchange result - user email:", data?.user?.email);

  if (error) {
    console.error("[Auth Callback] ❌ Session exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }
    
  if (data.user) {
    console.log("[Auth Callback] ✅ User authenticated successfully");
    // Check if this is a new user (just confirmed email)
    // We grant welcome credits if they don't have any credit ledger entries yet
    try {
      const adminSupabase = createAdminClient();
      
      // Check if user already has welcome bonus (to avoid duplicate grants)
      const { data: existingCredits } = await adminSupabase
        .from('bl_credit_ledger')
        .select('id')
        .eq('user_id', data.user.id)
        .ilike('note', '%Welcome bonus%')
        .limit(1);
      
      if (!existingCredits || existingCredits.length === 0) {
        // Grant welcome credits to new user
        const { error: insertError } = await adminSupabase.from('bl_credit_ledger').insert({
          user_id: data.user.id,
          type: 'bonus',
          amount: WELCOME_CREDITS,
          note: `Welcome bonus: ${WELCOME_CREDITS} free credits for signing up`,
        });
        
        if (insertError) {
          console.error('[Auth Callback] Insert error:', insertError);
        } else {
          console.log(`[Auth Callback] Granted ${WELCOME_CREDITS} welcome credits to new user:`, data.user.id);
        }
      } else {
        console.log('[Auth Callback] User already has signup bonus, skipping');
      }
    } catch (err) {
      console.error('[Auth Callback] Failed to grant welcome credits:', err);
      // Don't block the redirect on credit grant failure
    }
  }

  console.log("[Auth Callback] 🔄 Redirecting to /app");
  return NextResponse.redirect(`${origin}/app`);
}

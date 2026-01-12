import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const WELCOME_CREDITS = 10;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Check if this is a new user (just confirmed email)
      // We grant welcome credits if they don't have any credit ledger entries yet
      try {
        const adminSupabase = createAdminClient();
        
        // Check if user already has any credits (to avoid duplicate grants)
        const { data: existingCredits } = await adminSupabase
          .from('credit_ledger')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('type', 'signup_bonus')
          .limit(1);
        
        if (!existingCredits || existingCredits.length === 0) {
          // Grant welcome credits to new user
          await adminSupabase.from('credit_ledger').insert({
            user_id: data.user.id,
            type: 'signup_bonus',
            amount: WELCOME_CREDITS,
            note: `Welcome bonus: ${WELCOME_CREDITS} free credits for signing up`,
          });
          
          console.log(`[Auth Callback] Granted ${WELCOME_CREDITS} welcome credits to new user:`, data.user.id);
        } else {
          console.log('[Auth Callback] User already has signup bonus, skipping');
        }
      } catch (err) {
        console.error('[Auth Callback] Failed to grant welcome credits:', err);
        // Don't block the redirect on credit grant failure
      }
    }
  }

  return NextResponse.redirect(`${origin}/app`);
}

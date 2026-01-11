import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPromoTokenFromCookie, verifyPromoToken, clearPromoTokenCookie, hashForPrivacy } from '@/lib/promo';

export async function POST(request: Request) {
  console.log('[Promo Redeem] Starting redemption process');
  
  try {
    // 1. Get and verify the promo token from cookie
    const token = await getPromoTokenFromCookie();
    
    if (!token) {
      console.log('[Promo Redeem] No promo token found');
      return NextResponse.json(
        { success: false, error: 'No promo token', error_code: 'no_token' },
        { status: 400 }
      );
    }
    
    const payload = await verifyPromoToken(token);
    
    if (!payload) {
      console.log('[Promo Redeem] Invalid or expired token');
      await clearPromoTokenCookie();
      return NextResponse.json(
        { success: false, error: 'Invalid or expired promo token', error_code: 'invalid_token' },
        { status: 400 }
      );
    }
    
    console.log('[Promo Redeem] Token verified for campaign:', payload.campaign_id);
    
    // 2. Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('[Promo Redeem] No authenticated user');
      return NextResponse.json(
        { success: false, error: 'Not authenticated', error_code: 'not_authenticated' },
        { status: 401 }
      );
    }
    
    console.log('[Promo Redeem] User:', user.id);
    
    // 3. Get client info for fraud tracking
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // 4. Call the redemption function (atomic operation in Supabase)
    const { data, error } = await supabase.rpc('bl_redeem_promo', {
      p_user_id: user.id,
      p_campaign_id: payload.campaign_id,
      p_token_hash: hashForPrivacy(token),
      p_ip_hash: hashForPrivacy(clientIp),
      p_user_agent_hash: hashForPrivacy(userAgent),
    });
    
    if (error) {
      console.error('[Promo Redeem] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Redemption failed', error_code: 'db_error', details: error.message },
        { status: 500 }
      );
    }
    
    const result = data?.[0];
    
    if (!result) {
      console.error('[Promo Redeem] No result from redemption function');
      return NextResponse.json(
        { success: false, error: 'Redemption failed', error_code: 'no_result' },
        { status: 500 }
      );
    }
    
    // 5. Handle result
    if (!result.success) {
      console.log('[Promo Redeem] Redemption blocked:', result.error_code);
      
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        'campaign_not_found': 'This promotion is no longer available',
        'campaign_disabled': 'This promotion has ended',
        'campaign_not_started': 'This promotion has not started yet',
        'campaign_expired': 'This promotion has expired',
        'campaign_maxed': 'This promotion has reached its limit',
        'user_not_new': 'This promotion is only for new accounts',
        'already_redeemed': 'You have already claimed this promotion',
      };
      
      return NextResponse.json({
        success: false,
        error: errorMessages[result.error_code] || 'Redemption failed',
        error_code: result.error_code,
      }, { status: 400 });
    }
    
    // 6. Success! Clear the cookie
    await clearPromoTokenCookie();
    
    console.log('[Promo Redeem] Success!', {
      credits_awarded: result.credits_awarded,
      new_balance: result.new_balance,
    });
    
    return NextResponse.json({
      success: true,
      credits_awarded: result.credits_awarded,
      new_balance: result.new_balance,
      message: `You earned ${result.credits_awarded} bonus credits!`,
    });
    
  } catch (error) {
    console.error('[Promo Redeem] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error', error_code: 'internal_error' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing/verification
export async function GET() {
  const token = await getPromoTokenFromCookie();
  
  if (!token) {
    return NextResponse.json({ has_promo: false });
  }
  
  const payload = await verifyPromoToken(token);
  
  if (!payload) {
    return NextResponse.json({ has_promo: false, reason: 'invalid_token' });
  }
  
  return NextResponse.json({
    has_promo: true,
    campaign_id: payload.campaign_id,
    expires_at: payload.expires_at,
  });
}

import { NextResponse } from 'next/server';
import { createPromoToken, setPromoTokenCookie, hashForPrivacy, isValidCampaignId } from '@/lib/promo';

export async function GET(request: Request) {
  const url = new URL(request.url);
  
  // Extract UTM parameters
  const utmSource = url.searchParams.get('utm_source');
  const utmCampaign = url.searchParams.get('utm_campaign');
  const fbclid = url.searchParams.get('fbclid');
  const gclid = url.searchParams.get('gclid');
  
  // Determine campaign ID from UTM params or use default
  let campaignId = utmCampaign || 'blanklogo_10credits';
  
  // Validate campaign ID format
  if (!isValidCampaignId(campaignId)) {
    console.log('[Promo] Invalid campaign ID format:', campaignId);
    campaignId = 'blanklogo_10credits';
  }
  
  // Get client info for fraud prevention
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  console.log('[Promo] Token init requested:', {
    campaignId,
    utmSource,
    utmCampaign,
    hasFbclid: !!fbclid,
    hasGclid: !!gclid,
  });
  
  try {
    // Create signed promo token
    const token = await createPromoToken({
      campaign_id: campaignId,
      ip_hash: hashForPrivacy(clientIp),
      ua_hash: hashForPrivacy(userAgent),
      utm_source: utmSource || undefined,
      utm_campaign: utmCampaign || undefined,
      fbclid: fbclid || undefined,
    });
    
    // Set the cookie
    await setPromoTokenCookie(token);
    
    console.log('[Promo] Token issued for campaign:', campaignId);
    
    return NextResponse.json({ 
      success: true, 
      campaign: campaignId,
      message: 'Promo token set successfully'
    });
    
  } catch (error) {
    console.error('[Promo] Error creating token:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create promo token' 
    }, { status: 500 });
  }
}

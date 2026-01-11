'use client';

import { useEffect, useRef } from 'react';
import { usePromoRedemption } from '@/hooks/use-promo-redemption';
import { useCelebration } from '@/components/credits-celebration';

/**
 * PromoRedeemer - Automatically attempts to redeem promo credits after auth
 * 
 * Place this component in the app layout or dashboard to auto-redeem
 * any pending promo credits for newly authenticated users.
 */
export function PromoRedeemer() {
  const { redeemPromo, checkPromoStatus } = usePromoRedemption();
  const { showCelebration } = useCelebration();
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Only attempt once per mount
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    async function attemptRedemption() {
      try {
        // Check if there's a promo to redeem
        const status = await checkPromoStatus();
        
        if (!status.has_promo) {
          console.log('[PromoRedeemer] No promo to redeem');
          return;
        }

        console.log('[PromoRedeemer] Found promo, attempting redemption:', status.campaign_id);

        // Attempt redemption
        const result = await redeemPromo();

        if (result.success && result.credits_awarded) {
          // Show celebration modal!
          showCelebration(result.credits_awarded, 'promo_signup');
          console.log('[PromoRedeemer] Success!', result);
        } else if (result.error_code === 'already_redeemed') {
          // User already redeemed - this is fine, don't show error
          console.log('[PromoRedeemer] Already redeemed');
        } else if (result.error_code === 'user_not_new') {
          // User is not new - also fine, don't show error
          console.log('[PromoRedeemer] User not eligible (not new)');
        } else if (result.error) {
          // Only show error for unexpected issues
          console.log('[PromoRedeemer] Redemption blocked:', result.error_code);
        }
      } catch (error) {
        console.error('[PromoRedeemer] Error:', error);
      }
    }

    // Small delay to ensure auth is fully settled
    const timer = setTimeout(attemptRedemption, 500);
    return () => clearTimeout(timer);
  }, [checkPromoStatus, redeemPromo, showCelebration]);

  // This component renders nothing
  return null;
}

'use client';

import { useState, useCallback } from 'react';
import { promo as phPromo, credits as phCredits } from '@/lib/posthog-events';

interface PromoRedemptionResult {
  success: boolean;
  credits_awarded?: number;
  new_balance?: number;
  message?: string;
  error?: string;
  error_code?: string;
}

interface PromoStatus {
  has_promo: boolean;
  campaign_id?: string;
  expires_at?: number;
  reason?: string;
}

export function usePromoRedemption() {
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [result, setResult] = useState<PromoRedemptionResult | null>(null);

  /**
   * Check if user has a valid promo token
   */
  const checkPromoStatus = useCallback(async (): Promise<PromoStatus> => {
    try {
      const res = await fetch('/api/promos/redeem', {
        method: 'GET',
        credentials: 'include',
      });
      return await res.json();
    } catch (error) {
      console.error('[usePromoRedemption] Check failed:', error);
      return { has_promo: false };
    }
  }, []);

  /**
   * Attempt to redeem promo credits
   */
  const redeemPromo = useCallback(async (): Promise<PromoRedemptionResult> => {
    setIsRedeeming(true);
    
    try {
      // First check if there's a promo to redeem
      const status = await checkPromoStatus();
      
      if (!status.has_promo) {
        const noPromoResult: PromoRedemptionResult = {
          success: false,
          error: 'No promo available',
          error_code: 'no_promo',
        };
        setResult(noPromoResult);
        return noPromoResult;
      }

      // Track redemption attempt
      phPromo.redeemAttempted({ campaign_id: status.campaign_id || 'unknown' });

      // Attempt redemption
      const res = await fetch('/api/promos/redeem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: PromoRedemptionResult = await res.json();
      setResult(data);

      if (data.success && data.credits_awarded) {
        // Track successful redemption
        phPromo.creditsAwarded({
          campaign_id: status.campaign_id || 'unknown',
          credits: data.credits_awarded,
          new_balance: data.new_balance || 0,
        });
        
        phCredits.awarded({
          credits_delta: data.credits_awarded,
          reason: 'promo_signup',
          new_balance: data.new_balance || 0,
        });
      } else if (!data.success && data.error_code) {
        // Track blocked redemption
        phPromo.redeemBlocked({
          campaign_id: status.campaign_id || 'unknown',
          reason: data.error_code as 'already_redeemed' | 'user_not_new' | 'campaign_maxed' | 'campaign_disabled' | 'expired' | 'invalid_token' | 'no_token' | 'rate_limited',
        });
      }

      return data;
    } catch (error) {
      console.error('[usePromoRedemption] Redeem failed:', error);
      const errorResult: PromoRedemptionResult = {
        success: false,
        error: 'Redemption failed',
        error_code: 'network_error',
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsRedeeming(false);
    }
  }, [checkPromoStatus]);

  return {
    isRedeeming,
    result,
    checkPromoStatus,
    redeemPromo,
  };
}

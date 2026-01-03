"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Check, Loader2, ExternalLink, Zap, Crown, Rocket } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const PRICING_TIERS = [
  { id: "starter", name: "Starter", price: 9, credits: 10 },
  { id: "pro", name: "Pro", price: 29, credits: 50, popular: true },
  { id: "business", name: "Business", price: 79, credits: 200 },
];

const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 9, perCredit: 0.90 },
  { id: "pack_25", credits: 25, price: 19, perCredit: 0.76 },
  { id: "pack_50", credits: 50, price: 35, perCredit: 0.70 },
  { id: "pack_100", credits: 100, price: 59, perCredit: 0.59 },
];

const TIER_ICONS = {
  starter: Zap,
  pro: Crown,
  business: Rocket,
} as const;

export default function CreditsPage() {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchCredits = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get credit balance
      const { data: balance } = await supabase.rpc("get_credit_balance", {
        p_user_id: user.id,
      });
      setCredits(balance ?? 0);

      // Get subscription status
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      setSubscriptionTier(profile?.subscription_tier ?? null);
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  async function handlePurchase(packId: string, isSubscription: boolean = false) {
    setPurchasing(packId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: `price_${packId}`,
          mode: isSubscription ? "subscription" : "payment",
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleManageSubscription() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Portal failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Success/Cancel Messages */}
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
          <Check className="w-5 h-5 inline mr-2" />
          Payment successful! Your credits have been added.
        </div>
      )}
      {canceled && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
          Payment was canceled.
        </div>
      )}

      {/* Current Balance */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Your Credits</h1>
            <p className="text-gray-400">1 credit = 1 minute of video</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-brand-400">{credits}</div>
            <div className="text-sm text-gray-400">minutes available</div>
          </div>
        </div>

        {subscriptionTier && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Active subscription: <span className="text-white font-medium capitalize">{subscriptionTier.replace("_", " ")}</span>
            </div>
            <button
              onClick={handleManageSubscription}
              className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              Manage subscription <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Subscription Plans */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Monthly Plans</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {PRICING_TIERS.map((tier) => {
            const isPopular = "popular" in tier && tier.popular;
            const TierIcon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS];
            const isCurrentTier = subscriptionTier === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative rounded-xl p-5 ${
                  isPopular
                    ? "bg-brand-500/10 border-2 border-brand-500"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-brand-500 rounded-full text-xs font-medium">
                    Popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                    <TierIcon className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="font-semibold">{tier.name}</div>
                    <div className="text-sm text-gray-400">{tier.credits} credits/mo</div>
                  </div>
                </div>

                <div className="text-2xl font-bold mb-4">
                  ${tier.price}<span className="text-sm text-gray-400 font-normal">/mo</span>
                </div>

                <button
                  onClick={() => handlePurchase(tier.id, true)}
                  disabled={purchasing === tier.id || isCurrentTier}
                  className={`w-full py-2 rounded-lg font-medium transition ${
                    isCurrentTier
                      ? "bg-green-500/20 text-green-400 cursor-default"
                      : isPopular
                      ? "bg-brand-600 hover:bg-brand-500"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  {purchasing === tier.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : isCurrentTier ? (
                    <>
                      <Check className="w-4 h-4 inline mr-1" />
                      Current Plan
                    </>
                  ) : (
                    "Subscribe"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Credit Packs */}
      <div>
        <h2 className="text-xl font-bold mb-4">Top-Up Packs</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="bg-white/5 border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-brand-400" />
                <span className="font-semibold">{pack.credits} Credits</span>
              </div>

              <div className="text-2xl font-bold mb-1">${pack.price}</div>
              <div className="text-xs text-gray-400 mb-4">
                ${pack.perCredit.toFixed(2)}/credit
              </div>

              <button
                onClick={() => handlePurchase(pack.id)}
                disabled={purchasing === pack.id}
                className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition"
              >
                {purchasing === pack.id ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Buy"
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

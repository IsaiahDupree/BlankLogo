"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Check, Loader2, ExternalLink, Zap, Crown, Rocket } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/components/toast";
import { 
  trackViewContent, 
  trackSelectCreditPack as metaSelectPack, 
  trackStartCheckout as metaStartCheckout, 
  trackCreditPurchase as metaPurchase 
} from "@/lib/meta-pixel";
import * as ga from "@/lib/google-analytics";
import * as ph from "@/lib/posthog";
import { STRIPE_PRICE_IDS } from "@/lib/stripe";

// Logging utility
function logCredits(message: string, data?: unknown) {
  console.log(`[PAGE: CREDITS] ${message}`, data !== undefined ? data : "");
}

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
  const toastShownRef = useRef(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");
  const toast = useToast();

  useEffect(() => {
    // Prevent showing toast multiple times
    if (toastShownRef.current) return;
    
    logCredits("💳 Credits page loaded");
    
    // Track page view for pricing
    trackViewContent({
      contentName: 'Credits Page',
      contentCategory: 'pricing',
    });
    
    if (success) {
      toastShownRef.current = true;
      logCredits("✅ Payment success detected");
      toast.success("Payment successful! Credits added to your account.");
      
      // Track purchase event (get details from URL if available)
      const packId = searchParams.get("pack_id") || "unknown";
      const packName = searchParams.get("pack_name") || "Credit Pack";
      const price = parseFloat(searchParams.get("amount") || "0");
      const credits = parseInt(searchParams.get("credits") || "0", 10);
      
      if (price > 0) {
        // Track purchase across all analytics platforms
        metaPurchase({ packId, packName, price, credits, orderId: searchParams.get("session_id") || undefined });
        ga.trackCreditPurchase({ packId, packName, price, credits, transactionId: searchParams.get("session_id") || undefined });
        ph.trackCreditPurchase({ packId, packName, price, credits, orderId: searchParams.get("session_id") || undefined });
        logCredits("📊 Purchase tracked (Meta, GA, PostHog)", { packId, price, credits });
      }
    }
    if (canceled) {
      toastShownRef.current = true;
      logCredits("⚠️ Payment canceled detected");
      toast.warning("Payment was canceled.");
    }
  }, [success, canceled, toast, searchParams]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchCredits = useCallback(async () => {
    logCredits("🔍 Fetching credits...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logCredits("❌ No user found");
        return;
      }
      logCredits("👤 User:", user.id);

      // Get credit balance
      const { data: balance } = await supabase.rpc("get_credit_balance", {
        p_user_id: user.id,
      });
      setCredits(balance ?? 0);
      logCredits("💰 Credit balance:", balance);

      // Get subscription status
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .maybeSingle();

      setSubscriptionTier(profile?.subscription_tier ?? null);
      logCredits("📋 Subscription tier:", profile?.subscription_tier);
    } catch (err) {
      logCredits("❌ Error fetching credits:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  async function handlePurchase(packId: string, isSubscription: boolean = false) {
    logCredits("🛒 Purchase initiated:", { packId, isSubscription });
    setPurchasing(packId);

    // Find pack details for tracking
    const pack = CREDIT_PACKS.find(p => p.id === packId);
    if (pack) {
      // Track Add to Cart across all platforms
      metaSelectPack({ packName: `${pack.credits} Credits`, packId: pack.id, price: pack.price, credits: pack.credits });
      ga.trackSelectCreditPack({ packId: pack.id, packName: `${pack.credits} Credits`, price: pack.price, credits: pack.credits });
      ph.trackSelectCreditPack({ packId: pack.id, packName: `${pack.credits} Credits`, price: pack.price, credits: pack.credits });
      
      // Track Initiate Checkout across all platforms
      metaStartCheckout({ packId: pack.id, price: pack.price, credits: pack.credits });
      ga.trackBeginCheckout({ items: [{ itemId: pack.id, itemName: `${pack.credits} Credits`, price: pack.price }], value: pack.price });
      ph.trackBeginCheckout({ products: [{ id: pack.id, name: `${pack.credits} Credits`, price: pack.price }], value: pack.price });
      
      logCredits("📊 AddToCart + Checkout tracked (Meta, GA, PostHog)", { packId, price: pack.price });
    }

    try {
      logCredits("⏳ Creating checkout session...");
      const priceId = STRIPE_PRICE_IDS[packId as keyof typeof STRIPE_PRICE_IDS];
      logCredits("🔑 Price ID for pack:", { packId, priceId });
      
      if (!priceId) {
        logCredits("❌ Invalid pack ID:", packId);
        toast.error("Invalid plan selected");
        return;
      }

      logCredits("📤 Sending checkout request...");
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceId,
          mode: isSubscription ? "subscription" : "payment",
        }),
      });

      logCredits("📥 Response status:", res.status);
      const data = await res.json();
      logCredits("📦 Full response:", JSON.stringify(data));

      if (data.url) {
        logCredits("🔗 Redirecting to Stripe checkout:", data.url);
        window.location.href = data.url;
      } else {
        logCredits("❌ No checkout URL returned. Error:", { error: data.error, details: data.details });
        toast.error(data.error || "Failed to start checkout");
      }
    } catch (err) {
      logCredits("❌ Checkout fetch failed:", err);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setPurchasing(null);
    }
  }

  async function handleManageSubscription() {
    console.log("[Credits] 🔧 Manage Subscription clicked");
    try {
      console.log("[Credits] 📤 Fetching portal URL...");
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      console.log("[Credits] 📥 Response status:", res.status);
      const data = await res.json();
      console.log("[Credits] 📦 Response data:", data);

      if (data.url) {
        console.log("[Credits] ✅ Redirecting to portal:", data.url);
        window.location.href = data.url;
      } else {
        console.log("[Credits] ❌ No URL in response");
      }
    } catch (err) {
      console.error("[Credits] ❌ Portal failed:", err);
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

        {/* Always show Manage Subscription button */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {subscriptionTier ? (
              <>Active subscription: <span className="text-white font-medium capitalize">{subscriptionTier.replace("_", " ")}</span></>
            ) : (
              <>No active subscription</>
            )}
          </div>
          <button
            onClick={handleManageSubscription}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg text-sm font-medium flex items-center gap-2 transition"
          >
            Manage Subscription <ExternalLink className="w-4 h-4" />
          </button>
        </div>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Zap, Crown, Rocket, CreditCard, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

// Monthly subscription plans
const MONTHLY_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 9,
    credits: 10,
    perMonth: true,
    features: [
      "10 credits/month",
      "All platforms supported",
      "Crop mode processing",
      "7-day download links",
      "Email notifications",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    credits: 50,
    perMonth: true,
    popular: true,
    features: [
      "50 credits/month",
      "All platforms supported",
      "Crop + Inpaint modes",
      "30-day download links",
      "Priority processing",
      "Webhook notifications",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 79,
    credits: 200,
    perMonth: true,
    features: [
      "200 credits/month",
      "All platforms supported",
      "All processing modes",
      "90-day download links",
      "Priority processing",
      "API access",
      "Batch processing",
    ],
  },
];

// One-time credit packs
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

export default function PricingPage() {
  const router = useRouter();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    console.log("[PRICING PAGE] 💰 Page mounted");
    // Check if user is logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
    return () => console.log("[PRICING PAGE] 💰 Page unmounted");
  }, [supabase.auth]);

  async function handlePurchase(planId: string, isSubscription: boolean = false) {
    console.log(`[PRICING] 🛒 Purchase: ${planId}, subscription: ${isSubscription}`);
    
    // Check if logged in first
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Redirect to signup with return URL
      router.push(`/signup?redirect=/app/credits&plan=${planId}`);
      return;
    }

    setPurchasing(planId);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: `price_${planId}`,
          mode: isSubscription ? "subscription" : "payment",
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("[PRICING] No checkout URL:", data);
        alert("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      console.error("[PRICING] Checkout error:", err);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">
              B
            </div>
            <span className="text-xl font-bold">BlankLogo</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-gray-400 hover:text-white transition">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Simple, Credit-Based Pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pay only for what you use. 1 credit = 1 video processed. 
            Choose a monthly plan or buy credits as needed.
          </p>
        </div>
      </section>

      {/* Monthly Plans */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Monthly Plans</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {MONTHLY_PLANS.map((plan) => {
              const isPopular = "popular" in plan && plan.popular;
              const TierIcon = TIER_ICONS[plan.id as keyof typeof TIER_ICONS];
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 ${
                    isPopular
                      ? "bg-blue-500/10 border-2 border-blue-500"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <TierIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-sm text-gray-400">{plan.credits} credits/mo</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-gray-400">/mo</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePurchase(plan.id, true)}
                    disabled={purchasing === plan.id}
                    className={`block w-full py-3 rounded-lg font-semibold text-center transition ${
                      isPopular
                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    } disabled:opacity-50`}
                  >
                    {purchasing === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Subscribe"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Top-Up Packs */}
      <section className="py-12 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Top-Up Packs</h2>
          <p className="text-center text-gray-400 mb-8">
            One-time purchases. Credits never expire.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="bg-white/5 border border-white/10 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">{pack.credits} Credits</span>
                </div>

                <div className="text-2xl font-bold mb-1">${pack.price}</div>
                <div className="text-xs text-gray-400 mb-4">
                  ${pack.perCredit.toFixed(2)}/credit
                </div>

                <button
                  onClick={() => handlePurchase(pack.id, false)}
                  disabled={purchasing === pack.id}
                  className="block w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 font-medium transition text-center disabled:opacity-50"
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
      </section>

      {/* FAQ */}
      <section className="py-16 px-6 border-t border-white/10">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <FAQItem
              question="How do credits work?"
              answer="1 credit = 1 video processed for watermark removal. Credits never expire."
            />
            <FAQItem
              question="What platforms are supported?"
              answer="BlankLogo supports Sora, TikTok, Runway, Pika, Kling, Luma, Midjourney, and custom watermark positions."
            />
            <FAQItem
              question="What's the difference between Crop and Inpaint modes?"
              answer="Crop mode is fast and removes watermarks by trimming video edges. Inpaint mode uses AI to intelligently fill in watermark areas, preserving more of your video."
            />
            <FAQItem
              question="How long does processing take?"
              answer="Most videos complete in 15-60 seconds for crop mode, or 2-5 minutes for inpaint mode. You'll get an email when it's ready."
            />
            <FAQItem
              question="Can I get a refund?"
              answer="If a job fails and we can't recover it, credits are automatically refunded to your account."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-blue-500/10 border-t border-blue-500/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Remove Watermarks?</h2>
          <p className="text-gray-400 mb-8">
            Start removing watermarks from your AI-generated videos in seconds.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-lg transition"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          © 2026 BlankLogo. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-gray-400">{answer}</p>
    </div>
  );
}

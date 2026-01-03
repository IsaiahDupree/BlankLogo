import Link from "next/link";
import { Check, Zap, Crown, Rocket, Gift } from "lucide-react";

const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    credits: 5,
    features: [
      "5 video credits",
      "All platforms supported",
      "Crop mode processing",
      "3-day download links",
      "No credit card required",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 5,
    credits: 15,
    features: [
      "15 video credits",
      "All platforms supported",
      "Crop mode processing",
      "7-day download links",
      "Email notifications",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    credits: 60,
    popular: true,
    features: [
      "60 video credits",
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
    price: 49,
    credits: 200,
    features: [
      "200 video credits",
      "All platforms supported",
      "All processing modes",
      "90-day download links",
      "Priority processing",
      "API access",
      "Batch processing",
    ],
  },
];

const TIER_ICONS = {
  free: Gift,
  starter: Zap,
  pro: Crown,
  business: Rocket,
} as const;

export default function PricingPage() {
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
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Simple, Credit-Based Pricing
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Pay only for what you use. 1 credit = 1 video processed. 
            No subscriptions, no surprises.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRICING_TIERS.map((tier) => {
            const isPopular = "popular" in tier && tier.popular;
            const TierIcon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS];
            return (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 ${
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

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                  <TierIcon className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    {tier.price === 0 ? "Free" : `$${tier.price}`}
                  </span>
                  <span className="text-gray-400">/ {tier.credits} credits</span>
                </div>
                {tier.price > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    ${(tier.price / tier.credits).toFixed(2)} per credit
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full py-3 rounded-lg font-semibold text-center transition ${
                  isPopular
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : tier.price === 0
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                {tier.price === 0 ? "Start Free" : "Get Started"}
              </Link>
            </div>
          );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 border-t border-white/10">
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
      <section className="py-20 px-6 bg-blue-500/10 border-t border-blue-500/20">
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

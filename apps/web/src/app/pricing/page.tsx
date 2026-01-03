import Link from "next/link";
import { Check, Zap, Crown, Rocket, Plus } from "lucide-react";
import { PRICING_TIERS, CREDIT_PACKS } from "@canvascast/shared";

const TIER_ICONS = {
  starter: Zap,
  pro: Crown,
  creator_plus: Rocket,
} as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/logo-icon.png" alt="CanvasCast" className="w-8 h-8" />
            <span className="text-xl font-bold">CanvasCast</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-gray-400 hover:text-white transition">
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-medium transition"
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
            Pay only for what you use. 1 credit = 1 minute of video. 
            No subscriptions, no surprises.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {PRICING_TIERS.map((tier) => {
            const isPopular = "popular" in tier && tier.popular;
            const TierIcon = TIER_ICONS[tier.id as keyof typeof TIER_ICONS];
            return (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-8 ${
                isPopular
                  ? "bg-brand-500/10 border-2 border-brand-500"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-brand-500 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4">
                  <TierIcon className="w-6 h-6 text-brand-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-gray-400">/ {tier.credits} credits</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full py-3 rounded-lg font-semibold text-center transition ${
                  isPopular
                    ? "bg-brand-600 hover:bg-brand-500 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                Get Started
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
              answer="1 credit = 1 minute of generated video. A 10-minute video uses 10 credits. Credits never expire."
            />
            <FAQItem
              question="What's included in the output?"
              answer="Every project includes: final.mp4 (1080p), captions.srt, script.txt, timeline.json, and an assets.zip with all source files."
            />
            <FAQItem
              question="Can I use my own voice?"
              answer="Yes! With voice cloning, you can upload a 5-30 second voice sample and we'll generate narration in your voice using IndexTTS-2."
            />
            <FAQItem
              question="How long does generation take?"
              answer="Most videos complete in 5-15 minutes depending on length and queue. You'll get an email when it's ready."
            />
            <FAQItem
              question="Can I get a refund?"
              answer="If a job fails and we can't recover it, credits are automatically refunded to your account."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-brand-500/10 border-t border-brand-500/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Create?</h2>
          <p className="text-gray-400 mb-8">
            Start generating YouTube-ready videos in minutes.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-brand-600 hover:bg-brand-500 rounded-lg font-semibold text-lg transition"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
          © 2026 CanvasCast. All rights reserved.
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

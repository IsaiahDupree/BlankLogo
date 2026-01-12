"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle, Eye, EyeOff, Gift, Sparkles, Zap } from "lucide-react";
import { trackCompleteRegistration, trackViewContent, trackLead } from "@/lib/meta-pixel";
import { auth, error as phError } from "@/lib/posthog-events";
import confetti from "canvas-confetti";

export default function PromoPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const utmSource = searchParams.get("utm_source") || "direct";
  const utmCampaign = searchParams.get("utm_campaign") || "blanklogo_10credits";

  useEffect(() => {
    // Fire confetti on page load
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#6366f1", "#8b5cf6", "#a855f7", "#22c55e", "#fbbf24"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#6366f1", "#8b5cf6", "#a855f7", "#22c55e", "#fbbf24"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Initialize promo token via API (sets cookie for later redemption)
    const initPromo = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        await fetch(`/api/promo/init?${params.toString()}`);
        console.log("[Promo] Token initialized");
      } catch (e) {
        console.error("[Promo] Failed to init token:", e);
      }
    };
    initPromo();

    // Track promo page view
    trackViewContent({ contentName: "Promo Landing - 10 Free Credits", contentCategory: "promo" });
    trackLead({ contentName: "10 Credits Promo", value: 10 });

    // Store promo info in session
    sessionStorage.setItem("bl_promo_campaign", utmCampaign);
    sessionStorage.setItem("bl_promo_source", utmSource);
  }, [utmCampaign, utmSource]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?promo=1&campaign=${utmCampaign}`,
        data: {
          promo_campaign: utmCampaign,
          promo_source: utmSource,
        },
      },
    });

    if (error) {
      setError(error.message);
      phError.ui({ error_code: "E_AUTH_FAILED", route: "/promo", message: error.message });
      setLoading(false);
      return;
    }

    if (data.user?.id) {
      auth.signedIn({ user_id: data.user.id, method: "email", is_new_user: true, email: data.user.email });
    }

    trackCompleteRegistration({ contentName: "BlankLogo Account (Promo)", status: "pending_confirmation", value: 10 });

    // Big confetti burst on success
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#6366f1", "#fbbf24"],
    });

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-bounce">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4">You&apos;re Almost There!</h1>
          <p className="text-gray-400 mb-6">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
          </p>
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-6">
            <div className="flex items-center justify-center gap-2 text-indigo-300 mb-2">
              <Gift className="w-5 h-5" />
              <span className="font-semibold">Your 10 FREE credits are waiting!</span>
            </div>
            <p className="text-sm text-gray-400">
              Click the link in your email to activate your account and claim your credits.
            </p>
          </div>
          <p className="text-gray-500 text-sm">
            Check your spam folder if you don&apos;t see the email within a few minutes.
          </p>
        </div>
      </main>
    );
  }

  if (!showForm) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6 overflow-hidden">
        <div className="w-full max-w-lg text-center relative">
          {/* Animated background elements */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

          {/* Gift icon with glow */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-2xl opacity-50 animate-pulse" />
            </div>
            <div className="relative w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-bounce">
              <Gift className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Congratulations message */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 text-green-400 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              EXCLUSIVE OFFER
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
              Congratulations!
            </h1>

            <p className="text-xl text-gray-300 mb-2">You&apos;ve unlocked</p>

            <div className="text-6xl sm:text-7xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              20 FREE
            </div>

            <p className="text-2xl text-white font-semibold mb-2">Credits</p>
            
            <p className="text-sm text-green-400 mb-6">
              10 welcome credits + 10 bonus credits from this offer!
            </p>

            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Remove AI watermarks from your Sora, Runway, Pika, and Kling videos - completely free. No credit card required.
            </p>

            {/* Value proposition */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">Instant</p>
                <p className="text-xs text-gray-500">Processing</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Sparkles className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">AI-Powered</p>
                <p className="text-xs text-gray-500">Inpainting</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">No Watermark</p>
                <p className="text-xs text-gray-500">On Output</p>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-bold text-lg shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 mx-auto group"
            >
              <Gift className="w-5 h-5 group-hover:animate-bounce" />
              Claim Your 20 Free Credits
            </button>

            <p className="text-gray-500 text-sm mt-4">
              Limited time offer - Sign up now!
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Signup form
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Promo banner */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-center">
          <div className="flex items-center justify-center gap-2 text-indigo-300 mb-1">
            <Gift className="w-5 h-5" />
            <span className="font-bold text-lg">20 FREE Credits Included!</span>
          </div>
          <p className="text-sm text-gray-400">10 welcome + 10 bonus credits</p>
        </div>

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold">B</span>
            </div>
            <span className="text-2xl font-bold">BlankLogo</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-gray-400">Sign up to get your 10 free credits</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <Gift className="w-5 h-5" />
                Create Account & Get 20 Credits
              </>
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>

        <button
          onClick={() => setShowForm(false)}
          className="w-full mt-4 text-gray-500 hover:text-gray-400 text-sm"
        >
          ← Back to offer details
        </button>
      </div>
    </main>
  );
}

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

  async function handleGoogleSignup() {
    console.log("[PROMO] 🔵 Google sign-up clicked");
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?promo=1&campaign=${utmCampaign}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error("[PROMO] ❌ Google signup failed:", error.message);
      setError(error.message);
      setLoading(false);
    }
  }

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
        <div className="w-full max-w-lg text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Account Created!</h1>
          <p className="text-xl text-indigo-400 font-semibold mb-6">
            Just 3 quick steps to get your free credits
          </p>

          {/* Step-by-step instructions */}
          <div className="text-left space-y-4 mb-8">
            <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div>
                <p className="font-semibold text-white">Check Your Email</p>
                <p className="text-sm text-gray-400">
                  We sent a confirmation link to <strong className="text-indigo-300">{email}</strong>
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div>
                <p className="font-semibold text-white">Click the Confirmation Link</p>
                <p className="text-sm text-gray-400">
                  This verifies your email and activates your account
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div>
                <p className="font-semibold text-white">Sign In & Start Removing Watermarks</p>
                <p className="text-sm text-gray-400">
                  Your <strong className="text-green-400">20 free credits</strong> will be ready to use immediately
                </p>
              </div>
            </div>
          </div>

          {/* Credits waiting banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-6">
            <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
              <Gift className="w-5 h-5" />
              <span className="font-bold text-lg">20 Credits = 20 Watermark Removals</span>
            </div>
            <p className="text-sm text-gray-300">
              Remove watermarks from Sora, Runway, Pika, Kling, TikTok & more
            </p>
          </div>

          <p className="text-gray-500 text-sm mb-4">
            💡 <strong>Tip:</strong> Check your spam/promotions folder if you don&apos;t see the email
          </p>

          <Link 
            href="/login"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Already confirmed? Sign in here →
          </Link>
        </div>
      </main>
    );
  }

  if (!showForm) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6 overflow-hidden">
        <div className="w-full max-w-2xl text-center relative">
          {/* Animated background elements */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

          {/* Problem-aware headline */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 text-red-400 text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Tired of AI watermarks ruining your videos?
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent leading-tight">
              Remove AI Watermarks<br />
              <span className="text-3xl sm:text-4xl">in Under 60 Seconds</span>
            </h1>

            <p className="text-lg text-gray-300 mb-6 max-w-xl mx-auto">
              Stop cropping, blurring, or re-generating. Our AI automatically removes watermarks from <strong className="text-white">Sora, Runway, Pika, Kling, TikTok</strong> and more — with professional-quality results.
            </p>

            {/* Gift banner */}
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-30 animate-pulse" />
              </div>
              <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-indigo-500/30">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Gift className="w-8 h-8 text-yellow-400" />
                  <span className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    20 FREE Credits
                  </span>
                </div>
                <p className="text-indigo-200">
                  That&apos;s 20 watermark removals — completely free, no credit card required
                </p>
              </div>
            </div>

            {/* How it works - 3 steps preview */}
            <div className="mb-8">
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-4">How to get your free credits</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Sign up free</span>
                </div>
                <span className="hidden sm:block text-gray-600">→</span>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Confirm email</span>
                </div>
                <span className="hidden sm:block text-gray-600">→</span>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Start removing!</span>
                </div>
              </div>
            </div>

            {/* Value proposition */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Zap className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">60 Seconds</p>
                <p className="text-xs text-gray-500">Processing</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <Sparkles className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">AI Inpainting</p>
                <p className="text-xs text-gray-500">Seamless Results</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-300">Clean Output</p>
                <p className="text-xs text-gray-500">No New Watermarks</p>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-bold text-lg shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 mx-auto group"
            >
              <Gift className="w-5 h-5 group-hover:animate-bounce" />
              Get My 20 Free Credits
            </button>

            <p className="text-gray-500 text-sm mt-4">
              ✓ No credit card required &nbsp;•&nbsp; ✓ Cancel anytime &nbsp;•&nbsp; ✓ Instant access
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
          <p className="text-gray-400">Sign up to get your 20 free credits</p>
        </div>

        {/* Google Sign-Up Button */}
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full py-3 px-4 mb-4 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-3 text-gray-800"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900 text-gray-500">or</span>
          </div>
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

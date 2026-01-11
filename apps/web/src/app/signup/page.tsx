"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { trackCompleteRegistration } from "@/lib/meta-pixel";
import { trackSignUp, trackError } from "@/lib/posthog";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    console.log("[SIGNUP PAGE] 📝 Page mounted");
    console.log("[SIGNUP PAGE] Supabase client initialized");
    return () => console.log("[SIGNUP PAGE] 📝 Page unmounted");
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    console.log("[SIGNUP] 🚀 Signup form submitted");
    console.log("[SIGNUP] Email:", email);
    console.log("[SIGNUP] Password length:", password.length);
    
    setLoading(true);
    setError(null);

    console.log("[SIGNUP] ⏳ Calling Supabase signUp...");
    const startTime = Date.now();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    const duration = Date.now() - startTime;
    console.log("[SIGNUP] ⏱️ Signup request took:", duration, "ms");

    if (error) {
      console.error("[SIGNUP] ❌ Signup failed:", error.message);
      console.error("[SIGNUP] Error details:", error);
      setError(error.message);
      trackError({ errorType: 'signup_failed', errorMessage: error.message, page: '/signup' });
      setLoading(false);
      return;
    }

    console.log("[SIGNUP] ✅ Signup successful!");
    console.log("[SIGNUP] User ID:", data.user?.id);
    console.log("[SIGNUP] User email:", data.user?.email);
    console.log("[SIGNUP] 📧 Confirmation email sent");
    
    // Track signup for PostHog
    if (data.user?.id) {
      trackSignUp({ userId: data.user.id, method: 'email', email: data.user.email });
    }
    
    // Track CompleteRegistration for Meta Pixel
    trackCompleteRegistration({ contentName: 'BlankLogo Account', status: 'pending_confirmation' });
    
    setSuccess(true);
    setLoading(false);
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[SIGNUP] 📝 Email input changed");
    setEmail(e.target.value);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[SIGNUP] 📝 Password input changed, length:", e.target.value.length);
    setPassword(e.target.value);
  }

  function handleTogglePassword() {
    console.log("[SIGNUP] 👁️ Password visibility toggled:", !showPassword ? "visible" : "hidden");
    setShowPassword(!showPassword);
  }

  function handleLinkClick(linkName: string) {
    console.log(`[SIGNUP] 🔗 ${linkName} link clicked`);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Check your email</h1>
          <p className="text-gray-400 mb-6">
            We sent a confirmation link to <strong className="text-white">{email}</strong>.
            Click the link to activate your account.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            The link is valid for 24 hours. Check your spam folder if you don&apos;t see it.
            <br />
            <span className="text-gray-600">Note: You can only request a new link once per minute.</span>
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-semibold"
          >
            Back to Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold">B</span>
            </div>
            <span className="text-2xl font-bold">BlankLogo</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Create your account</h1>
          <p className="text-gray-400">Start removing watermarks in minutes</p>
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
              onChange={handleEmailChange}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition"
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
                onChange={handlePasswordChange}
                required
                minLength={6}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={handleTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

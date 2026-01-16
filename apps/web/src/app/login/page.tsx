"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { auth, error as phError } from "@/lib/posthog-events";
import { trackViewContent } from "@/lib/meta-pixel";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Page load logging
  useEffect(() => {
    console.log("[LOGIN PAGE] 🔐 Page mounted");
    console.log("[LOGIN PAGE] Supabase client initialized");
    // Track login page view for Meta Pixel
    trackViewContent({ contentName: 'Login Page', contentCategory: 'auth' });
    
    // Capture UTM parameters and referrer for attribution tracking (for users coming from campaigns)
    const params = new URLSearchParams(window.location.search);
    const attribution = {
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_content: params.get('utm_content') || undefined,
      utm_term: params.get('utm_term') || undefined,
      referrer: document.referrer || undefined,
      landing_page: window.location.pathname,
      timestamp: new Date().toISOString(),
    };
    // Store attribution data for potential use
    localStorage.setItem('bl_signup_attribution', JSON.stringify(attribution));
    document.cookie = `bl_signup_attribution=${encodeURIComponent(JSON.stringify(attribution))}; path=/; max-age=3600; SameSite=Lax`;
    
    return () => {
      console.log("[LOGIN PAGE] 🔐 Page unmounted");
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    console.log("[LOGIN] 🚀 Login form submitted");
    console.log("[LOGIN] Email:", email);
    console.log("[LOGIN] Password length:", password.length);
    
    setLoading(true);
    setError(null);

    console.log("[LOGIN] ⏳ Calling Supabase signInWithPassword...");
    const startTime = Date.now();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const duration = Date.now() - startTime;
    console.log("[LOGIN] ⏱️ Auth request took:", duration, "ms");

    if (error) {
      console.error("[LOGIN] ❌ Login failed:", error.message);
      console.error("[LOGIN] Error details:", error);
      setError(error.message);
      phError.ui({ error_code: 'E_AUTH_FAILED', route: '/login', message: error.message });
      setLoading(false);
      return;
    }

    console.log("[LOGIN] ✅ Login successful!");
    console.log("[LOGIN] User ID:", data.user?.id);
    console.log("[LOGIN] User email:", data.user?.email);
    console.log("[LOGIN] Session expires:", data.session?.expires_at);
    console.log("[LOGIN] 🔄 Redirecting to /app...");
    
    // Track successful login
    if (data.user?.id) {
      auth.signedIn({ user_id: data.user.id, method: 'email', is_new_user: false, email: data.user.email });
    }
    
    router.push("/app");
    router.refresh();
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[LOGIN] 📝 Email input changed");
    setEmail(e.target.value);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[LOGIN] 📝 Password input changed, length:", e.target.value.length);
    setPassword(e.target.value);
  }

  function handleTogglePassword() {
    console.log("[LOGIN] 👁️ Password visibility toggled:", !showPassword ? "visible" : "hidden");
    setShowPassword(!showPassword);
  }

  function handleForgotPasswordClick() {
    console.log("[LOGIN] 🔗 Forgot password link clicked");
  }

  function handleSignupClick() {
    console.log("[LOGIN] 🔗 Sign up link clicked");
  }

  function handleLogoClick() {
    console.log("[LOGIN] 🔗 Logo clicked, navigating to home");
  }

  async function handleGoogleLogin() {
    console.log("[LOGIN] 🔵 Google sign-in clicked");
    console.log("[LOGIN] 🔵 Window origin:", window.location.origin);
    console.log("[LOGIN] 🔵 Redirect URL will be:", `${window.location.origin}/auth/callback`);
    console.log("[LOGIN] 🔵 Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    setLoading(true);
    setError(null);

    try {
      console.log("[LOGIN] 🔵 Calling supabase.auth.signInWithOAuth...");
      const startTime = Date.now();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      const duration = Date.now() - startTime;
      console.log("[LOGIN] 🔵 OAuth request took:", duration, "ms");
      console.log("[LOGIN] 🔵 OAuth response data:", data);
      console.log("[LOGIN] 🔵 OAuth provider:", data?.provider);
      console.log("[LOGIN] 🔵 OAuth URL:", data?.url);

      if (error) {
        console.error("[LOGIN] ❌ Google OAuth error:", error.message);
        console.error("[LOGIN] ❌ Error name:", error.name);
        console.error("[LOGIN] ❌ Error status:", (error as any).status);
        console.error("[LOGIN] ❌ Full error:", JSON.stringify(error, null, 2));
        setError(error.message);
        phError.ui({ error_code: 'E_AUTH_FAILED', route: '/login', message: error.message });
        setLoading(false);
        return;
      }

      if (data?.url) {
        console.log("[LOGIN] 🔵 Redirecting to Google OAuth URL...");
        // The SDK should auto-redirect, but log it
      } else {
        console.warn("[LOGIN] ⚠️ No OAuth URL returned - this may indicate a configuration issue");
        setError("Failed to initiate Google sign-in. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("[LOGIN] ❌ Google login exception:", err);
      console.error("[LOGIN] ❌ Exception type:", typeof err);
      console.error("[LOGIN] ❌ Exception message:", (err as Error).message);
      setError("An unexpected error occurred. Please try again.");
      phError.ui({ error_code: 'E_AUTH_FAILED', route: '/login', message: (err as Error).message });
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" onClick={handleLogoClick} className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold">B</span>
            </div>
            <span className="text-2xl font-bold">BlankLogo</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-gray-400">Sign in to remove watermarks</p>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 px-4 mb-6 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-3 text-gray-800"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gray-900 text-gray-500">or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" onClick={handleForgotPasswordClick} className="text-sm text-gray-400 hover:text-white">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" onClick={handleSignupClick} className="text-indigo-400 hover:text-indigo-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

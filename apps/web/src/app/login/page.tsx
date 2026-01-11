"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { auth, error as phError } from "@/lib/posthog-events";

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

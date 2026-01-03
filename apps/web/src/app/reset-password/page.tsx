"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    console.log("[RESET PASSWORD PAGE] 🔐 Page mounted");
    console.log("[RESET PASSWORD PAGE] URL:", window.location.href);
    return () => console.log("[RESET PASSWORD PAGE] 🔐 Page unmounted");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[RESET PASSWORD] 🚀 Form submitted");
    console.log("[RESET PASSWORD] Password length:", password.length);
    console.log("[RESET PASSWORD] Confirm password length:", confirmPassword.length);
    
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      console.error("[RESET PASSWORD] ❌ Passwords do not match");
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      console.error("[RESET PASSWORD] ❌ Password too short");
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    console.log("[RESET PASSWORD] ⏳ Sending reset request...");
    const startTime = Date.now();

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const duration = Date.now() - startTime;
      console.log("[RESET PASSWORD] ⏱️ Request took:", duration, "ms");

      const data = await res.json();
      console.log("[RESET PASSWORD] Response status:", res.status);

      if (!res.ok) {
        console.error("[RESET PASSWORD] ❌ Error:", data.error);
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      console.log("[RESET PASSWORD] ✅ Password reset successful!");
      console.log("[RESET PASSWORD] 🔄 Redirecting to login in 3s...");
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error("[RESET PASSWORD] ❌ Network error:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[RESET PASSWORD] 📝 Password input changed, length:", e.target.value.length);
    setPassword(e.target.value);
  }

  function handleConfirmPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log("[RESET PASSWORD] 📝 Confirm password input changed, length:", e.target.value.length);
    setConfirmPassword(e.target.value);
  }

  function handleTogglePassword() {
    console.log("[RESET PASSWORD] 👁️ Password visibility toggled:", !showPassword ? "visible" : "hidden");
    setShowPassword(!showPassword);
  }

  function handleToggleConfirmPassword() {
    console.log("[RESET PASSWORD] 👁️ Confirm password visibility toggled:", !showConfirmPassword ? "visible" : "hidden");
    setShowConfirmPassword(!showConfirmPassword);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Password reset!</h1>
          <p className="text-gray-400 mb-8">
            Your password has been successfully reset. Redirecting to login...
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300"
          >
            Go to login
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
          <h1 className="text-3xl font-bold mb-2">Set new password</h1>
          <p className="text-gray-400">Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                required
                minLength={8}
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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                required
                minLength={8}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={handleToggleConfirmPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}

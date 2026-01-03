"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

// Logging utility
function logNewProject(message: string, data?: unknown) {
  console.log(`[PAGE: NEW PROJECT] ${message}`, data !== undefined ? data : "");
}

const NICHE_PRESETS = [
  { id: "motivation", label: "Motivation", emoji: "💪" },
  { id: "explainer", label: "Explainer", emoji: "📚" },
  { id: "facts", label: "Facts & Trivia", emoji: "🧠" },
  { id: "documentary", label: "Documentary", emoji: "🎬" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "tech", label: "Tech", emoji: "⚡" },
];

const LENGTH_OPTIONS = [
  { value: 5, label: "5 min" },
  { value: 8, label: "8 min" },
  { value: 10, label: "10 min" },
  { value: 12, label: "12 min" },
];

export default function NewProjectPage() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [length, setLength] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    logNewProject("🆕 New project page loaded");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    logNewProject("📝 Form submitted", { title, niche, length });
    e.preventDefault();
    if (!title || !niche) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      logNewProject("⏳ Creating project...");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          niche_preset: niche,
          target_minutes: length,
        }),
      });

      const data = await res.json();
      logNewProject("📦 API response:", { status: res.status, data });

      if (!res.ok) {
        logNewProject("❌ Project creation failed:", data.error);
        throw new Error(data.error || "Failed to create project");
      }

      logNewProject("✅ Project created:", data.project?.id);
      router.push(`/app/projects/${data.project.id}`);
    } catch (err: unknown) {
      logNewProject("❌ Error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
        <p className="text-gray-400">
          Set up your video project and we&apos;ll generate everything for you
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Video Title <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Why Most People Fail at Starting YouTube"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition"
          />
        </div>

        {/* Niche Preset */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Choose Your Niche <span className="text-red-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {NICHE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setNiche(preset.id)}
                className={`p-4 rounded-lg border text-left transition ${
                  niche === preset.id
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                <span className="text-2xl mb-2 block">{preset.emoji}</span>
                <span className="font-medium">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="block text-sm font-medium mb-3">Video Length</label>
          <div className="flex gap-3">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLength(opt.value)}
                className={`px-6 py-3 rounded-lg border font-medium transition ${
                  length === opt.value
                    ? "bg-brand-500/20 border-brand-500 text-white"
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This will cost approximately {length} credits
          </p>
        </div>

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !title || !niche}
            className="w-full py-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Create Project
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

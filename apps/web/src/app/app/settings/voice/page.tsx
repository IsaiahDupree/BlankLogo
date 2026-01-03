"use client";

import { useState, useEffect, useCallback } from "react";
import { Mic, Trash2, Upload, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";

type VoiceProfile = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function VoiceSettingsPage() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/voice-profiles");
      const data = await res.json();
      if (res.ok) {
        setProfiles(data.profiles ?? []);
      }
    } catch {
      setError("Failed to load voice profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/voice-profiles", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setProfiles((prev) => [data.profile, ...prev]);
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(profileId: string) {
    if (!confirm("Delete this voice profile?")) return;

    try {
      const res = await fetch(`/api/voice-profiles?id=${profileId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      }
    } catch {
      setError("Failed to delete profile");
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Voice Cloning</h1>
        <p className="text-gray-400">
          Upload a voice sample to clone your voice for video narrations
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload Voice Sample
        </h2>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Profile Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="My Voice"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 outline-none"
            />
          </div>

          <div>
            <label htmlFor="voice_file" className="block text-sm font-medium mb-2">
              Voice Recording (WAV or MP3)
            </label>
            <input
              id="voice_file"
              name="voice_file"
              type="file"
              required
              accept="audio/*"
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-600 file:text-white file:cursor-pointer"
            />
            <p className="text-xs text-gray-500 mt-1">
              5-30 seconds of natural speech, clear audio, no background noise
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition font-semibold flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Upload Voice Sample
              </>
            )}
          </button>
        </form>
      </div>

      {/* Voice Profiles List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Voice Profiles</h2>

        {profiles.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No voice profiles yet</p>
            <p className="text-sm">Upload a voice sample to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="font-medium">{profile.name}</div>
                    <div className="text-sm text-gray-400">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={profile.status} />
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
        <h3 className="font-semibold text-brand-400 mb-2">Recording Tips</h3>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Use a quiet room with no background noise</li>
          <li>• Speak naturally at a consistent distance from the mic</li>
          <li>• Include varied intonation (questions, statements)</li>
          <li>• 5-30 seconds is optimal for best results</li>
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/20" },
    approved: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20" },
    rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/20" },
  }[status] ?? { icon: Clock, color: "text-gray-400", bg: "bg-gray-500/20" };

  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

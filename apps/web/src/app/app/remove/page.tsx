"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link as LinkIcon, Loader2, Sparkles, Video, X, CheckCircle } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/components/toast";

// Logging utility
function logRemove(message: string, data?: unknown) {
  console.log(`[PAGE: REMOVE] ${message}`, data !== undefined ? data : "");
}

const PLATFORMS = [
  { id: "sora", name: "Sora", cropPixels: 100, color: "from-purple-500 to-pink-500" },
  { id: "tiktok", name: "TikTok", cropPixels: 80, color: "from-cyan-500 to-blue-500" },
  { id: "runway", name: "Runway", cropPixels: 60, color: "from-green-500 to-emerald-500" },
  { id: "pika", name: "Pika", cropPixels: 50, color: "from-orange-500 to-red-500" },
  { id: "kling", name: "Kling", cropPixels: 70, color: "from-blue-500 to-indigo-500" },
  { id: "luma", name: "Luma", cropPixels: 55, color: "from-yellow-500 to-orange-500" },
  { id: "custom", name: "Custom", cropPixels: 0, color: "from-gray-500 to-gray-600" },
];

export default function RemoveWatermarkPage() {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState("sora");
  const [customCrop, setCustomCrop] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    logRemove("✨ Remove watermark page loaded");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logRemove("📁 File selected:", { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      logRemove("📁 File dropped:", { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logRemove("🚀 Submitting job...", { mode, platform, videoUrl: videoUrl?.slice(0, 50) });
    
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logRemove("❌ No session found");
        setError("Please log in to remove watermarks");
        setLoading(false);
        return;
      }

      const selectedPlatform = PLATFORMS.find(p => p.id === platform);
      const cropPixels = platform === "custom" ? customCrop : selectedPlatform?.cropPixels || 100;

      logRemove("⏳ Creating job...", { platform, cropPixels });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8989";
      
      if (mode === "url") {
        const res = await fetch(`${apiUrl}/api/v1/jobs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            video_url: videoUrl,
            platform,
            crop_pixels: cropPixels,
          }),
        });

        const data = await res.json();
        logRemove("📦 API response:", { status: res.status, jobId: data.jobId });

        if (!res.ok) {
          throw new Error(data.error || "Failed to create job");
        }

        setJobId(data.jobId);
        setSuccess(true);
        logRemove("✅ Job created successfully:", data.jobId);
      } else if (mode === "upload" && selectedFile) {
        const formData = new FormData();
        formData.append("video", selectedFile);
        formData.append("platform", platform);
        formData.append("crop_pixels", String(cropPixels));

        const res = await fetch(`${apiUrl}/api/v1/jobs/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await res.json();
        logRemove("📦 Upload response:", { status: res.status, jobId: data.jobId });

        if (!res.ok) {
          throw new Error(data.error || "Failed to upload video");
        }

        setJobId(data.jobId);
        setSuccess(true);
        logRemove("✅ Upload successful:", data.jobId);
      }
    } catch (err) {
      logRemove("❌ Error:", err);
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success && jobId) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-center py-16 px-6 rounded-2xl bg-green-500/10 border border-green-500/20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-green-400">Job Created!</h2>
          <p className="text-gray-400 mb-6">
            Your watermark removal job has been queued. We&apos;ll process it shortly.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/app/jobs")}
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
            >
              View Jobs
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setJobId(null);
                setVideoUrl("");
                setSelectedFile(null);
              }}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-medium"
            >
              Remove Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-400" />
          Remove Watermark
        </h1>
        <p className="text-gray-400">Upload a video or paste a URL to remove watermarks</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Mode Selection */}
        <div className="flex gap-2 p-1 rounded-lg bg-white/5">
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition ${
              mode === "url" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <LinkIcon className="w-4 h-4 inline mr-2" />
            Paste URL
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition ${
              mode === "upload" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload File
          </button>
        </div>

        {/* URL Input */}
        {mode === "url" && (
          <div>
            <label className="block text-sm font-medium mb-2">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              required={mode === "url"}
            />
          </div>
        )}

        {/* File Upload */}
        {mode === "upload" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-indigo-500/50 transition cursor-pointer"
          >
            <input
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload"
            />
            <label htmlFor="video-upload" className="cursor-pointer">
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <Video className="w-8 h-8 text-indigo-400" />
                  <div className="text-left">
                    <div className="font-medium">{selectedFile.name}</div>
                    <div className="text-sm text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedFile(null);
                    }}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <div className="font-medium mb-1">Drop your video here</div>
                  <div className="text-sm text-gray-400">or click to browse</div>
                  <div className="text-xs text-gray-500 mt-2">MP4, MOV, WebM up to 500MB</div>
                </>
              )}
            </label>
          </div>
        )}

        {/* Platform Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">Select Platform</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`p-3 rounded-lg border text-center transition ${
                  platform === p.id
                    ? `bg-gradient-to-r ${p.color} border-transparent text-white`
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                {p.id !== "custom" && (
                  <div className="text-xs opacity-75">{p.cropPixels}px crop</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Crop */}
        {platform === "custom" && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Custom Crop (pixels): {customCrop}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={customCrop}
              onChange={(e) => setCustomCrop(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10px</span>
              <span>200px</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || (mode === "url" && !videoUrl) || (mode === "upload" && !selectedFile)}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Remove Watermark
            </>
          )}
        </button>
      </form>
    </div>
  );
}

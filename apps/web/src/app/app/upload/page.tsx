"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link as LinkIcon, Loader2, Sparkles, Video, X, CheckCircle, ArrowRight } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/components/toast";

// Logging utility
function logUpload(message: string, data?: unknown) {
  console.log(`[PAGE: UPLOAD] ${message}`, data !== undefined ? data : "");
}

const PLATFORMS = [
  { id: "sora", name: "Sora", cropPixels: 100, color: "from-purple-500 to-pink-500", description: "OpenAI's video model" },
  { id: "tiktok", name: "TikTok", cropPixels: 80, color: "from-cyan-500 to-blue-500", description: "TikTok watermarks" },
  { id: "runway", name: "Runway", cropPixels: 60, color: "from-green-500 to-emerald-500", description: "Runway Gen-2/3" },
  { id: "pika", name: "Pika", cropPixels: 50, color: "from-orange-500 to-red-500", description: "Pika Labs" },
  { id: "kling", name: "Kling", cropPixels: 70, color: "from-blue-500 to-indigo-500", description: "Kling AI" },
  { id: "luma", name: "Luma", cropPixels: 55, color: "from-yellow-500 to-orange-500", description: "Luma Dream Machine" },
  { id: "instagram", name: "Instagram", cropPixels: 0, color: "from-pink-500 to-purple-600", description: "Meta Reels watermarks" },
  { id: "facebook", name: "Facebook", cropPixels: 0, color: "from-blue-600 to-blue-800", description: "Meta video watermarks" },
  { id: "custom", name: "Custom", cropPixels: 0, color: "from-gray-500 to-gray-600", description: "Set custom crop" },
];

export default function UploadPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState("sora");
  const [customCrop, setCustomCrop] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    logUpload("📤 Upload page loaded");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      logUpload("📁 File selected:", { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
      setStep(2);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      logUpload("📁 File dropped:", { name: file.name, size: file.size, type: file.type });
      setSelectedFile(file);
      setError(null);
      setStep(2);
    } else {
      toast.error("Please drop a video file");
    }
  };

  const handleUrlSubmit = () => {
    if (videoUrl) {
      logUpload("🔗 URL submitted:", videoUrl.slice(0, 50));
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    logUpload("🚀 Submitting job...", { mode, platform });
    
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logUpload("❌ No session found");
        toast.error("Please log in to remove watermarks");
        router.push("/login");
        return;
      }

      const selectedPlatform = PLATFORMS.find(p => p.id === platform);
      const cropPixels = platform === "custom" ? customCrop : selectedPlatform?.cropPixels || 100;

      logUpload("⏳ Creating job...", { platform, cropPixels });

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
        logUpload("📦 API response:", { status: res.status, jobId: data.jobId });

        if (!res.ok) {
          throw new Error(data.error || "Failed to create job");
        }

        setJobId(data.jobId);
        setSuccess(true);
        toast.success("Job created successfully!");
        logUpload("✅ Job created:", data.jobId);
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
        logUpload("📦 Upload response:", { status: res.status, jobId: data.jobId });

        if (!res.ok) {
          throw new Error(data.error || "Failed to upload video");
        }

        setJobId(data.jobId);
        setSuccess(true);
        toast.success("Video uploaded successfully!");
        logUpload("✅ Upload successful:", data.jobId);
      }
    } catch (err) {
      logUpload("❌ Error:", err);
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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-green-400">Job Created!</h2>
          <p className="text-gray-400 mb-8">
            Your watermark removal job has been queued and will be processed shortly.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/app/jobs")}
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium flex items-center gap-2"
            >
              View Jobs
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setJobId(null);
                setVideoUrl("");
                setSelectedFile(null);
                setStep(1);
              }}
              className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition font-medium"
            >
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-400" />
          Upload Video
        </h1>
        <p className="text-gray-400">Remove watermarks from AI-generated videos</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step >= s
                  ? "bg-indigo-600 text-white"
                  : "bg-white/10 text-gray-500"
              }`}
            >
              {s}
            </div>
            <span className={step >= s ? "text-white" : "text-gray-500"}>
              {s === 1 ? "Upload" : s === 2 ? "Platform" : "Confirm"}
            </span>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-indigo-600" : "bg-white/10"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2 mb-6">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="flex gap-2 p-1 rounded-lg bg-white/5">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`flex-1 py-3 px-4 rounded-md font-medium transition flex items-center justify-center gap-2 ${
                mode === "upload" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <Upload className="w-5 h-5" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex-1 py-3 px-4 rounded-md font-medium transition flex items-center justify-center gap-2 ${
                mode === "url" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <LinkIcon className="w-5 h-5" />
              Paste URL
            </button>
          </div>

          {/* File Upload */}
          {mode === "upload" && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition cursor-pointer ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-white/20 hover:border-indigo-500/50"
              }`}
            >
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <div className="text-xl font-medium mb-2">Drop your video here</div>
                <div className="text-gray-400 mb-4">or click to browse</div>
                <div className="text-sm text-gray-500">MP4, MOV, WebM up to 500MB</div>
              </label>
            </div>
          )}

          {/* URL Input */}
          {mode === "url" && (
            <div className="space-y-4">
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-lg"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!videoUrl}
                className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Platform Selection */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Selected file info */}
          {selectedFile && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4">
              <Video className="w-10 h-10 text-indigo-400" />
              <div className="flex-1">
                <div className="font-medium">{selectedFile.name}</div>
                <div className="text-sm text-gray-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                onClick={() => { setSelectedFile(null); setStep(1); }}
                className="p-2 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {videoUrl && mode === "url" && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4">
              <LinkIcon className="w-10 h-10 text-indigo-400" />
              <div className="flex-1">
                <div className="font-medium truncate">{videoUrl}</div>
              </div>
              <button
                onClick={() => { setVideoUrl(""); setStep(1); }}
                className="p-2 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          <div>
            <label className="block text-lg font-medium mb-4">Select Platform</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`p-4 rounded-xl border text-left transition ${
                    platform === p.id
                      ? `bg-gradient-to-r ${p.color} border-transparent text-white`
                      : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs opacity-75">{p.description}</div>
                  {p.id !== "custom" && (
                    <div className="text-xs mt-1 opacity-60">{p.cropPixels}px crop</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Crop */}
          {platform === "custom" && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <label className="block text-sm font-medium mb-2">
                Custom Crop: {customCrop}px
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

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="font-semibold text-lg">Confirm Details</h3>
            
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-gray-400">Source</span>
              <span>{mode === "upload" ? selectedFile?.name : "URL"}</span>
            </div>
            
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-gray-400">Platform</span>
              <span className="capitalize">{platform}</span>
            </div>
            
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Crop Amount</span>
              <span>
                {platform === "custom"
                  ? customCrop
                  : PLATFORMS.find(p => p.id === platform)?.cropPixels}px
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition font-medium"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
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
          </div>
        </div>
      )}
    </div>
  );
}

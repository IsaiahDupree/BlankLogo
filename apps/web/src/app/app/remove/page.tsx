"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link as LinkIcon, Loader2, Sparkles, Video, X, CheckCircle, Download, Play, RotateCcw, Eye } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/components/toast";
import { trackGenerateRequested, trackMediaReady, trackDownload } from "@/lib/meta-pixel";

// Logging utility
function logRemove(message: string, data?: unknown) {
  console.log(`[PAGE: REMOVE] ${message}`, data !== undefined ? data : "");
}

// Processing steps for the animation
const PROCESSING_STEPS = [
  { id: "validating", label: "Validating video", icon: "🔍" },
  { id: "downloading", label: "Downloading video", icon: "⬇️" },
  { id: "analyzing", label: "Analyzing watermark", icon: "🎯" },
  { id: "processing", label: "Removing watermark", icon: "✨" },
  { id: "encoding", label: "Encoding output", icon: "🎬" },
  { id: "uploading", label: "Uploading result", icon: "⬆️" },
];

// Job status type
interface JobStatus {
  id: string;
  status: string;
  progress: number;
  output_url?: string;
  input_url?: string;
  input?: {
    filename?: string;
    sizeBytes?: number;
    durationSec?: number;
    url?: string;
  };
  output?: {
    filename?: string;
    sizeBytes?: number;
    downloadUrl?: string;
    expiresAt?: string;
  };
  error?: string;
  created_at: string;
  updated_at: string;
}

const PLATFORMS = [
  { id: "auto", name: "Auto-Detect", cropPixels: 0, color: "from-indigo-500 to-purple-600", description: "AI automatically detects and removes the watermark", supported: true },
  { id: "sora", name: "Sora", cropPixels: 120, color: "from-purple-500 to-pink-500", description: "OpenAI Sora videos", supported: true },
  { id: "tiktok", name: "TikTok", cropPixels: 80, color: "from-cyan-500 to-blue-500", description: "TikTok videos", supported: true },
  { id: "runway", name: "Runway", cropPixels: 60, color: "from-green-500 to-emerald-500", description: "Runway ML videos", supported: true },
  { id: "pika", name: "Pika", cropPixels: 50, color: "from-orange-500 to-red-500", description: "Pika Labs videos", supported: true },
  { id: "kling", name: "Kling", cropPixels: 70, color: "from-blue-500 to-indigo-500", description: "Kling AI videos", supported: true },
  { id: "luma", name: "Luma", cropPixels: 55, color: "from-yellow-500 to-orange-500", description: "Luma AI videos", supported: true },
  { id: "instagram", name: "Instagram", cropPixels: 0, color: "from-pink-500 to-purple-600", description: "Instagram Reels", supported: true },
  { id: "facebook", name: "Facebook", cropPixels: 0, color: "from-blue-600 to-blue-800", description: "Facebook videos", supported: true },
  { id: "custom", name: "Custom", cropPixels: 0, color: "from-gray-500 to-gray-600", description: "Set manually", supported: true },
];

export default function RemoveWatermarkPage() {
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [platform, setPlatform] = useState("auto");
  const [customCrop, setCustomCrop] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();
  const toast = useToast();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Poll job status
  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logRemove("⚠️ No session found during poll");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8989";
      logRemove("🔄 Polling job status...", { jobId: id, apiUrl });
      
      const res = await fetch(`${apiUrl}/api/v1/jobs/${id}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const job = data.job || data;
        setJobStatus(job);
        
        // Get progress and step from API response
        const progress = job.progress || 0;
        const currentStepName = job.current_step || "Processing";
        
        console.log(`%c[JOB ${id}] ${job.status.toUpperCase()} - ${progress}% - ${currentStepName}`, 
          `color: ${job.status === 'completed' ? 'green' : job.status === 'failed' ? 'red' : 'blue'}; font-weight: bold;`);
        
        logRemove("📊 Job status:", {
          jobId: job.jobId || job.id,
          status: job.status,
          progress: `${progress}%`,
          currentStep: currentStepName,
          input: job.input?.filename || job.input_filename,
          output: job.output?.downloadUrl || job.output_url || "(processing...)",
          processingTime: job.processingTimeMs ? `${(job.processingTimeMs / 1000).toFixed(1)}s` : "(in progress)",
        });

        // Map current_step to step index based on worker updates
        const stepMap: Record<string, number> = {
          "Waiting in queue": 0,
          "Downloading video": 1,
          "Analyzing video": 2,
          "Removing watermark": 3,
          "Uploading result": 4,
          "Finalizing": 5,
          "Complete": 5,
        };
        const stepIndex = stepMap[currentStepName] ?? Math.min(Math.floor(progress / 17), PROCESSING_STEPS.length - 1);
        setCurrentStep(stepIndex);

        // Check if completed or failed
        const status = job.status;
        if (status === "completed") {
          setIsProcessing(false);
          setSuccess(true);
          toast.success("Watermark removed successfully!");
          // Track MediaReady for Meta Pixel (key activation moment)
          trackMediaReady({ 
            jobId: job.jobId || job.id, 
            platform: job.platform || 'unknown',
            processingTimeMs: job.processingTimeMs 
          });
          console.log("%c✅ JOB COMPLETED!", "color: green; font-size: 16px; font-weight: bold;");
          logRemove("✅ Job completed!", { 
            output_url: job.output?.downloadUrl || job.output_url,
            processingTime: job.processingTimeMs ? `${(job.processingTimeMs / 1000).toFixed(1)}s` : "unknown",
            outputSize: job.output?.sizeBytes ? `${(job.output.sizeBytes / 1024 / 1024).toFixed(2)} MB` : "unknown"
          });
        } else if (status === "failed") {
          setIsProcessing(false);
          const errorMsg = job.error || job.error_message || data.error || "Processing failed";
          setError(errorMsg);
          toast.error(errorMsg);
          console.log("%c❌ JOB FAILED!", "color: red; font-size: 16px; font-weight: bold;");
          logRemove("❌ Job failed:", { 
            error: errorMsg,
            error_code: job.error_code,
            tip: "Try: 1) Copy the direct video URL, 2) Upload the video file directly"
          });
        } else if (status === "processing") {
          logRemove(`⏳ Processing: ${progress}% - ${currentStepName}`);
        } else if (status === "queued") {
          logRemove("⏳ Job queued, waiting for worker...");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.log("%c❌ Poll request failed", "color: red; font-weight: bold;");
        logRemove("❌ Job poll failed:", { 
          status: res.status, 
          statusText: res.statusText,
          error: errorData.error || errorData.message || "Unknown error"
        });
      }
    } catch (err) {
      console.log("%c❌ Network error during poll", "color: red; font-weight: bold;");
      logRemove("❌ Error polling job:", err);
    }
  }, [supabase, toast]);

  // Poll effect
  useEffect(() => {
    if (!jobId || !isProcessing) return;

    const interval = setInterval(() => {
      pollJobStatus(jobId);
    }, 2000);

    // Initial poll
    pollJobStatus(jobId);

    return () => clearInterval(interval);
  }, [jobId, isProcessing, pollJobStatus]);

  useEffect(() => {
    logRemove("✨ Remove watermark page loaded");
    
    // Fetch user's credit balance
    async function fetchCredits() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Try bl_get_credit_balance first (BlankLogo), fallback to get_credit_balance
          let credits = 0;
          const { data: blCredits, error: blError } = await supabase.rpc("bl_get_credit_balance", { p_user_id: session.user.id });
          
          if (!blError && blCredits !== null) {
            credits = blCredits;
          } else {
            // Fallback to original function
            const { data: oldCredits } = await supabase.rpc("get_credit_balance", { p_user_id: session.user.id });
            credits = oldCredits ?? 0;
          }
          
          setCredits(credits);
          logRemove("💰 Credits loaded:", credits);
        }
      } catch (err) {
        logRemove("❌ Failed to fetch credits:", err);
      }
    }
    fetchCredits();
  }, [supabase]);

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
    console.log("%c🚀 FORM SUBMITTED", "color: blue; font-size: 16px; font-weight: bold;");
    logRemove("🚀 Submitting job...", { mode, platform, videoUrl, selectedFile: selectedFile?.name, credits });
    
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
        logRemove("🌐 Calling API:", { url: `${apiUrl}/api/v1/jobs`, videoUrl, platform, cropPixels });
        
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
        logRemove("📦 API response:", { 
          status: res.status, 
          statusText: res.statusText,
          jobId: data.jobId,
          error: data.error,
          message: data.message,
          fullResponse: data 
        });

        if (!res.ok) {
          logRemove("❌ API error details:", { 
            status: res.status, 
            error: data.error, 
            message: data.message,
            credits_required: data.credits_required,
            credits_available: data.credits_available
          });
          throw new Error(data.error || data.message || "Failed to create job");
        }

        setJobId(data.jobId);
        setIsProcessing(true);
        setCurrentStep(0);
        // Track GenerateRequested for Meta Pixel
        trackGenerateRequested({ platform, processingMode: 'inpaint', jobId: data.jobId });
        console.log("%c🎬 JOB CREATED: " + data.jobId, "color: green; font-size: 14px; font-weight: bold;");
        logRemove("✅ Job created successfully:", {
          jobId: data.jobId,
          status: data.status,
          platform: data.platform,
          cropPixels: data.crop_pixels,
          creditsCharged: data.credits_charged,
          estimatedCompletion: data.estimated_completion
        });
        console.log("%c⏳ Starting job monitoring... Watch for progress updates below", "color: blue; font-style: italic;");
      } else if (mode === "upload" && selectedFile) {
        logRemove("📤 Uploading file...", { 
          filename: selectedFile.name, 
          size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
          type: selectedFile.type,
          platform, 
          cropPixels 
        });
        
        const formData = new FormData();
        formData.append("video", selectedFile);
        formData.append("platform", platform);
        formData.append("crop_pixels", String(cropPixels));

        logRemove("🌐 Calling upload API:", { url: `${apiUrl}/api/v1/jobs/upload` });

        const res = await fetch(`${apiUrl}/api/v1/jobs/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await res.json();
        logRemove("📦 Upload response:", { 
          status: res.status, 
          statusText: res.statusText,
          jobId: data.jobId || data.job_id,
          error: data.error,
          message: data.message,
          fullResponse: data
        });

        if (!res.ok) {
          logRemove("❌ Upload error details:", { 
            status: res.status, 
            error: data.error, 
            message: data.message 
          });
          throw new Error(data.error || data.message || "Failed to upload video");
        }

        const createdJobId = data.jobId || data.job_id;
        setJobId(createdJobId);
        setIsProcessing(true);
        setCurrentStep(0);
        // Track GenerateRequested for Meta Pixel
        trackGenerateRequested({ platform, processingMode: 'inpaint', jobId: createdJobId });
        console.log("%c🎬 UPLOAD JOB CREATED: " + createdJobId, "color: green; font-size: 14px; font-weight: bold;");
        logRemove("✅ Upload successful:", {
          jobId: createdJobId,
          status: data.status,
          filename: selectedFile.name
        });
      } else {
        logRemove("⚠️ No valid submission mode:", { mode, hasUrl: !!videoUrl, hasFile: !!selectedFile });
        throw new Error("Please provide a video URL or upload a file");
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

  // Processing state - show cool animation
  if (isProcessing && jobId) {
    const progress = jobStatus?.progress || 0;
    
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/20 overflow-hidden">
          {/* Animated header */}
          <div className="relative p-8 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center animate-pulse">
                <Sparkles className="w-10 h-10 text-white animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Removing Watermark...
              </h2>
              <p className="text-gray-400">
                This usually takes 30-60 seconds
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-8 pb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Progress</span>
              <span className="text-indigo-400 font-mono">{progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
          </div>

          {/* Processing steps */}
          <div className="px-8 pb-8">
            <div className="space-y-3">
              {PROCESSING_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isComplete = index < currentStep;
                
                return (
                  <div 
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      isActive 
                        ? "bg-indigo-500/20 border border-indigo-500/30" 
                        : isComplete 
                          ? "bg-green-500/10 border border-green-500/20" 
                          : "bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                      isActive ? "animate-bounce" : ""
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span className={`font-medium ${
                      isActive ? "text-indigo-300" : isComplete ? "text-green-400" : "text-gray-500"
                    }`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <Loader2 className="w-4 h-4 ml-auto text-indigo-400 animate-spin" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cancel option */}
          <div className="px-8 pb-8 text-center">
            <button
              onClick={() => router.push("/app/jobs")}
              className="text-sm text-gray-500 hover:text-gray-300 transition"
            >
              View in Jobs page →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show completed video with before/after comparison
  if (success && jobId) {
    const outputUrl = jobStatus?.output_url || jobStatus?.output?.downloadUrl;
    const inputUrl = jobStatus?.input?.url || jobStatus?.input_url;
    
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/20 overflow-hidden">
          {/* Success header */}
          <div className="p-6 text-center border-b border-green-500/20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-1 text-green-400">Watermark Removed!</h2>
            <p className="text-gray-400 text-sm">Your video is ready to download</p>
          </div>

          {/* Before/After Video Comparison */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Before - Original Video */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">BEFORE</span>
                  Original with Watermark
                </div>
                {inputUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      src={inputUrl}
                      controls
                      muted
                      loop
                      className="w-full h-full object-contain"
                      data-testid="input-video-preview"
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded bg-red-500/80 text-xs font-medium">
                      With Watermark
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 aspect-video flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Original not available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* After - Processed Video */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">AFTER</span>
                  Watermark Removed
                </div>
                {outputUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      src={outputUrl}
                      controls
                      autoPlay
                      muted
                      loop
                      className="w-full h-full object-contain"
                      data-testid="output-video-preview"
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded bg-green-500/80 text-xs font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Clean
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 aspect-video flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Loading...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push("/app/jobs")}
                data-testid="view-jobs-button"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
              >
                <Eye className="w-5 h-5" />
                View All Jobs
              </button>
              {outputUrl && (
                <a
                  href={outputUrl}
                  download
                  onClick={() => {
                    // Track Download for Meta Pixel
                    if (jobId) trackDownload({ jobId, platform });
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-500 transition font-medium"
                  data-testid="download-button"
                >
                  <Download className="w-5 h-5" />
                  Download
                </a>
              )}
            </div>
          </div>

          {/* Remove another */}
          <div className="px-6 pb-6">
            <button
              onClick={() => {
                setSuccess(false);
                setJobId(null);
                setJobStatus(null);
                setIsProcessing(false);
                setVideoUrl("");
                setSelectedFile(null);
                setError(null);
                setCurrentStep(0);
              }}
              data-testid="remove-another-button"
              className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 transition font-medium flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Remove Another Watermark
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
        {/* Zero Credits Warning */}
        {credits === 0 && (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-semibold">You have 0 credits</div>
              <div className="text-sm text-amber-400/80">Purchase credits to remove watermarks from your videos.</div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/app/credits")}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-medium transition text-sm"
            >
              Buy Credits
            </button>
          </div>
        )}

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
            data-testid="mode-url"
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
            data-testid="mode-upload"
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
              data-testid="video-url-input"
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
          
          {/* Auto-Detect - Featured Option */}
          <button
            type="button"
            onClick={() => setPlatform("auto")}
            data-testid="platform-auto"
            className={`w-full mb-4 p-4 rounded-xl border text-left transition flex items-center gap-4 ${
              platform === "auto"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent text-white"
                : "bg-white/5 border-white/10 text-gray-300 hover:border-indigo-500/50 hover:bg-indigo-500/10"
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              platform === "auto" ? "bg-white/20" : "bg-indigo-500/20"
            }`}>
              <Sparkles className={`w-6 h-6 ${platform === "auto" ? "text-white" : "text-indigo-400"}`} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">Auto-Detect</div>
              <div className={`text-sm ${platform === "auto" ? "text-white/80" : "text-gray-400"}`}>
                AI automatically detects and removes the watermark
              </div>
            </div>
            {platform === "auto" && (
              <CheckCircle className="w-6 h-6 text-white" />
            )}
          </button>

          {/* Other platforms in grid */}
          <div className="text-xs text-gray-500 mb-2">Or select a specific platform:</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {PLATFORMS.filter(p => p.id !== "auto").map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                data-testid={`platform-${p.id}`}
                className={`p-2 rounded-lg border text-center transition ${
                  platform === p.id
                    ? `bg-gradient-to-r ${p.color} border-transparent text-white`
                    : "bg-white/5 border-white/10 text-gray-300 hover:border-white/30"
                }`}
              >
                <div className="font-medium text-sm">{p.name}</div>
                {p.supported && <div className="text-xs opacity-75 text-green-400">✓ Supported</div>}
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
          data-testid="submit-remove-watermark"
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

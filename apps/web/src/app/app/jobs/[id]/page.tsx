"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  Video,
  Play,
  Sparkles,
  Calendar,
  Tag,
  RefreshCw
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

interface JobDetail {
  id: string;
  status: string;
  platform: string;
  input_filename: string;
  input_source: string | null;
  input_url: string | null;
  output_url: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  progress: number;
  current_step: string | null;
  processing_time_ms: number | null;
  mode: string;
  crop_pixels: number | null;
  input_size_bytes: number | null;
  input_duration_sec: number | null;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchJob() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("bl_jobs")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single();

        if (fetchError) {
          setError("Job not found");
          return;
        }

        setJob(data as JobDetail);
      } catch (err) {
        setError("Failed to load job");
      } finally {
        setLoading(false);
      }
    }

    fetchJob();

    // Poll for updates if job is processing
    const interval = setInterval(() => {
      if (job?.status === "processing" || job?.status === "queued" || job?.status === "validating") {
        fetchJob();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [params.id, supabase, router, job?.status]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8">
        <div className="text-center py-16">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold mb-2">{error || "Job not found"}</h2>
          <Link href="/app/jobs" className="text-indigo-400 hover:underline">
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (job.status) {
      case "completed":
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-500/20 text-gray-400">
            <Clock className="w-4 h-4" />
            {job.status}
          </span>
        );
    }
  };

  // Get the input video URL (original with watermark)
  const inputVideoUrl = job.input_source || job.input_url;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/app/jobs" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {job.input_filename || `Job ${job.id.slice(0, 8)}`}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {job.platform === "auto" ? "Auto-Detect" : job.platform}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(job.created_at).toLocaleDateString()} at{" "}
                {new Date(job.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Video Comparison */}
      {job.status === "completed" ? (
        <div className="space-y-6">
          {/* Before/After Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Before - Original with Watermark */}
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-red-500/10">
                <h3 className="font-semibold text-red-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Before - With Watermark
                </h3>
              </div>
              <div className="aspect-video bg-black relative">
                {inputVideoUrl ? (
                  <video
                    src={inputVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                    poster=""
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Original video unavailable</p>
                    </div>
                  </div>
                )}
                {/* Watermark overlay indicator */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-red-500/80 text-xs font-medium flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Has Watermark
                </div>
              </div>
            </div>

            {/* After - Watermark Removed */}
            <div className="rounded-2xl bg-white/5 border border-green-500/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-green-500/20 bg-green-500/10">
                <h3 className="font-semibold text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  After - Watermark Removed
                </h3>
              </div>
              <div className="aspect-video bg-black relative">
                {job.output_url ? (
                  <video
                    src={job.output_url}
                    controls
                    autoPlay
                    muted
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Processed video loading...</p>
                    </div>
                  </div>
                )}
                {/* Clean badge */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-green-500/80 text-xs font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Watermark Free
                </div>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className="rounded-2xl bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg text-green-400 mb-1">
                  ✨ Your Clean Video is Ready!
                </h3>
                <p className="text-gray-400 text-sm">
                  Download your watermark-free video below
                </p>
              </div>
              {job.output_url && (
                <a
                  href={job.output_url}
                  download={job.input_filename?.replace(/\.[^/.]+$/, "") + "_clean.mp4"}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 transition font-semibold text-white"
                >
                  <Download className="w-5 h-5" />
                  Download Clean Video
                </a>
              )}
            </div>
          </div>
        </div>
      ) : job.status === "failed" ? (
        /* Failed State */
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-8">
          <div className="text-center mb-6">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h3 className="text-xl font-semibold text-red-400 mb-2">Processing Failed</h3>
            <p className="text-gray-400">
              {job.error_message || "An error occurred while processing your video"}
            </p>
          </div>
          
          {/* Failed job details */}
          <div className="bg-black/20 rounded-xl p-4 mb-6 space-y-3">
            {job.input_filename && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Input File</span>
                <span className="text-gray-300">{job.input_filename}</span>
              </div>
            )}
            {job.current_step && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Failed At Step</span>
                <span className="text-red-400">{job.current_step}</span>
              </div>
            )}
            {job.processing_time_ms && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Processing Time</span>
                <span className="text-gray-300">{(job.processing_time_ms / 1000).toFixed(1)}s</span>
              </div>
            )}
            {job.input_size_bytes && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">File Size</span>
                <span className="text-gray-300">{(job.input_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <Link
              href="/app/remove"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </Link>
          </div>
        </div>
      ) : (
        /* Processing State */
        <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          </div>
          <h3 className="text-xl font-semibold text-indigo-400 mb-2">Processing Your Video</h3>
          
          {/* Current step indicator */}
          {job.current_step && (
            <p className="text-indigo-300 font-medium mb-2">
              {job.current_step}
            </p>
          )}
          
          <p className="text-gray-400 mb-4">
            This usually takes 30-60 seconds. The page will update automatically.
          </p>
          
          {/* Progress bar */}
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">{job.input_filename || "Processing"}</span>
              <span className="text-indigo-400 font-mono">{job.progress || 0}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${job.progress || 0}%` }}
              />
            </div>
          </div>
          
          {/* Input file info */}
          {job.input_filename && (
            <div className="mt-4 text-sm text-gray-500">
              {job.input_size_bytes && (
                <span>{(job.input_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
              )}
              {job.input_duration_sec && (
                <span className="ml-3">{Math.round(job.input_duration_sec)}s duration</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Job Details */}
      <div className="mt-8 rounded-2xl bg-white/5 border border-white/10 p-6">
        <h3 className="font-semibold mb-4">Job Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500 mb-1">Job ID</div>
            <div className="font-mono text-gray-300">{job.id.slice(0, 12)}...</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Platform</div>
            <div className="text-gray-300 capitalize">{job.platform === "auto" ? "Auto-Detect" : job.platform}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Mode</div>
            <div className="text-gray-300 capitalize">{job.mode || "Crop"}</div>
          </div>
          <div>
            <div className="text-gray-500 mb-1">Crop Pixels</div>
            <div className="text-gray-300">{job.crop_pixels ?? "Auto"}px</div>
          </div>
        </div>
      </div>
    </div>
  );
}

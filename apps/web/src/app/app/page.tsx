"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Clock, CheckCircle, XCircle, Loader2, Video, RefreshCw, AlertCircle, Film } from "lucide-react";
import { VideoThumbnail } from "@/components/video-thumbnail";
import { createBrowserClient } from "@supabase/ssr";
import { auth } from "@/lib/posthog-events";

interface BlJob {
  id: string;
  status: string;
  platform: string;
  input_filename: string;
  input_url: string | null;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
  progress?: number;
  current_stage?: string;
  error_message?: string;
  metadata?: {
    width?: number;
    height?: number;
    isVertical?: boolean;
  };
}

// Progress stages with labels
const PROGRESS_STAGES: Record<string, { label: string; progress: number }> = {
  queued: { label: "Waiting in queue...", progress: 5 },
  claimed: { label: "Starting...", progress: 10 },
  downloading: { label: "Downloading video...", progress: 20 },
  analyzing: { label: "Analyzing watermark...", progress: 30 },
  processing: { label: "Removing watermark...", progress: 50 },
  rendering: { label: "Rendering output...", progress: 70 },
  uploading: { label: "Uploading result...", progress: 85 },
  finalizing: { label: "Finalizing...", progress: 95 },
  completed: { label: "Complete!", progress: 100 },
  failed: { label: "Failed", progress: 0 },
};

function getStatusDisplay(job: BlJob) {
  const stage = job.current_stage || job.status;
  const stageInfo = PROGRESS_STAGES[stage] || PROGRESS_STAGES[job.status] || { label: job.status, progress: 0 };
  return stageInfo;
}

function StatusBadge({ job }: { job: BlJob }) {
  const { label, progress } = getStatusDisplay(job);
  const isActive = ["queued", "claimed", "processing", "downloading", "analyzing", "rendering", "uploading", "finalizing"].includes(job.status) || 
                   ["queued", "claimed", "processing", "downloading", "analyzing", "rendering", "uploading", "finalizing"].includes(job.current_stage || "");
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed" || job.status === "failed_terminal" || job.status === "failed_retryable";

  if (isCompleted) {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-sm text-green-400 font-medium">Complete</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400 font-medium">Failed</span>
        </div>
        {job.error_message && (
          <span className="text-xs text-red-400/70 max-w-[200px] truncate">{job.error_message}</span>
        )}
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="flex flex-col items-end gap-2 min-w-[180px]">
        <div className="flex items-center gap-2 w-full justify-end">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span className="text-sm text-blue-400">{label}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div 
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{progress}%</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Clock className="w-5 h-5 text-gray-400" />
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<BlJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchJobs = useCallback(async () => {
    const { data, error } = await supabase
      .from("bl_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (!error && data) {
      setJobs(data as BlJob[]);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [supabase]);

  // Initial fetch + activation tracking
  useEffect(() => {
    fetchJobs();
    
    // Check for activation_complete (first time user reaches app with credits)
    const checkActivation = async () => {
      const activationKey = 'bl_activation_tracked';
      if (localStorage.getItem(activationKey)) return; // Already tracked
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get credits balance
      const { data: credits } = await supabase
        .from('bl_credit_ledger')
        .select('amount')
        .eq('user_id', user.id);
      
      const balance = credits?.reduce((sum, c) => sum + c.amount, 0) || 0;
      
      if (balance > 0) {
        // User has credits - they're activated!
        const signupTime = localStorage.getItem('bl_signup_start_time');
        const timeToActivate = signupTime ? Date.now() - parseInt(signupTime) : undefined;
        
        auth.activationComplete({
          user_id: user.id,
          credits_balance: balance,
          time_to_activate_ms: timeToActivate,
        });
        localStorage.setItem(activationKey, 'true');
      }
    };
    
    checkActivation();
  }, [fetchJobs, supabase]);

  // Poll for updates on active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(j => 
      ["queued", "claimed", "processing", "running", "uploading", "finalizing"].includes(j.status)
    );
    
    if (!hasActiveJobs) return;

    const interval = setInterval(fetchJobs, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('job-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bl_jobs' },
        () => { fetchJobs(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchJobs]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-400">Your recent watermark removal jobs</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={fetchJobs}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <Link
            href="/app/remove"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">New Job</span>
            <span className="xs:hidden">New</span>
          </Link>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No jobs yet</h2>
          <p className="text-gray-400 mb-6">Upload a video to remove watermarks</p>
          <Link
            href="/app/remove"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Remove Watermark
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-300">Recent Jobs</h2>
            <span className="text-xs text-gray-500">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          <div className="grid gap-3">
            {jobs.map((job: BlJob) => (
              <Link
                key={job.id}
                href={`/app/jobs/${job.id}`}
                className="p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex flex-row items-center gap-3 sm:gap-4 group"
              >
                {/* Video Thumbnail */}
                <div className="flex-shrink-0">
                  {job.input_url ? (
                    <VideoThumbnail
                      src={job.input_url}
                      alt={job.input_filename || 'Video thumbnail'}
                      className="w-16 h-16 sm:w-20 sm:h-20"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-gray-800 rounded-lg">
                      <Film className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold mb-1 truncate group-hover:text-blue-400 transition text-sm sm:text-base">
                    {job.input_filename || `Job ${job.id.slice(0, 8)}`}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                    <span className="capitalize px-2 py-0.5 rounded bg-white/5">{job.platform || 'auto'}</span>
                    <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    <span className="hidden sm:inline text-gray-500">{new Date(job.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                  <StatusBadge job={job} />
                  {job.status === "completed" && job.output_url && (
                    <a
                      href={job.output_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs sm:text-sm hover:bg-green-500/30 transition font-medium whitespace-nowrap"
                    >
                      Download
                    </a>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

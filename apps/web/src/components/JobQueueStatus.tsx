"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink
} from "lucide-react";

interface Job {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  platform: string;
  progress: number;
  input_url: string;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  credits_charged: number;
}

interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export default function JobQueueStatus() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<QueueStats>({ queued: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("bl_jobs")
        .select("id, status, platform, progress, input_url, output_url, error_message, created_at, completed_at, credits_charged")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setJobs(data || []);
      
      // Calculate stats
      const newStats: QueueStats = { queued: 0, processing: 0, completed: 0, failed: 0 };
      data?.forEach(job => {
        if (job.status in newStats) {
          newStats[job.status as keyof QueueStats]++;
        }
      });
      setStats(newStats);
    } catch (err) {
      console.error("[JobQueue] Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    
    // Poll for updates every 10 seconds if there are active jobs
    const interval = setInterval(() => {
      if (stats.queued > 0 || stats.processing > 0) {
        fetchJobs();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [stats.queued, stats.processing]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const getStatusIcon = (status: Job["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "queued":
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: Job["status"]) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "failed": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "processing": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "queued": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Job Queue</h3>
          <div className="flex gap-2">
            {stats.processing > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500">
                {stats.processing} processing
              </span>
            )}
            {stats.queued > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-500">
                {stats.queued} queued
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            className="p-1 hover:bg-muted rounded"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Job List */}
      {expanded && (
        <div className="border-t">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No jobs yet</p>
              <p className="text-sm">Submit a video to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-muted/30 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {getStatusIcon(job.status)}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{job.id.slice(0, 16)}...</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className="capitalize">{job.platform}</span>
                          <span>•</span>
                          <span>{formatTime(job.created_at)}</span>
                          {job.credits_charged > 0 && (
                            <>
                              <span>•</span>
                              <span>{job.credits_charged} credit{job.credits_charged !== 1 ? "s" : ""}</span>
                            </>
                          )}
                        </div>
                        {job.status === "processing" && job.progress > 0 && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">{job.progress}%</span>
                          </div>
                        )}
                        {job.status === "failed" && job.error_message && (
                          <p className="text-sm text-red-400 mt-1">{job.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "completed" && job.output_url && (
                        <a
                          href={job.output_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-muted rounded-lg transition"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      <a
                        href={`/app/jobs/${job.id}`}
                        className="p-2 hover:bg-muted rounded-lg transition"
                        title="View details"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

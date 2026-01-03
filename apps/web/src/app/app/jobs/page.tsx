import Link from "next/link";
import { Plus, Clock, CheckCircle, XCircle, Loader2, Video, Download, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Server-side logging
function logJobs(message: string, data?: unknown) {
  console.log(`[PAGE: JOBS] ${message}`, data ? JSON.stringify(data) : "");
}

interface BlJob {
  id: string;
  status: string;
  platform: string;
  input_filename: string;
  input_url: string | null;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

async function getJobs(): Promise<BlJob[]> {
  logJobs("🔍 Fetching all jobs...");
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logJobs("❌ No user found");
    return [];
  }
  
  const { data, error } = await supabase
    .from("bl_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    logJobs("❌ Error fetching jobs:", error.message);
    return [];
  }
  
  logJobs(`✅ Found ${data?.length ?? 0} jobs`);
  return (data as BlJob[]) ?? [];
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-400" />;
    case "processing":
      return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "processing":
      return "Processing...";
    case "queued":
      return "Queued";
    default:
      return status;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "completed":
      return "text-green-400";
    case "failed":
      return "text-red-400";
    case "processing":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
}

export default async function JobsPage() {
  logJobs("📋 Jobs page rendering...");
  const jobs = await getJobs();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Jobs</h1>
          <p className="text-gray-400">All your watermark removal jobs</p>
        </div>
        <Link
          href="/app/remove"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No jobs yet</h2>
          <p className="text-gray-400 mb-6">
            Upload a video to remove watermarks
          </p>
          <Link
            href="/app/remove"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Remove Watermark
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-400 mb-4">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} total
          </div>
          <div className="grid gap-4">
            {jobs.map((job: BlJob) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">
                      {job.input_filename || `Job ${job.id.slice(0, 8)}`}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="capitalize px-2 py-0.5 rounded bg-white/5">
                        {job.platform}
                      </span>
                      <span>
                        {new Date(job.created_at).toLocaleDateString()} at{" "}
                        {new Date(job.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 ${getStatusColor(job.status)}`}>
                      {getStatusIcon(job.status)}
                      <span className="text-sm font-medium">
                        {getStatusLabel(job.status)}
                      </span>
                    </div>
                    {job.status === "completed" && job.output_url && (
                      <a
                        href={job.output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    )}
                    {job.status === "failed" && job.error_message && (
                      <span className="text-xs text-red-400 max-w-[200px] truncate">
                        {job.error_message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

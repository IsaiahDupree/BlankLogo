import Link from "next/link";
import { Plus, Clock, CheckCircle, XCircle, Loader2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Server-side logging for dashboard
function logDashboard(message: string, data?: unknown) {
  console.log(`[PAGE: DASHBOARD] ${message}`, data ? JSON.stringify(data) : "");
}

interface BlJob {
  id: string;
  status: string;
  platform: string;
  input_filename: string;
  output_url: string | null;
  created_at: string;
  completed_at: string | null;
}

async function getRecentJobs(): Promise<BlJob[]> {
  logDashboard("🔍 Fetching recent jobs...");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bl_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  
  if (error) {
    logDashboard("❌ Error fetching jobs:", error.message);
  } else {
    logDashboard(`✅ Found ${data?.length ?? 0} jobs`);
  }
  
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

export default async function DashboardPage() {
  logDashboard("📊 Dashboard page rendering...");
  const jobs = await getRecentJobs();
  logDashboard("📊 Dashboard loaded", { jobCount: jobs.length });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Your recent watermark removal jobs</p>
        </div>
        <Link
          href="/app/upload"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No jobs yet</h2>
          <p className="text-gray-400 mb-6">
            Upload a video to remove watermarks
          </p>
          <Link
            href="/app/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Upload Video
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Recent Jobs</h2>
          <div className="grid gap-4">
            {jobs.map((job: BlJob) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4"
              >
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{job.input_filename || job.id}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="capitalize">{job.platform}</span>
                    <span>
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="text-sm text-gray-300">
                      {getStatusLabel(job.status)}
                    </span>
                  </div>
                  {job.status === "completed" && job.output_url && (
                    <a
                      href={job.output_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition"
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

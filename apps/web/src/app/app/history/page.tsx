import Link from "next/link";
import { Clock, CheckCircle, XCircle, Video, Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Server-side logging
function logHistory(message: string, data?: unknown) {
  console.log(`[PAGE: HISTORY] ${message}`, data ? JSON.stringify(data) : "");
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

async function getCompletedJobs(): Promise<BlJob[]> {
  logHistory("🔍 Fetching completed jobs...");
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    logHistory("❌ No user found");
    return [];
  }
  
  const { data, error } = await supabase
    .from("bl_jobs")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["completed", "failed"])
    .order("completed_at", { ascending: false });
  
  if (error) {
    logHistory("❌ Error fetching history:", error.message);
    return [];
  }
  
  logHistory(`✅ Found ${data?.length ?? 0} completed jobs`);
  return (data as BlJob[]) ?? [];
}

export default async function HistoryPage() {
  logHistory("📜 History page rendering...");
  const jobs = await getCompletedJobs();

  const completedJobs = jobs.filter(j => j.status === "completed");
  const failedJobs = jobs.filter(j => j.status === "failed");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">History</h1>
        <p className="text-gray-400">Your completed watermark removal jobs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-2xl font-bold">{jobs.length}</div>
          <div className="text-sm text-gray-400">Total Jobs</div>
        </div>
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <div className="text-2xl font-bold text-green-400">{completedJobs.length}</div>
          <div className="text-sm text-gray-400">Completed</div>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="text-2xl font-bold text-red-400">{failedJobs.length}</div>
          <div className="text-sm text-gray-400">Failed</div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-500/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No history yet</h2>
          <p className="text-gray-400 mb-6">
            Your completed jobs will appear here
          </p>
          <Link
            href="/app/remove"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium"
          >
            Remove Your First Watermark
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: BlJob) => (
            <div
              key={job.id}
              className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                {job.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">
                  {job.input_filename || `Job ${job.id.slice(0, 8)}`}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="capitalize">{job.platform}</span>
                  <span>
                    {job.completed_at
                      ? new Date(job.completed_at).toLocaleDateString()
                      : new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

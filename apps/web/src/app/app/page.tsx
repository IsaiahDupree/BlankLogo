import Link from "next/link";
import { Plus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Project, Job } from "@canvascast/shared";

async function getRecentProjects(): Promise<(Project & { jobs: Job[] })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("*, jobs(*)")
    .order("created_at", { ascending: false })
    .limit(5);
  
  return (data as (Project & { jobs: Job[] })[]) ?? [];
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ready":
      return <CheckCircle className="w-5 h-5 text-green-400" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-400" />;
    case "generating":
      return <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "generating":
      return "Generating...";
    default:
      return "Draft";
  }
}

export default async function DashboardPage() {
  const projects = await getRecentProjects();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-400">Create and manage your video projects</p>
        </div>
        <Link
          href="/app/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-500/10 flex items-center justify-center">
            <Plus className="w-8 h-8 text-brand-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-gray-400 mb-6">
            Create your first video project to get started
          </p>
          <Link
            href="/app/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Project
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-300">Recent Projects</h2>
          <div className="grid gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition flex items-center gap-4"
              >
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{project.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="capitalize">{project.niche_preset}</span>
                    <span>{project.target_minutes} min</span>
                    <span>
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(project.status)}
                  <span className="text-sm text-gray-300">
                    {getStatusLabel(project.status)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="text-center pt-4">
            <Link
              href="/app/projects"
              className="text-brand-400 hover:text-brand-300 text-sm"
            >
              View all projects →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

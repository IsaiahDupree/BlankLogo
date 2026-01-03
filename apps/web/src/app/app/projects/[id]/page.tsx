"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  FileText,
  Film,
  FileArchive,
  Subtitles,
  AlertTriangle,
} from "lucide-react";
import InputsPanel from "./InputsPanel";

type Project = {
  id: string;
  title: string;
  niche_preset: string;
  target_minutes: number;
  status: string;
  created_at: string;
};

type Job = {
  id: string;
  status: string;
  progress: number;
  error_message?: string;
};

type Downloads = {
  video?: string;
  captions?: string;
  zip?: string;
  timeline?: string;
  script?: string;
};

const JOB_STEPS = [
  { status: "QUEUED", label: "Queued" },
  { status: "CLAIMED", label: "Starting" },
  { status: "SCRIPTING", label: "Writing Script" },
  { status: "VOICE_GEN", label: "Generating Voice" },
  { status: "ALIGNMENT", label: "Syncing Captions" },
  { status: "VISUAL_PLAN", label: "Planning Visuals" },
  { status: "IMAGE_GEN", label: "Creating Images" },
  { status: "TIMELINE_BUILD", label: "Building Timeline" },
  { status: "RENDERING", label: "Rendering Video" },
  { status: "PACKAGING", label: "Packaging Assets" },
  { status: "READY", label: "Ready" },
];

type JobEvent = {
  stage: string;
  level: string;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [downloads, setDownloads] = useState<Downloads | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch project");
      }

      setProject(data.project);
      setJobs(data.jobs || []);

      // Fetch downloads if ready
      if (data.project.status === "ready") {
        const dlRes = await fetch(`/api/projects/${projectId}/downloads`, {
          method: "POST",
        });
        if (dlRes.ok) {
          const dlData = await dlRes.json();
          setDownloads(dlData.downloads);
        }
      }

      // Fetch job events for live log
      if (data.project.status === "generating" || data.project.status === "failed") {
        const eventsRes = await fetch(`/api/projects/${projectId}/events`, { cache: "no-store" });
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events ?? []);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll for updates while generating
  useEffect(() => {
    if (project?.status !== "generating") return;

    const interval = setInterval(fetchProject, 3000);
    return () => clearInterval(interval);
  }, [project?.status, fetchProject]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start generation");
      }

      // Refresh project data
      await fetchProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error || "Project not found"}</p>
        <Link href="/app" className="text-brand-400 hover:text-brand-300 mt-4 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const latestJob = jobs[0];
  const currentStepIndex = latestJob
    ? JOB_STEPS.findIndex((s) => s.status === latestJob.status)
    : -1;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/app"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="capitalize">{project.niche_preset}</span>
              <span>{project.target_minutes} min</span>
              <span>{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Draft state - Inputs + Generate button */}
      {project.status === "draft" && (
        <div className="space-y-6">
          {/* Inputs Panel */}
          <InputsPanel projectId={projectId} />

          {/* Generate button */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-500/10 flex items-center justify-center">
              <Play className="w-8 h-8 text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Generate</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              This will use approximately {project.target_minutes} credits to generate
              your video, including script, voice, visuals, and final MP4.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-8 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition font-semibold inline-flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Generate Video
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Generating state - Progress */}
      {project.status === "generating" && latestJob && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            <h2 className="text-xl font-semibold">Generating Your Video</h2>
          </div>

          {/* Progress steps */}
          <div className="space-y-3">
            {JOB_STEPS.map((step, index) => {
              const isComplete = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div
                  key={step.status}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isCurrent
                      ? "bg-brand-500/10 border border-brand-500/30"
                      : "bg-white/5"
                  }`}
                >
                  {isComplete && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {isCurrent && <Loader2 className="w-5 h-5 animate-spin text-brand-400" />}
                  {isPending && <Clock className="w-5 h-5 text-gray-500" />}
                  <span
                    className={
                      isCurrent
                        ? "text-white font-medium"
                        : isComplete
                          ? "text-gray-300"
                          : "text-gray-500"
                    }
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stale job warning */}
          {(() => {
            const lastEventTime = events?.length
              ? new Date(events[events.length - 1].created_at).getTime()
              : null;
            const isStale = lastEventTime ? Date.now() - lastEventTime > 10 * 60 * 1000 : false;
            return isStale ? (
              <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-yellow-400">Job may be stuck</div>
                  <div className="text-sm text-yellow-300/80">
                    This job hasn&apos;t updated in a while. It may be automatically re-queued.
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          <p className="text-sm text-gray-400 mt-6">
            This may take a few minutes. You can leave this page and come back later.
          </p>

          {/* Live Job Log */}
          {events.length > 0 && (
            <div className="mt-6 border border-white/10 rounded-xl p-4">
              <h3 className="font-semibold mb-3 text-sm text-gray-300">Live Job Log</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((e, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg text-sm ${
                      e.level === "error"
                        ? "bg-red-500/10 border border-red-500/20"
                        : e.level === "warn"
                          ? "bg-yellow-500/10 border border-yellow-500/20"
                          : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-brand-400">{e.stage}</span>
                      <span className="text-gray-500 text-xs">
                        {new Date(e.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={e.level === "error" ? "text-red-300" : "text-gray-300"}>
                      {e.message}
                    </div>
                    {e.meta && Object.keys(e.meta).length > 0 && (
                      <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">
                        {JSON.stringify(e.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ready state - Downloads */}
      {project.status === "ready" && (
        <div className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <h2 className="text-xl font-semibold text-green-400">
                Your Video is Ready!
              </h2>
              <p className="text-gray-400">Download your video and assets below</p>
            </div>
          </div>

          {/* Download buttons */}
          <div className="grid sm:grid-cols-2 gap-4">
            {downloads?.video && (
              <DownloadCard
                icon={<Film className="w-6 h-6" />}
                title="Final Video"
                description="MP4 (1080p)"
                href={downloads.video}
              />
            )}
            {downloads?.captions && (
              <DownloadCard
                icon={<Subtitles className="w-6 h-6" />}
                title="Captions"
                description="SRT format"
                href={downloads.captions}
              />
            )}
            {downloads?.script && (
              <DownloadCard
                icon={<FileText className="w-6 h-6" />}
                title="Script"
                description="Text file"
                href={downloads.script}
              />
            )}
            {downloads?.zip && (
              <DownloadCard
                icon={<FileArchive className="w-6 h-6" />}
                title="Asset Pack"
                description="All project files"
                href={downloads.zip}
              />
            )}
          </div>
        </div>
      )}

      {/* Failed state */}
      {project.status === "failed" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8">
          <div className="flex items-center gap-4 mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
            <h2 className="text-xl font-semibold text-red-400">Generation Failed</h2>
          </div>
          {latestJob?.error_message && (
            <pre className="bg-black/30 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto mb-6">
              {latestJob.error_message}
            </pre>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 transition font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Retry Generation
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    draft: "bg-gray-500/20 text-gray-300",
    generating: "bg-brand-500/20 text-brand-400",
    ready: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
  }[status] ?? "bg-gray-500/20 text-gray-300";

  const labels = {
    draft: "Draft",
    generating: "Generating",
    ready: "Ready",
    failed: "Failed",
  }[status] ?? status;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles}`}>
      {labels}
    </span>
  );
}

function DownloadCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand-500/50 transition"
    >
      <div className="w-12 h-12 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <Download className="w-5 h-5 text-gray-400" />
    </a>
  );
}

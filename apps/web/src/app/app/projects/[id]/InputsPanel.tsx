"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { FileText, Link as LinkIcon, Upload, Trash2, Loader2 } from "lucide-react";

type InputRow = {
  id: string;
  type: "text" | "url" | "file";
  title: string | null;
  content_text: string | null;
  source_url: string | null;
  storage_path: string | null;
  created_at: string;
};

export default function InputsPanel({ projectId }: { projectId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [inputs, setInputs] = useState<InputRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [textTitle, setTextTitle] = useState("Notes");
  const [textBody, setTextBody] = useState("");
  const [urlTitle, setUrlTitle] = useState("Article");
  const [url, setUrl] = useState("");

  const refresh = async () => {
    const res = await fetch(`/api/projects/${projectId}/inputs`, { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setInputs(json.inputs ?? []);
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  async function addText() {
    if (!textBody.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/inputs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "text", title: textTitle, content_text: textBody }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      setError("Failed to add text input");
      return;
    }

    setTextBody("");
    refresh();
  }

  async function addUrl() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/inputs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "url", title: urlTitle, source_url: url }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      setError("Failed to add URL input");
      return;
    }

    setUrl("");
    refresh();
  }

  async function uploadFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      // 1) Get signed upload URL
      const uploadRes = await fetch(`/api/projects/${projectId}/inputs/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      const uploadJson = await uploadRes.json();

      if (!uploadJson.ok) {
        throw new Error(uploadJson.error ?? "Failed to get upload URL");
      }

      // 2) Upload to signed URL
      const { error: upErr } = await supabase.storage
        .from(uploadJson.bucket)
        .uploadToSignedUrl(uploadJson.path, uploadJson.token, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (upErr) {
        throw new Error(upErr.message);
      }

      // 3) Create project_input row
      const storagePath = `${uploadJson.bucket}/${uploadJson.path}`;
      const createRes = await fetch(`/api/projects/${projectId}/inputs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "file", title: file.name, storage_path: storagePath }),
      });
      const createJson = await createRes.json();

      if (!createJson.ok) {
        throw new Error(createJson.error ?? "Failed to create input");
      }

      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteInput(inputId: string) {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/projects/${projectId}/inputs/${inputId}`, {
      method: "DELETE",
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) {
      setError("Failed to delete input");
      return;
    }

    refresh();
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Project Inputs</h3>

      <div className="grid gap-6">
        {/* Add Text */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <FileText className="w-4 h-4" />
            Add Text
          </div>
          <input
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none"
          />
          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Paste notes, docs, or any text content..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none resize-none"
          />
          <button
            onClick={addText}
            disabled={loading || !textBody.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition text-sm font-medium"
          >
            Add Text
          </button>
        </div>

        {/* Add URL */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <LinkIcon className="w-4 h-4" />
            Add URL
          </div>
          <input
            value={urlTitle}
            onChange={(e) => setUrlTitle(e.target.value)}
            placeholder="Title"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none"
          />
          <button
            onClick={addUrl}
            disabled={loading || !url.trim()}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 transition text-sm font-medium"
          >
            Add URL
          </button>
        </div>

        {/* Upload File */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Upload className="w-4 h-4" />
            Upload File
          </div>
          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-white/20 hover:border-brand-500/50 cursor-pointer transition">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.currentTarget.value = "";
              }}
            />
            <Upload className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400">Drop or click to upload (PDF, DOCX, TXT)</span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Current Inputs */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Current Inputs</h4>
        <div className="space-y-2">
          {loading && inputs.length === 0 ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : inputs.length === 0 ? (
            <div className="text-gray-500 text-sm">No inputs yet. Add some content above.</div>
          ) : (
            inputs.map((input) => (
              <div
                key={input.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{input.title ?? input.type}</span>
                    <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded">
                      {input.type}
                    </span>
                  </div>
                  {input.type === "url" && input.source_url && (
                    <div className="text-sm text-gray-400 truncate mt-1">{input.source_url}</div>
                  )}
                  {input.type === "file" && input.storage_path && (
                    <div className="text-sm text-gray-400 truncate mt-1">
                      {input.storage_path.split("/").pop()}
                    </div>
                  )}
                  {input.type === "text" && input.content_text && (
                    <div className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {input.content_text}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteInput(input.id)}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

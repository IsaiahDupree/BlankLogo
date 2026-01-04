"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  X,
  FileVideo,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface VideoFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "pending" | "uploading" | "queued" | "processing" | "completed" | "failed";
  progress: number;
  jobId?: string;
  outputUrl?: string;
  error?: string;
}

interface BatchUploadProps {
  platform?: string;
  processingMode?: string;
  onComplete?: (results: VideoFile[]) => void;
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 10;
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];

export default function BatchUpload({ 
  platform = "sora", 
  processingMode = "inpaint",
  onComplete 
}: BatchUploadProps) {
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: VideoFile[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      // Check file count
      if (files.length + validFiles.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 500MB)`);
        return;
      }

      // Check for duplicates
      if (files.some((f) => f.name === file.name && f.size === file.size)) {
        errors.push(`${file.name}: Already added`);
        return;
      }

      validFiles.push({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        size: file.size,
        status: "pending",
        progress: 0,
      });
    });

    if (errors.length > 0) {
      setError(errors.join(", "));
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles]);
    }
  }, [files]);

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadFile = async (videoFile: VideoFile): Promise<VideoFile> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) => (f.id === videoFile.id ? { ...f, status: "uploading" as const, progress: 10 } : f))
    );

    const formData = new FormData();
    formData.append("file", videoFile.file);
    formData.append("platform", platform);
    formData.append("processing_mode", processingMode);

    const response = await fetch("/api/jobs/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    const result = await response.json();

    return {
      ...videoFile,
      status: "queued",
      progress: 100,
      jobId: result.job_id,
    };
  };

  const processBatch = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    const results: VideoFile[] = [];

    for (const file of files) {
      if (file.status !== "pending") continue;

      try {
        const result = await uploadFile(file);
        results.push(result);
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? result : f))
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Upload failed";
        const failedFile = {
          ...file,
          status: "failed" as const,
          error: errorMessage,
        };
        results.push(failedFile);
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? failedFile : f))
        );
      }
    }

    setIsProcessing(false);
    onComplete?.(results);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: VideoFile["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "uploading":
      case "processing":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case "queued":
        return <Play className="h-5 w-5 text-yellow-500" />;
      default:
        return <FileVideo className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const completedCount = files.filter((f) => f.status === "completed" || f.status === "queued").length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-muted-foreground/40"}
          ${files.length >= MAX_FILES ? "opacity-50 pointer-events-none" : "cursor-pointer"}
        `}
      >
        <input
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          className="hidden"
          id="batch-upload-input"
          disabled={files.length >= MAX_FILES}
        />
        <label htmlFor="batch-upload-input" className="cursor-pointer">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-1">
            Drop videos here or click to browse
          </p>
          <p className="text-sm text-muted-foreground">
            MP4, MOV, WebM, AVI up to 500MB each • Max {MAX_FILES} files
          </p>
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="rounded-lg border divide-y">
          {files.map((file) => (
            <div key={file.id} className="p-4 flex items-center gap-4">
              {getStatusIcon(file.status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  {file.jobId && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{file.jobId.slice(0, 12)}...</span>
                    </>
                  )}
                  {file.error && (
                    <>
                      <span>•</span>
                      <span className="text-red-500">{file.error}</span>
                    </>
                  )}
                </div>
                {(file.status === "uploading" || file.status === "processing") && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {file.status === "pending" && (
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-2 hover:bg-muted rounded-lg transition"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {pendingCount > 0 && <span>{pendingCount} pending</span>}
            {completedCount > 0 && (
              <span className="ml-2 text-green-500">{completedCount} queued</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFiles([])}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg border hover:bg-muted transition disabled:opacity-50"
            >
              Clear All
            </button>
            <button
              onClick={processBatch}
              disabled={isProcessing || pendingCount === 0}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Process {pendingCount} Video{pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

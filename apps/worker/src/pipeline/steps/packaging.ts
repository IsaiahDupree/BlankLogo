import type { PipelineContext } from "../index.js";
import type { Timeline } from "@canvascast/shared";
import fs from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import { createWriteStream } from "node:fs";

export async function runPackaging(
  ctx: PipelineContext,
  timeline: Timeline
): Promise<void> {
  const { supabase, userId, projectId, jobId, tmpDir } = ctx;

  // Create captions file (SRT format)
  const srtPath = path.join(tmpDir, "captions.srt");
  const srtContent = generateSRT(timeline);
  await fs.writeFile(srtPath, srtContent, "utf-8");

  // Upload captions
  const captionsStoragePath = `u_${userId}/p_${projectId}/outputs/captions.srt`;
  await supabase.storage
    .from("project-outputs")
    .upload(captionsStoragePath, await fs.readFile(srtPath), {
      contentType: "text/plain",
      upsert: true,
    });

  await supabase.from("assets").insert({
    user_id: userId,
    project_id: projectId,
    job_id: jobId,
    type: "captions",
    path: `project-outputs/${captionsStoragePath}`,
    meta: {},
  });

  // Create ZIP archive with all assets
  const zipPath = path.join(tmpDir, "assets.zip");
  await createZipArchive(zipPath, tmpDir, timeline);

  // Upload ZIP
  const zipStoragePath = `u_${userId}/p_${projectId}/outputs/assets.zip`;
  await supabase.storage
    .from("project-outputs")
    .upload(zipStoragePath, await fs.readFile(zipPath), {
      contentType: "application/zip",
      upsert: true,
    });

  await supabase.from("assets").insert({
    user_id: userId,
    project_id: projectId,
    job_id: jobId,
    type: "zip",
    path: `project-outputs/${zipStoragePath}`,
    meta: {},
  });

  console.log(`[${jobId}] Packaging complete: captions.srt + assets.zip`);
}

function generateSRT(timeline: Timeline): string {
  let srtIndex = 1;
  const lines: string[] = [];

  // Captions are now at timeline level, not segment level
  for (const caption of timeline.captions) {
    const startTimeMs = (caption.startFrame / timeline.fps) * 1000;
    const endTimeMs = (caption.endFrame / timeline.fps) * 1000;
    
    const startTime = formatSRTTime(startTimeMs);
    const endTime = formatSRTTime(endTimeMs);

    lines.push(`${srtIndex}`);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(caption.text);
    lines.push("");

    srtIndex++;
  }

  return lines.join("\n");
}

function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

function pad(num: number, size: number): string {
  return String(num).padStart(size, "0");
}

async function createZipArchive(
  zipPath: string,
  tmpDir: string,
  timeline: Timeline
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    // Add timeline.json
    const timelinePath = path.join(tmpDir, "timeline.json");
    archive.file(timelinePath, { name: "timeline.json" });

    // Add script.txt if exists
    const scriptPath = path.join(tmpDir, "script.txt");
    fs.access(scriptPath)
      .then(() => archive.file(scriptPath, { name: "script.txt" }))
      .catch(() => {});

    // Add captions.srt
    const srtPath = path.join(tmpDir, "captions.srt");
    archive.file(srtPath, { name: "captions.srt" });

    // Add any audio files
    fs.readdir(tmpDir)
      .then((files) => {
        for (const file of files) {
          if (file.endsWith(".mp3")) {
            archive.file(path.join(tmpDir, file), { name: `audio/${file}` });
          }
          if (file.endsWith(".png") || file.endsWith(".ppm")) {
            archive.file(path.join(tmpDir, file), { name: `images/${file}` });
          }
        }
        archive.finalize();
      })
      .catch((err) => reject(err));
  });
}

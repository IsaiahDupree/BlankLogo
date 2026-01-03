import "dotenv/config";
import { Worker as BullWorker, Job } from "bullmq";
import Redis from "ioredis";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const WORKER_ID = process.env.WORKER_ID ?? `worker-${Math.random().toString(16).slice(2, 10)}`;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const INPAINT_SERVICE_URL = process.env.INPAINT_SERVICE_URL || "http://localhost:8081";

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

type ProcessingMode = "crop" | "inpaint" | "auto";

interface JobData {
  jobId: string;
  inputUrl: string;
  inputFilename: string;
  cropPixels: number;
  cropPosition: "top" | "bottom" | "left" | "right";
  platform: string;
  processingMode: ProcessingMode;
  webhookUrl?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration",
      "-of", "json",
      filePath
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => { output += data.toString(); });
    ffprobe.stderr.on("data", (data) => { console.error(`ffprobe stderr: ${data}`); });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(output);
        const stream = parsed.streams[0];
        resolve({
          width: parseInt(stream.width),
          height: parseInt(stream.height),
          duration: parseFloat(stream.duration || "0"),
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`));
      }
    });
  });
}

async function removeWatermarkCrop(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string,
  videoInfo: VideoInfo
): Promise<{ mode: string }> {
  return new Promise((resolve, reject) => {
    let cropFilter: string;
    const { width, height } = videoInfo;

    switch (cropPosition) {
      case "top":
        cropFilter = `crop=${width}:${height - cropPixels}:0:${cropPixels}`;
        break;
      case "bottom":
        cropFilter = `crop=${width}:${height - cropPixels}:0:0`;
        break;
      case "left":
        cropFilter = `crop=${width - cropPixels}:${height}:${cropPixels}:0`;
        break;
      case "right":
        cropFilter = `crop=${width - cropPixels}:${height}:0:0`;
        break;
      default:
        cropFilter = `crop=${width}:${height - cropPixels}:0:0`;
    }

    console.log(`[Worker] Applying crop filter: ${cropFilter}`);

    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-vf", cropFilter,
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputPath
    ]);

    ffmpeg.stdout.on("data", (data) => { console.log(`ffmpeg: ${data}`); });
    ffmpeg.stderr.on("data", (data) => { console.log(`ffmpeg: ${data}`); });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve({ mode: "crop" });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

async function removeWatermarkInpaint(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string
): Promise<{ mode: string; watermarksDetected?: number }> {
  console.log(`[Worker] Using inpainting mode (YOLO + LAMA)`);
  
  // Read input file
  const fileBuffer = fs.readFileSync(inputPath);
  const blob = new Blob([fileBuffer], { type: "video/mp4" });
  
  // Create form data
  const formData = new FormData();
  formData.append("video", blob, "input.mp4");
  formData.append("mode", "inpaint");
  formData.append("crop_pixels", cropPixels.toString());
  formData.append("crop_position", cropPosition);
  
  // Call inpainting service
  const response = await fetch(`${INPAINT_SERVICE_URL}/process`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inpainting service error: ${response.status} - ${errorText}`);
  }
  
  // Save response to output file
  const outputBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(outputBuffer));
  
  console.log(`[Worker] Inpainting complete`);
  
  return { mode: "inpaint" };
}

async function removeWatermark(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string,
  videoInfo: VideoInfo,
  processingMode: ProcessingMode = "crop"
): Promise<{ mode: string; watermarksDetected?: number }> {
  if (processingMode === "inpaint" || processingMode === "auto") {
    try {
      // Try inpainting first
      return await removeWatermarkInpaint(inputPath, outputPath, cropPixels, cropPosition);
    } catch (error) {
      if (processingMode === "auto") {
        // Fallback to crop mode if inpainting fails
        console.log(`[Worker] Inpainting failed, falling back to crop mode: ${error}`);
        return await removeWatermarkCrop(inputPath, outputPath, cropPixels, cropPosition, videoInfo);
      }
      throw error;
    }
  }
  
  return await removeWatermarkCrop(inputPath, outputPath, cropPixels, cropPosition, videoInfo);
}

async function uploadToStorage(filePath: string, jobId: string, filename: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `processed/${jobId}/${filename}`;

  const { error } = await supabase.storage
    .from("bl_videos")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("bl_videos").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function sendWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[Worker] Webhook sent to ${webhookUrl}`);
  } catch (error) {
    console.error(`[Worker] Webhook failed:`, error);
  }
}

async function processJob(job: Job<JobData>): Promise<void> {
  const { jobId, inputUrl, inputFilename, cropPixels, cropPosition, processingMode = "crop", webhookUrl } = job.data;
  const startTime = Date.now();

  console.log(`[Worker] Processing job ${jobId}`);

  // Update status to processing
  await supabase
    .from("bl_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `blanklogo-${jobId}-`));
  const inputPath = path.join(tmpDir, "input.mp4");
  const outputFilename = inputFilename.replace(/\.[^.]+$/, "_clean.mp4");
  const outputPath = path.join(tmpDir, outputFilename);

  try {
    // Download input video
    console.log(`[Worker] Downloading video from ${inputUrl}`);
    await downloadFile(inputUrl, inputPath);
    const inputSize = fs.statSync(inputPath).size;

    // Get video info
    const videoInfo = await getVideoInfo(inputPath);
    console.log(`[Worker] Video info: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration}s`);

    // Update input info in database
    await supabase
      .from("bl_jobs")
      .update({
        input_size_bytes: inputSize,
        input_duration_sec: videoInfo.duration,
      })
      .eq("id", jobId);

    // Remove watermark
    console.log(`[Worker] Processing mode: ${processingMode}`);
    const processResult = await removeWatermark(inputPath, outputPath, cropPixels, cropPosition, videoInfo, processingMode);
    console.log(`[Worker] Processing complete with mode: ${processResult.mode}`);
    const outputSize = fs.statSync(outputPath).size;

    // Upload processed video
    console.log(`[Worker] Uploading processed video`);
    const outputUrl = await uploadToStorage(outputPath, jobId, outputFilename);

    const processingTime = Date.now() - startTime;

    // Update job as completed
    await supabase
      .from("bl_jobs")
      .update({
        status: "completed",
        output_url: outputUrl,
        output_filename: outputFilename,
        output_size_bytes: outputSize,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .eq("id", jobId);

    console.log(`[Worker] Job ${jobId} completed in ${processingTime}ms`);

    // Send webhook if configured
    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        job_id: jobId,
        status: "completed",
        output_url: outputUrl,
        processing_time_ms: processingTime,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Worker] Job ${jobId} failed:`, errorMessage);

    await supabase
      .from("bl_jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        job_id: jobId,
        status: "failed",
        error: errorMessage,
      });
    }

    throw error;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`[Worker] Failed to cleanup temp dir:`, e);
    }
  }
}

async function main(): Promise<void> {
  console.log(`[Worker] Starting BlankLogo worker ${WORKER_ID}`);
  console.log(`[Worker] Concurrency: ${CONCURRENCY}`);

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new BullWorker<JobData>(
    "watermark-removal",
    async (job) => {
      await processJob(job);
    },
    {
      connection: redis,
      concurrency: CONCURRENCY,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("[Worker] Worker error:", error);
  });

  console.log("[Worker] Worker is ready and listening for jobs");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[Worker] Shutting down...");
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});

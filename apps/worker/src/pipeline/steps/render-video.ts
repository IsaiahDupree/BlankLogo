import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const execAsync = promisify(exec);

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Use Remotion for full render, ffmpeg for quick E2E testing
const USE_REMOTION = process.env.USE_REMOTION === "true";

export async function renderVideo(
  ctx: PipelineContext
): Promise<StepResult<{ videoPath: string }>> {
  try {
    const timeline = ctx.artifacts.timeline;

    if (!timeline) {
      return createStepError("ERR_RENDER", "No timeline available for rendering");
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blanklogo-render-"));
    const outputPath = path.join(tempDir, "final.mp4");
    const timelineLocalPath = path.join(tempDir, "timeline.json");
    await fs.writeFile(timelineLocalPath, JSON.stringify(timeline, null, 2));

    if (USE_REMOTION) {
      // Use Remotion for production-quality video
      console.log("[Render] Using Remotion...");
      const remotionPath = path.resolve(__dirname, "../../../../packages/remotion");
      const remotionBin = path.join(remotionPath, "node_modules/.bin/remotion");
      
      const cmd = `"${remotionBin}" render src/index.ts BlankLogoVideo "${outputPath}" --props "${timelineLocalPath}" --codec h264 --crf 18`;
      console.log(`[Render] ${cmd}`);
      await execAsync(cmd, { cwd: remotionPath, timeout: 300000 });
    } else {
      // Use ffmpeg to composite images + audio
      console.log("[Render] Using ffmpeg (composite mode)...");
      const imagePaths = ctx.artifacts.imagePaths ?? [];
      const audioPath = ctx.artifacts.narrationPath;
      const durationMs = ctx.artifacts.narrationDurationMs ?? 60000;
      const durationSec = Math.ceil(durationMs / 1000);

      // Download all images locally
      const localImages: string[] = [];
      for (let i = 0; i < imagePaths.length; i++) {
        const storagePath = imagePaths[i];
        // Remove bucket prefix if present
        const cleanPath = storagePath.startsWith("project-assets/") 
          ? storagePath.slice("project-assets/".length) 
          : storagePath;
        
        const localPath = path.join(tempDir, `image_${i}.png`);
        const { data: imageData, error } = await supabase.storage.from("project-assets").download(cleanPath);
        
        if (imageData && !error) {
          await fs.writeFile(localPath, Buffer.from(await imageData.arrayBuffer()));
          localImages.push(localPath);
          console.log(`[Render] Downloaded image ${i + 1}/${imagePaths.length}`);
        }
      }

      // Download audio if available
      let localAudioPath: string | null = null;
      if (audioPath) {
        const cleanAudioPath = audioPath.startsWith("project-assets/") 
          ? audioPath.slice("project-assets/".length) 
          : audioPath;
        const audioLocalPath = path.join(tempDir, "narration.mp3");
        const { data: audioData, error } = await supabase.storage.from("project-assets").download(cleanAudioPath);
        if (audioData && !error) {
          await fs.writeFile(audioLocalPath, Buffer.from(await audioData.arrayBuffer()));
          localAudioPath = audioLocalPath;
          console.log("[Render] Downloaded audio narration");
        }
      }

      // Calculate duration per image
      const imageCount = localImages.length || 1;
      const durationPerImage = durationSec / imageCount;

      if (localImages.length === 0) {
        // No images - create black video with audio if available
        if (localAudioPath) {
          const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=1920x1080:d=${durationSec} -i "${localAudioPath}" -c:v libx264 -c:a aac -pix_fmt yuv420p -shortest "${outputPath}"`;
          await execAsync(cmd);
        } else {
          const cmd = `ffmpeg -y -f lavfi -i color=c=black:s=1920x1080:d=${durationSec} -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;
          await execAsync(cmd);
        }
      } else if (localImages.length === 1) {
        // Single image - loop it with audio
        if (localAudioPath) {
          const cmd = `ffmpeg -y -loop 1 -i "${localImages[0]}" -i "${localAudioPath}" -c:v libx264 -c:a aac -t ${durationSec} -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -shortest "${outputPath}"`;
          await execAsync(cmd);
        } else {
          const cmd = `ffmpeg -y -loop 1 -i "${localImages[0]}" -c:v libx264 -t ${durationSec} -pix_fmt yuv420p -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" "${outputPath}"`;
          await execAsync(cmd);
        }
      } else {
        // Multiple images - create slideshow with transitions
        // Create concat file for ffmpeg
        const concatFilePath = path.join(tempDir, "concat.txt");
        let concatContent = "";
        for (const img of localImages) {
          concatContent += `file '${img}'\nduration ${durationPerImage}\n`;
        }
        // Add last image again (required by concat demuxer)
        concatContent += `file '${localImages[localImages.length - 1]}'\n`;
        await fs.writeFile(concatFilePath, concatContent);

        // Create slideshow video
        const slideshowPath = path.join(tempDir, "slideshow.mp4");
        const slideCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" -c:v libx264 -pix_fmt yuv420p "${slideshowPath}"`;
        await execAsync(slideCmd);

        // Add audio if available
        if (localAudioPath) {
          const cmd = `ffmpeg -y -i "${slideshowPath}" -i "${localAudioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`;
          await execAsync(cmd);
        } else {
          await fs.copyFile(slideshowPath, outputPath);
        }
      }
      console.log(`[Render] Created video with ${localImages.length} images${localAudioPath ? " + audio" : ""}`);
    }
    
    console.log("[Render] Video created successfully");

    // Upload video to storage
    const videoStoragePath = `${ctx.outputPath}/final.mp4`;
    const videoData = await fs.readFile(outputPath);
    
    console.log(`[Render] Uploading video to storage: ${videoStoragePath}`);
    const { error: uploadError } = await supabase.storage
      .from("project-outputs")
      .upload(videoStoragePath, videoData, {
        upsert: true,
        contentType: "video/mp4",
      });
    
    if (uploadError) {
      console.error(`[Render] Storage upload failed: ${uploadError.message}`);
      throw new Error(`Failed to upload video: ${uploadError.message}`);
    }
    console.log("[Render] Video uploaded successfully");

    // Create asset record
    await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "video",
      path: videoStoragePath,
      meta: { durationMs: ctx.artifacts.narrationDurationMs },
    });

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    return createStepResult({ videoPath: videoStoragePath });
  } catch (error) {
    return createStepError(
      "ERR_RENDER",
      error instanceof Error ? error.message : "Unknown error rendering video"
    );
  }
}

import OpenAI from "openai";
import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset, heartbeat } from "../../lib/db";
import { uploadBuffer, downloadBuffer, type StorageRef } from "../../lib/storage";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createAdminSupabase();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TTS_PROVIDER = process.env.TTS_PROVIDER ?? "openai"; // "indextts" | "openai" | "mock"
const OPENAI_TTS_VOICE = (process.env.OPENAI_TTS_VOICE ?? "onyx") as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export async function generateVoice(
  ctx: PipelineContext
): Promise<StepResult<{ narrationPath: string; durationMs: number }>> {
  try {
    await insertJobEvent(ctx.jobId, "VOICE_GEN", "Starting voice generation...");
    await heartbeat(ctx.jobId);

    // Idempotency check: if narration already exists, skip
    const { data: existingAudio } = await supabase
      .from("assets")
      .select("path, meta")
      .eq("job_id", ctx.jobId)
      .eq("type", "audio")
      .maybeSingle();

    if (existingAudio?.path) {
      await insertJobEvent(ctx.jobId, "VOICE_GEN", "Narration already exists, skipping.");
      const durationMs = (existingAudio.meta as any)?.durationMs ?? 0;
      return createStepResult({ narrationPath: existingAudio.path, durationMs });
    }

    const script = ctx.artifacts.script;
    if (!script) {
      await insertJobEvent(ctx.jobId, "VOICE_GEN", "No script available", "error");
      return createStepError("ERR_TTS", "No script available for voice generation");
    }

    await insertJobEvent(ctx.jobId, "VOICE_GEN", `Generating audio for ${script.sections.length} sections...`);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "canvascast-tts-"));
    const sectionPaths: string[] = [];
    let totalDurationMs = 0;

    // Generate audio for each section
    for (let i = 0; i < script.sections.length; i++) {
      const section = script.sections[i];
      const sectionFileName = `section_${String(i).padStart(3, "0")}.mp3`;
      const localPath = path.join(tempDir, sectionFileName);

      let durationMs: number;

      // Heartbeat before each section
      await heartbeat(ctx.jobId);

      try {
        if (TTS_PROVIDER === "indextts" && process.env.HF_TOKEN) {
          // Use IndexTTS-2 via HuggingFace
          durationMs = await generateWithIndexTTS(section.narrationText, localPath, ctx.jobId);
        } else if (TTS_PROVIDER === "openai" || process.env.OPENAI_API_KEY) {
          // Use OpenAI TTS
          durationMs = await generateWithOpenAI(section.narrationText, localPath);
        } else {
          // Mock: generate silent audio
          durationMs = section.estimatedDurationMs;
          await generateMockAudio(durationMs, localPath);
        }
      } catch (ttsError) {
        // Fallback to OpenAI if IndexTTS fails
        if (TTS_PROVIDER === "indextts") {
          await insertJobEvent(ctx.jobId, "VOICE_GEN", `IndexTTS failed for section ${i}, falling back to OpenAI`, "warn");
          durationMs = await generateWithOpenAI(section.narrationText, localPath);
        } else {
          throw ttsError;
        }
      }

      totalDurationMs += durationMs;

      // Upload section audio
      const storagePath = `${ctx.basePath}/audio/${sectionFileName}`;
      const fileData = await fs.readFile(localPath);
      await supabase.storage
        .from("project-assets")
        .upload(storagePath, fileData, { upsert: true, contentType: "audio/mpeg" });

      sectionPaths.push(storagePath);

      // Log progress every 5 sections
      if ((i + 1) % 5 === 0 || i === script.sections.length - 1) {
        await insertJobEvent(ctx.jobId, "VOICE_GEN", `Generated ${i + 1}/${script.sections.length} sections`);
      }
    }

    // Merge sections into single narration file
    const narrationLocalPath = path.join(tempDir, "narration.mp3");
    await mergeAudioFiles(sectionPaths.map((_, i) => path.join(tempDir, `section_${String(i).padStart(3, "0")}.mp3`)), narrationLocalPath);

    // Upload merged narration
    const narrationPath = `${ctx.basePath}/audio/narration.mp3`;
    const narrationData = await fs.readFile(narrationLocalPath);
    await supabase.storage
      .from("project-assets")
      .upload(narrationPath, narrationData, { upsert: true, contentType: "audio/mpeg" });

    // Create asset record
    await upsertAsset({
      user_id: ctx.userId,
      project_id: ctx.projectId,
      job_id: ctx.jobId,
      type: "audio",
      path: `project-assets/${narrationPath}`,
      meta: { durationMs: totalDurationMs, sections: sectionPaths.length },
    });

    await insertJobEvent(ctx.jobId, "VOICE_GEN", `Voice generation complete: ${Math.round(totalDurationMs / 1000)}s total`);

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    ctx.artifacts.sectionAudioPaths = sectionPaths;

    return createStepResult({ narrationPath, durationMs: totalDurationMs });
  } catch (error) {
    return createStepError(
      "ERR_TTS",
      error instanceof Error ? error.message : "Unknown error generating voice"
    );
  }
}

async function generateWithOpenAI(text: string, outputPath: string): Promise<number> {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: OPENAI_TTS_VOICE,
    input: text,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);

  // Estimate duration (OpenAI TTS is ~150 words/min)
  const wordCount = text.split(/\s+/).length;
  return Math.round((wordCount / 150) * 60 * 1000);
}

async function generateWithIndexTTS(text: string, outputPath: string, jobId: string): Promise<number> {
  // IndexTTS-2 via HuggingFace Inference API
  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_SPACE = process.env.HF_INDEXTTS_SPACE ?? "Heartsync/IndexTTS-2";

  if (!HF_TOKEN) {
    throw new Error("HF_TOKEN not configured for IndexTTS");
  }

  // Get voice sample path if configured
  const voiceSamplePath = process.env.INDEXTTS_VOICE_SAMPLE;
  
  try {
    // Call HuggingFace Space API
    const response = await fetch(`https://${HF_SPACE.replace("/", "-")}.hf.space/api/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${HF_TOKEN}`,
      },
      body: JSON.stringify({
        data: [text, voiceSamplePath ?? null],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check for rate limit
      if (response.status === 429 || errorText.includes("quota")) {
        throw new Error(`IndexTTS rate limited: ${errorText}`);
      }
      throw new Error(`IndexTTS API error: ${response.status} ${errorText}`);
    }

    const result = await response.json() as { data?: Array<{ url?: string } | string> };
    const audioUrl = typeof result.data?.[0] === 'string' 
      ? result.data[0] 
      : (result.data?.[0] as { url?: string })?.url;

    if (!audioUrl) {
      throw new Error("No audio URL in IndexTTS response");
    }

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    await fs.writeFile(outputPath, audioBuffer);

    // Estimate duration based on word count (~150 WPM)
    const wordCount = text.split(/\s+/).length;
    return Math.round((wordCount / 150) * 60 * 1000);
  } catch (error) {
    console.error("IndexTTS error:", error);
    throw error;
  }
}

async function generateMockAudio(durationMs: number, outputPath: string): Promise<void> {
  // Generate silent audio using ffmpeg
  const durationSec = durationMs / 1000;
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-f", "lavfi",
      "-i", `anullsrc=r=44100:cl=stereo`,
      "-t", String(durationSec),
      "-q:a", "9",
      outputPath,
      "-y",
    ]);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    proc.on("error", reject);
  });
}

async function mergeAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No audio files to merge");
  }

  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  // Create concat list file
  const listPath = outputPath + ".txt";
  const listContent = inputPaths.map((p) => `file '${p}'`).join("\n");
  await fs.writeFile(listPath, listContent);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      "-c", "copy",
      outputPath,
      "-y",
    ]);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    proc.on("error", reject);
  });

  await fs.unlink(listPath);
}

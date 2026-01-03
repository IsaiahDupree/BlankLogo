import type { PipelineContext } from "../index.js";
import type { ScriptResult } from "./scripting.js";
import { generateTTS, type TTSProvider } from "./tts-providers/provider.js";
import fs from "node:fs/promises";
import path from "node:path";

export type TTSSegment = {
  segmentId: string;
  audioPath: string;
  storagePath: string;
  durationMs: number;
  captions: { startMs: number; endMs: number; text: string }[];
};

export type TTSResult = {
  segments: TTSSegment[];
  totalDurationMs: number;
};

export async function runTTS(
  ctx: PipelineContext,
  script: ScriptResult
): Promise<TTSResult> {
  const { supabase, userId, projectId, jobId, tmpDir } = ctx;
  const ttsProvider = (process.env.TTS_PROVIDER ?? "mock") as TTSProvider;

  // Check if user has a voice profile
  const { data: voiceProfile } = await supabase
    .from("voice_profiles")
    .select("id, voice_ref_path, status")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const voiceRefPath = voiceProfile?.voice_ref_path ?? undefined;

  const segments: TTSSegment[] = [];
  let totalDurationMs = 0;

  for (const seg of script.segments) {
    const audioOutputPath = path.join(tmpDir, `${seg.id}.mp3`);

    // Generate TTS with provider system (auto-fallback)
    const ttsResult = await generateTTS({
      provider: ttsProvider,
      text: seg.narrationText,
      outputPath: audioOutputPath,
      voiceRefPath,
      openaiVoice: "onyx",
      emotionPreset: seg.order === 0 ? "excited" : "neutral",
    });

    const audioPath = ttsResult.audioPath;
    const durationMs = ttsResult.durationMs;

    // Generate captions from text
    const captions = generateCaptions(seg.narrationText, durationMs);

    // Upload to storage
    const storagePath = `u_${userId}/p_${projectId}/audio/${seg.id}.mp3`;

    try {
      const audioData = await fs.readFile(audioPath);
      await supabase.storage.from("project-assets").upload(storagePath, audioData, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    } catch (err) {
      console.warn(`Audio upload failed for ${seg.id}:`, err);
    }

    // Log asset
    await supabase.from("assets").insert({
      user_id: userId,
      project_id: projectId,
      job_id: jobId,
      type: "audio",
      path: `project-assets/${storagePath}`,
      meta: { segmentId: seg.id, durationMs },
    });

    segments.push({
      segmentId: seg.id,
      audioPath,
      storagePath: `project-assets/${storagePath}`,
      durationMs,
      captions,
    });

    totalDurationMs += durationMs;
  }

  return { segments, totalDurationMs };
}

/**
 * Generate captions by splitting text into sentences
 */
function generateCaptions(
  text: string,
  durationMs: number
): { startMs: number; endMs: number; text: string }[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const captions: { startMs: number; endMs: number; text: string }[] = [];

  let currentMs = 0;
  const msPerSentence = durationMs / sentences.length;

  for (const sentence of sentences) {
    captions.push({
      startMs: Math.round(currentMs),
      endMs: Math.round(currentMs + msPerSentence),
      text: sentence.trim(),
    });
    currentMs += msPerSentence;
  }

  return captions;
}

import { generateWithIndexTTS } from "./indextts.js";
import { generateWithOpenAI } from "./openai.js";

export type TTSProvider = "indextts" | "openai" | "mock";

export interface TTSOptions {
  provider: TTSProvider;
  text: string;
  outputPath: string;
  voiceRefPath?: string; // For IndexTTS voice cloning
  openaiVoice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  emotionPreset?: "neutral" | "excited" | "serious" | "friendly";
}

export interface TTSResult {
  audioPath: string;
  durationMs: number;
  provider: TTSProvider;
}

/**
 * Generate TTS audio with automatic fallback
 * Priority: IndexTTS (voice cloning) → OpenAI TTS → Mock
 */
export async function generateTTS(options: TTSOptions): Promise<TTSResult> {
  const { provider, text, outputPath, voiceRefPath } = options;

  // Try IndexTTS first if voice reference is provided
  if ((provider === "indextts" || voiceRefPath) && process.env.HF_TOKEN) {
    try {
      console.log(`[TTS] Attempting IndexTTS-2 voice cloning...`);
      const result = await generateWithIndexTTS({
        text,
        outputPath,
        voiceRefPath: voiceRefPath!,
        emotionPreset: options.emotionPreset,
      });
      return { ...result, provider: "indextts" };
    } catch (err) {
      console.warn(`[TTS] IndexTTS failed, falling back to OpenAI:`, err);
    }
  }

  // Fallback to OpenAI TTS
  if (provider !== "mock" && process.env.OPENAI_API_KEY) {
    try {
      console.log(`[TTS] Using OpenAI TTS...`);
      const result = await generateWithOpenAI({
        text,
        outputPath,
        voice: options.openaiVoice ?? "onyx",
      });
      return { ...result, provider: "openai" };
    } catch (err) {
      console.warn(`[TTS] OpenAI TTS failed, using mock:`, err);
    }
  }

  // Final fallback: mock audio
  console.log(`[TTS] Using mock TTS (no API keys configured)`);
  return generateMockTTS(text, outputPath);
}

async function generateMockTTS(
  text: string,
  outputPath: string
): Promise<TTSResult> {
  const fs = await import("node:fs/promises");

  // Estimate duration: ~150 words per minute
  const words = text.split(/\s+/).length;
  const durationMs = Math.round((words / 150) * 60 * 1000);

  // Create minimal MP3 header (silent placeholder)
  const silentMp3 = Buffer.from([
    0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  await fs.writeFile(outputPath, silentMp3);

  return {
    audioPath: outputPath,
    durationMs,
    provider: "mock",
  };
}

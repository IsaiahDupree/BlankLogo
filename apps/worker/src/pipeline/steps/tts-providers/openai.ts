import fs from "node:fs/promises";
import OpenAI from "openai";

interface OpenAITTSOptions {
  text: string;
  outputPath: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  model?: "tts-1" | "tts-1-hd";
  speed?: number;
}

interface OpenAITTSResult {
  audioPath: string;
  durationMs: number;
}

/**
 * Generate TTS using OpenAI's TTS API
 */
export async function generateWithOpenAI(
  options: OpenAITTSOptions
): Promise<OpenAITTSResult> {
  const {
    text,
    outputPath,
    voice = "onyx",
    model = "tts-1",
    speed = 1.0,
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Generate speech
  const response = await openai.audio.speech.create({
    model,
    voice,
    input: text,
    speed,
    response_format: "mp3",
  });

  // Save to file
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);

  // Estimate duration: ~150 words per minute, adjusted by speed
  const words = text.split(/\s+/).length;
  const durationMs = Math.round(((words / 150) * 60 * 1000) / speed);

  return {
    audioPath: outputPath,
    durationMs,
  };
}

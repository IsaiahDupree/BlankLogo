import fs from "node:fs/promises";
import path from "node:path";

interface IndexTTSOptions {
  text: string;
  outputPath: string;
  voiceRefPath: string;
  emotionPreset?: "neutral" | "excited" | "serious" | "friendly";
}

interface IndexTTSResult {
  audioPath: string;
  durationMs: number;
}

// Emotion presets mapped to IndexTTS-2 vectors
const EMOTION_PRESETS = {
  neutral: { vec1: 0, vec2: 0, vec3: 0, vec4: 0, vec5: 0, vec6: 0, vec7: 0, vec8: 0.8 },
  excited: { vec1: 0.8, vec2: 0, vec3: 0, vec4: 0, vec5: 0, vec6: 0, vec7: 0.3, vec8: 0.2 },
  serious: { vec1: 0, vec2: 0.2, vec3: 0, vec4: 0, vec5: 0, vec6: 0, vec7: 0, vec8: 0.6 },
  friendly: { vec1: 0.5, vec2: 0, vec3: 0, vec4: 0, vec5: 0, vec6: 0, vec7: 0, vec8: 0.5 },
};

/**
 * Generate TTS using IndexTTS-2 on Hugging Face (voice cloning)
 * 
 * Requires: pip install gradio_client
 * Uses child process to call Python script for Gradio client
 */
export async function generateWithIndexTTS(
  options: IndexTTSOptions
): Promise<IndexTTSResult> {
  const { text, outputPath, voiceRefPath, emotionPreset = "neutral" } = options;

  // Verify voice reference exists
  try {
    await fs.access(voiceRefPath);
  } catch {
    throw new Error(`Voice reference file not found: ${voiceRefPath}`);
  }

  const emotion = EMOTION_PRESETS[emotionPreset];

  // Create Python script for IndexTTS-2 call
  const scriptPath = path.join(path.dirname(outputPath), "_indextts_call.py");
  const pythonScript = `
import sys
import json
from gradio_client import Client, handle_file

try:
    client = Client("IndexTeam/IndexTTS-2-Demo")
    
    result = client.predict(
        emo_control_method="Same as the voice reference",
        prompt=handle_file("${voiceRefPath.replace(/\\/g, "\\\\")}"),
        text="""${text.replace(/"/g, '\\"').replace(/\n/g, "\\n")}""",
        emo_ref_path=handle_file("${voiceRefPath.replace(/\\/g, "\\\\")}"),
        emo_weight=0.8,
        vec1=${emotion.vec1}, vec2=${emotion.vec2}, vec3=${emotion.vec3}, vec4=${emotion.vec4},
        vec5=${emotion.vec5}, vec6=${emotion.vec6}, vec7=${emotion.vec7}, vec8=${emotion.vec8},
        emo_text="",
        emo_random=False,
        max_text_tokens_per_segment=120,
        param_16=True,
        param_17=0.8,
        param_18=30,
        param_19=0.8,
        param_20=0,
        param_21=3,
        param_22=10,
        param_23=1500,
        api_name="/gen_single"
    )
    
    # Handle dict response
    if isinstance(result, dict):
        audio_path = result.get("value", result)
    else:
        audio_path = result
    
    # Copy to output path
    import shutil
    shutil.copy(audio_path, "${outputPath.replace(/\\/g, "\\\\")}")
    
    print(json.dumps({"success": True, "path": "${outputPath.replace(/\\/g, "\\\\")}"}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)
`;

  await fs.writeFile(scriptPath, pythonScript, "utf-8");

  try {
    const { spawn } = await import("node:child_process");

    const result = await new Promise<{ success: boolean; path?: string; error?: string }>(
      (resolve, reject) => {
        const proc = spawn("python3", [scriptPath], {
          env: { ...process.env, HF_TOKEN: process.env.HF_TOKEN },
        });

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`IndexTTS failed: ${stderr || stdout}`));
            return;
          }

          try {
            // Find JSON in output
            const jsonMatch = stdout.match(/\{.*\}/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              reject(new Error(`Invalid IndexTTS response: ${stdout}`));
            }
          } catch {
            reject(new Error(`Failed to parse IndexTTS response: ${stdout}`));
          }
        });

        proc.on("error", (err) => {
          reject(new Error(`Failed to spawn Python: ${err.message}`));
        });
      }
    );

    if (!result.success) {
      throw new Error(result.error ?? "IndexTTS generation failed");
    }

    // Estimate duration from text
    const words = text.split(/\s+/).length;
    const durationMs = Math.round((words / 150) * 60 * 1000);

    return {
      audioPath: outputPath,
      durationMs,
    };
  } finally {
    // Clean up Python script
    try {
      await fs.unlink(scriptPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

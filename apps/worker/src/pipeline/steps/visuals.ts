import type { PipelineContext } from "../index.js";
import type { ScriptResult, ScriptSegment } from "./scripting.js";
import fs from "node:fs/promises";
import path from "node:path";

export type VisualSegment = {
  segmentId: string;
  images: {
    path: string;
    storagePath: string;
    motion: "kenburns_in" | "kenburns_out" | "pan_left" | "pan_right" | "none";
  }[];
};

export type VisualsResult = {
  segments: VisualSegment[];
};

export async function runVisuals(
  ctx: PipelineContext,
  script: ScriptResult
): Promise<VisualsResult> {
  const { supabase, userId, projectId, jobId, tmpDir } = ctx;
  const useOpenAI = !!process.env.OPENAI_API_KEY;

  const segments: VisualSegment[] = [];

  for (const seg of script.segments) {
    let imagePath: string;

    if (useOpenAI) {
      imagePath = await generateImageOpenAI(seg, tmpDir);
    } else {
      imagePath = await generatePlaceholderImage(seg, tmpDir);
    }

    // Upload to storage
    const storagePath = `u_${userId}/p_${projectId}/images/${seg.id}_01.png`;

    try {
      const imageData = await fs.readFile(imagePath);
      await supabase.storage.from("project-assets").upload(storagePath, imageData, {
        contentType: "image/png",
        upsert: true,
      });
    } catch (err) {
      console.warn(`Image upload failed for ${seg.id}:`, err);
    }

    // Log asset
    await supabase.from("assets").insert({
      user_id: userId,
      project_id: projectId,
      job_id: jobId,
      type: "image",
      path: `project-assets/${storagePath}`,
      meta: { segmentId: seg.id },
    });

    // Assign motion based on segment order
    const motions: VisualSegment["images"][0]["motion"][] = [
      "kenburns_in",
      "kenburns_out",
      "pan_left",
      "pan_right",
    ];
    const motion = motions[seg.order % motions.length];

    segments.push({
      segmentId: seg.id,
      images: [
        {
          path: imagePath,
          storagePath: `project-assets/${storagePath}`,
          motion,
        },
      ],
    });
  }

  return { segments };
}

async function generateImageOpenAI(
  segment: ScriptSegment,
  tmpDir: string
): Promise<string> {
  const { default: OpenAI } = await import("openai");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: segment.visualPrompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image URL in response");
    }

    // Download the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    const imagePath = path.join(tmpDir, `${segment.id}_01.png`);
    await fs.writeFile(imagePath, imageBuffer);

    return imagePath;
  } catch (err) {
    console.warn(`OpenAI image generation failed for ${segment.id}:`, err);
    return generatePlaceholderImage(segment, tmpDir);
  }
}

async function generatePlaceholderImage(
  segment: ScriptSegment,
  tmpDir: string
): Promise<string> {
  // Create a simple placeholder PNG (1920x1080 gradient)
  const imagePath = path.join(tmpDir, `${segment.id}_01.png`);

  // Create a minimal PNG with a gradient-like pattern
  // In production, you'd use a proper image library or service
  const width = 1920;
  const height = 1080;

  // Create a simple PPM image (easier to generate) and note path
  // For actual production, use sharp or canvas library
  const ppmPath = path.join(tmpDir, `${segment.id}_01.ppm`);

  const header = `P6\n${width} ${height}\n255\n`;
  const pixels = Buffer.alloc(width * height * 3);

  // Generate a gradient based on segment order
  const baseHue = (segment.order * 60) % 360;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const t = y / height;

      // Dark gradient from top to bottom
      const r = Math.floor(20 + t * 30 + (baseHue === 0 ? 20 : 0));
      const g = Math.floor(20 + t * 30 + (baseHue === 120 ? 20 : 0));
      const b = Math.floor(40 + t * 40 + (baseHue === 240 ? 20 : 0));

      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }

  await fs.writeFile(ppmPath, Buffer.concat([Buffer.from(header), pixels]));

  // For now, use PPM as placeholder (Remotion should handle it)
  // In production, convert to PNG using sharp/imagemagick
  return ppmPath;
}

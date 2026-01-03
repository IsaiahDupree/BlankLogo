import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 2;
const CONCURRENT_LIMIT = 3;

export async function generateImages(
  ctx: PipelineContext
): Promise<StepResult<{ imagePaths: string[] }>> {
  try {
    const plan = ctx.artifacts.visualPlan;
    if (!plan || plan.slots.length === 0) {
      return createStepError("ERR_IMAGE_GEN", "No visual plan available");
    }

    const imagePaths: string[] = [];
    let failedCount = 0;
    let lastSuccessPath = "";

    // Process in batches to respect rate limits
    for (let i = 0; i < plan.slots.length; i += CONCURRENT_LIMIT) {
      const batch = plan.slots.slice(i, i + CONCURRENT_LIMIT);
      
      const results = await Promise.allSettled(
        batch.map(async (slot, batchIdx) => {
          const slotIdx = i + batchIdx;
          const fileName = `img_${String(slotIdx).padStart(3, "0")}.png`;
          const storagePath = `${ctx.basePath}/visuals/images/${fileName}`;

          for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            try {
              const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: slot.prompt,
                n: 1,
                size: "1792x1024",
                quality: "standard",
              });

              const imageUrl = response.data?.[0]?.url;
              if (!imageUrl) throw new Error("No image URL returned");

              // Download and upload to storage
              const imageResponse = await fetch(imageUrl);
              const imageBuffer = await imageResponse.arrayBuffer();

              await supabase.storage
                .from("project-assets")
                .upload(storagePath, new Uint8Array(imageBuffer), {
                  upsert: true,
                  contentType: "image/png",
                });

              return storagePath;
            } catch (error) {
              if (retry === MAX_RETRIES) throw error;
              await new Promise((r) => setTimeout(r, 2000 * (retry + 1)));
            }
          }
          throw new Error("Max retries exceeded");
        })
      );

      // Collect results
      for (const result of results) {
        if (result.status === "fulfilled") {
          imagePaths.push(result.value);
          lastSuccessPath = result.value;
        } else {
          failedCount++;
          // Use last successful image as fallback
          if (lastSuccessPath) {
            imagePaths.push(lastSuccessPath);
          }
          console.warn(`Image generation failed: ${result.reason}`);
        }
      }
    }

    // Fail if too many images failed
    if (failedCount > plan.slots.length * 0.5) {
      return createStepError("ERR_IMAGE_GEN", `Too many images failed: ${failedCount}/${plan.slots.length}`);
    }

    // Log results
    console.log(`Generated ${imagePaths.length} images (${failedCount} failed, used fallback)`);

    return createStepResult({ imagePaths });
  } catch (error) {
    return createStepError(
      "ERR_IMAGE_GEN",
      error instanceof Error ? error.message : "Unknown error generating images"
    );
  }
}

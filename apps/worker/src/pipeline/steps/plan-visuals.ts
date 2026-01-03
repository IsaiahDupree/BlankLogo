import { createClient } from "@supabase/supabase-js";
import type { PipelineContext, StepResult, VisualPlan, VisualSlot, WhisperSegment } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CADENCE_MS = 8000; // Change image every 8 seconds

export async function planVisuals(
  ctx: PipelineContext
): Promise<StepResult<{ plan: VisualPlan }>> {
  try {
    const script = ctx.artifacts.script;
    const segments = ctx.artifacts.whisperSegments;

    if (!script || !segments || segments.length === 0) {
      return createStepError("ERR_VISUAL_PLAN", "Missing script or whisper segments");
    }

    // Determine cadence based on image density setting
    let cadenceMs = DEFAULT_CADENCE_MS;
    if (ctx.project.image_density === "low") cadenceMs = 12000;
    if (ctx.project.image_density === "high") cadenceMs = 5000;

    const slots: VisualSlot[] = [];
    let slotId = 0;

    // Group segments into visual slots
    let currentSlotStart = 0;
    let currentText: string[] = [];

    for (const seg of segments) {
      const segStartMs = seg.start * 1000;
      const segEndMs = seg.end * 1000;

      currentText.push(seg.text);

      // Check if we should create a new slot
      if (segEndMs - currentSlotStart >= cadenceMs || seg === segments[segments.length - 1]) {
        // Find matching script section for visual keywords
        const sectionIdx = Math.floor(slotId / 3) % script.sections.length;
        const section = script.sections[sectionIdx];

        const prompt = buildImagePrompt(
          currentText.join(" "),
          section?.visualKeywords ?? [],
          ctx.project.visual_preset_id ?? "photorealistic"
        );

        slots.push({
          id: `slot_${String(slotId).padStart(3, "0")}`,
          startMs: currentSlotStart,
          endMs: segEndMs,
          text: currentText.join(" "),
          prompt,
          stylePreset: ctx.project.visual_preset_id ?? "photorealistic",
        });

        slotId++;
        currentSlotStart = segEndMs;
        currentText = [];
      }
    }

    const plan: VisualPlan = {
      slots,
      totalImages: slots.length,
      cadenceMs,
    };

    // Upload plan
    const planPath = `${ctx.basePath}/visuals/plan.json`;
    await supabase.storage
      .from("project-assets")
      .upload(planPath, new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }), { upsert: true });

    return createStepResult({ plan });
  } catch (error) {
    return createStepError(
      "ERR_VISUAL_PLAN",
      error instanceof Error ? error.message : "Unknown error planning visuals"
    );
  }
}

function buildImagePrompt(text: string, keywords: string[], stylePreset: string): string {
  const stylePrefix = getStylePrefix(stylePreset);
  const keywordStr = keywords.length > 0 ? keywords.join(", ") : "";
  
  // Extract key concepts from text
  const cleanText = text.replace(/[^\w\s]/g, "").substring(0, 100);
  
  return `${stylePrefix}${keywordStr ? keywordStr + ", " : ""}scene depicting: ${cleanText}`;
}

function getStylePrefix(preset: string): string {
  const prefixes: Record<string, string> = {
    photorealistic: "photorealistic, high quality, cinematic lighting, ",
    illustration: "digital illustration, artistic, vibrant colors, ",
    minimalist: "minimalist, clean, simple, modern, ",
    cinematic: "cinematic, dramatic lighting, film still, 35mm, ",
    anime: "anime style, manga, Japanese animation, ",
  };
  return prefixes[preset] ?? prefixes.photorealistic;
}

import type { PipelineContext } from "../index.js";
import fs from "node:fs/promises";
import path from "node:path";

export type ScriptSegment = {
  id: string;
  order: number;
  narrationText: string;
  visualPrompt: string;
  sfxCues: string[];
};

export type ScriptResult = {
  title: string;
  segments: ScriptSegment[];
  scriptPath: string;
};

// Niche prompt templates
const NICHE_PROMPTS: Record<string, { tone: string; structure: string }> = {
  motivation: {
    tone: "Inspiring, direct, powerful. Use second-person perspective.",
    structure: "Hook → Challenge → Story Beat → Lesson → CTA",
  },
  explainer: {
    tone: "Clear, educational, friendly. Break complex ideas into simple steps.",
    structure: "Hook → Problem → Solution Steps → Recap → CTA",
  },
  facts: {
    tone: "Intriguing, surprising, fast-paced. Each fact should hook attention.",
    structure: "Hook → Fact 1-5 → Mind-blowing conclusion → CTA",
  },
  documentary: {
    tone: "Narrative, immersive, journalistic. Build tension and reveal.",
    structure: "Hook → Setup → Rising Action → Climax → Resolution",
  },
  finance: {
    tone: "Authoritative, practical, trustworthy. Focus on actionable advice.",
    structure: "Hook → Problem → Strategy → Examples → CTA",
  },
  tech: {
    tone: "Enthusiastic, informative, accessible. Make tech relatable.",
    structure: "Hook → What → Why → How → Future Implications",
  },
  default: {
    tone: "Engaging, conversational, informative.",
    structure: "Hook → Main Points → Conclusion → CTA",
  },
};

export async function runScripting(ctx: PipelineContext): Promise<ScriptResult> {
  const { supabase, projectId, tmpDir } = ctx;

  // Get project details
  const { data: project, error } = await supabase
    .from("projects")
    .select("title, niche_preset, target_minutes")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const nicheConfig = NICHE_PROMPTS[project.niche_preset] ?? NICHE_PROMPTS.default;
  const targetMinutes = project.target_minutes ?? 10;

  // For MVP: Generate mock script segments
  // TODO: Replace with OpenAI/Claude API call for real script generation
  const segments = generateMockScript(project.title, nicheConfig, targetMinutes);

  // Save script to file
  const scriptContent = segments
    .map((s, i) => `## Section ${i + 1}: ${s.id}\n\n${s.narrationText}\n`)
    .join("\n---\n\n");

  const scriptPath = path.join(tmpDir, "script.txt");
  await fs.writeFile(scriptPath, scriptContent, "utf-8");

  // Upload to storage
  const storagePath = `u_${ctx.userId}/p_${projectId}/script/script.txt`;
  const { error: uploadErr } = await supabase.storage
    .from("project-assets")
    .upload(storagePath, await fs.readFile(scriptPath), {
      contentType: "text/plain",
      upsert: true,
    });

  if (uploadErr) {
    console.warn("Script upload failed:", uploadErr.message);
  }

  // Log asset
  await supabase.from("assets").insert({
    user_id: ctx.userId,
    project_id: projectId,
    job_id: ctx.jobId,
    type: "script",
    path: `project-assets/${storagePath}`,
    meta: { segments: segments.length },
  });

  return {
    title: project.title,
    segments,
    scriptPath,
  };
}

function generateMockScript(
  title: string,
  nicheConfig: { tone: string; structure: string },
  targetMinutes: number
): ScriptSegment[] {
  // Estimate ~150 words per minute of speech
  const wordsPerMinute = 150;
  const totalWords = targetMinutes * wordsPerMinute;
  const segmentCount = Math.max(3, Math.min(8, Math.floor(targetMinutes / 1.5)));
  const wordsPerSegment = Math.floor(totalWords / segmentCount);

  const segments: ScriptSegment[] = [];

  // Generate segments based on structure
  const structureParts = nicheConfig.structure.split(" → ");

  for (let i = 0; i < segmentCount; i++) {
    const structurePart = structureParts[i % structureParts.length];
    const segmentId = `seg_${String(i + 1).padStart(3, "0")}`;

    // Mock narration text
    const narrationText = generateMockNarration(title, structurePart, wordsPerSegment, i === 0);

    // Mock visual prompt
    const visualPrompt = generateVisualPrompt(title, structurePart, i);

    segments.push({
      id: segmentId,
      order: i,
      narrationText,
      visualPrompt,
      sfxCues: i === 0 ? ["whoosh"] : [],
    });
  }

  return segments;
}

function generateMockNarration(
  title: string,
  structurePart: string,
  targetWords: number,
  isHook: boolean
): string {
  if (isHook) {
    return `What if I told you that ${title.toLowerCase()} could change everything you thought you knew? In the next few minutes, I'm going to show you exactly why this matters and how you can take action today. Stay with me, because what I'm about to share might just transform your perspective.`;
  }

  const templates = [
    `Now let's dive into the ${structurePart.toLowerCase()}. This is where things get really interesting. The key insight here is that most people miss this crucial point. But once you understand it, everything starts to make sense.`,
    `Here's what makes this ${structurePart.toLowerCase()} so powerful. When you apply these principles, you'll start seeing results almost immediately. The research backs this up, and real-world examples prove it works.`,
    `Let me break down the ${structurePart.toLowerCase()} step by step. First, you need to understand the foundation. Then, we'll build on that with practical strategies you can implement right away.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

function generateVisualPrompt(title: string, structurePart: string, index: number): string {
  const styles = [
    "cinematic, dramatic lighting, 8k resolution",
    "modern, minimalist, clean design",
    "vibrant colors, dynamic composition",
    "moody, atmospheric, professional",
  ];

  const style = styles[index % styles.length];

  return `Create an image for: "${title}" - ${structurePart}. Style: ${style}. No text in image.`;
}

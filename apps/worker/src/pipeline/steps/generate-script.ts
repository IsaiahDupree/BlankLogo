import * as fs from "fs/promises";
import * as path from "path";
import OpenAI from "openai";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset } from "../../lib/db";
import { uploadBuffer, downloadBuffer, type StorageRef } from "../../lib/storage";
import type { PipelineContext, StepResult, Script, ScriptSection } from "../types";
import { createStepResult, createStepError } from "../types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createAdminSupabase();

const WORDS_PER_MINUTE = 150;

export async function generateScript(
  ctx: PipelineContext
): Promise<StepResult<{ script: Script }>> {
  try {
    await insertJobEvent(ctx.jobId, "SCRIPTING", "Generating script from merged inputs...");

    const targetWords = ctx.project.target_minutes * WORDS_PER_MINUTE;
    const mergedText = ctx.artifacts.mergedInputText ?? "";

    if (!mergedText.trim()) {
      await insertJobEvent(ctx.jobId, "SCRIPTING", "No merged input text available", "error");
      return createStepError("ERR_SCRIPT_GEN", "No merged input text available");
    }

    // Generate script with GPT-4o (supports JSON mode)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional scriptwriter for YouTube videos. 
Create engaging, educational scripts with clear sections.
Each section should be 20-60 seconds when spoken.
Include visual cues in [brackets] for the video editor.
Target word count: ${targetWords} words (approximately ${ctx.project.target_minutes} minutes).
Write in a conversational, engaging tone appropriate for the "${ctx.project.niche_preset}" niche.`,
        },
        {
          role: "user",
          content: `Create a video script based on this content:

${mergedText}

Return a JSON object with this structure:
{
  "title": "Video Title",
  "sections": [
    {
      "id": "section_001",
      "order": 0,
      "headline": "Section Headline",
      "narrationText": "The full narration text for this section...",
      "visualKeywords": ["keyword1", "keyword2"],
      "onScreenText": "Optional on-screen text",
      "paceHint": "normal"
    }
  ]
}

Include 5-8 sections. Make the first section a strong hook.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createStepError("ERR_SCRIPT_GEN", "No content returned from OpenAI");
    }

    const parsed = JSON.parse(content);

    // Build script object
    const sections: ScriptSection[] = parsed.sections.map((s: any, idx: number) => ({
      id: s.id ?? `section_${String(idx).padStart(3, "0")}`,
      order: s.order ?? idx,
      headline: s.headline ?? "",
      narrationText: s.narrationText ?? "",
      visualKeywords: s.visualKeywords ?? [],
      onScreenText: s.onScreenText,
      paceHint: s.paceHint ?? "normal",
      estimatedDurationMs: Math.round((s.narrationText?.split(/\s+/).length ?? 0) / WORDS_PER_MINUTE * 60 * 1000),
    }));

    const totalWordCount = sections.reduce(
      (acc, s) => acc + (s.narrationText?.split(/\s+/).length ?? 0),
      0
    );

    const script: Script = {
      title: parsed.title ?? ctx.project.title,
      sections,
      totalWordCount,
      estimatedDurationMs: Math.round(totalWordCount / WORDS_PER_MINUTE * 60 * 1000),
      generatedAt: new Date().toISOString(),
    };

    // Upload script
    const scriptPath = `${ctx.basePath}/script/script.json`;
    await supabase.storage
      .from("project-assets")
      .upload(scriptPath, new Blob([JSON.stringify(script, null, 2)], { type: "application/json" }), {
        upsert: true,
      });

    // Create asset record
    await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "script",
      path: scriptPath,
      meta: { sections: sections.length, wordCount: totalWordCount },
    });

    return createStepResult({ script });
  } catch (error) {
    return createStepError(
      "ERR_SCRIPT_GEN",
      error instanceof Error ? error.message : "Unknown error generating script"
    );
  }
}

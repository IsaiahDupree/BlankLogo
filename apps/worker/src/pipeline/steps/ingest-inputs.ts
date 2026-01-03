import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { createAdminSupabase } from "../../lib/supabase";
import { insertJobEvent, upsertAsset } from "../../lib/db";
import { uploadFile, downloadFile, type StorageRef } from "../../lib/storage";
import type { PipelineContext, StepResult, ProjectInput } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createAdminSupabase();

function sha1(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryExtractTextFromFile(localPath: string): Promise<string> {
  const ext = path.extname(localPath).toLowerCase();

  if (ext === ".txt" || ext === ".md") {
    return fs.readFile(localPath, "utf8");
  }

  if (ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buf = await fs.readFile(localPath);
      const out = await pdfParse(buf);
      return out?.text ?? "";
    } catch {
      return "";
    }
  }

  if (ext === ".docx") {
    try {
      const mammoth = await import("mammoth");
      const buf = await fs.readFile(localPath);
      const out = await mammoth.extractRawText({ buffer: buf });
      return out?.value ?? "";
    } catch {
      return "";
    }
  }

  return "";
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text();
  const clipped = text.slice(0, 1_500_000);

  if (ct.includes("text/html")) return stripHtml(clipped);
  return clipped;
}

export async function ingestInputs(
  ctx: PipelineContext
): Promise<StepResult<{ mergedText: string }>> {
  try {
    // Fetch all project inputs
    const { data: inputs, error } = await supabase
      .from("project_inputs")
      .select("*")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: true });

    if (error) {
      return createStepError("ERR_INPUT_FETCH", `Failed to fetch inputs: ${error.message}`);
    }

    const textParts: string[] = [];

    // Add project context
    textParts.push(`# Project: ${ctx.project.title}`);
    textParts.push(`Niche: ${ctx.project.niche_preset}`);
    textParts.push(`Target Duration: ${ctx.project.target_minutes} minutes`);
    textParts.push("");

    // Process each input
    for (const input of (inputs as ProjectInput[]) ?? []) {
      if (input.type === "text" && input.content_text) {
        textParts.push(`## Input: ${input.title ?? "User Text"}`);
        textParts.push(input.content_text);
        textParts.push("");
      } else if (input.type === "file" && input.storage_path) {
        // Download and extract text from file
        const { data: fileData, error: fileError } = await supabase.storage
          .from("project-assets")
          .download(input.storage_path);

        if (fileError) {
          console.warn(`Failed to download file ${input.storage_path}: ${fileError.message}`);
          continue;
        }

        // For now, assume text files. TODO: Add PDF/DOCX extraction
        const text = await fileData.text();
        textParts.push(`## Input: ${input.title ?? "Uploaded File"}`);
        textParts.push(text);
        textParts.push("");
      } else if (input.type === "url" && input.meta?.extracted_text) {
        textParts.push(`## Input: ${input.title ?? "URL Content"}`);
        textParts.push(input.meta.extracted_text as string);
        textParts.push("");
      }
    }

    // If no inputs found, use project title as seed
    if (textParts.length <= 4) {
      textParts.push(`## Topic`);
      textParts.push(`Create a video about: ${ctx.project.title}`);
    }

    const mergedText = textParts.join("\n");

    // Upload merged input
    const mergedPath = `${ctx.basePath}/inputs/merged_input.txt`;
    await supabase.storage
      .from("project-assets")
      .upload(mergedPath, new Blob([mergedText], { type: "text/plain" }), {
        upsert: true,
      });

    return createStepResult({ mergedText });
  } catch (error) {
    return createStepError(
      "ERR_INPUT_FETCH",
      error instanceof Error ? error.message : "Unknown error ingesting inputs"
    );
  }
}

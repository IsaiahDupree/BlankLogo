import { createClient } from "@supabase/supabase-js";
import archiver from "archiver";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import * as os from "os";
import type { PipelineContext, StepResult } from "../types";
import { createStepResult, createStepError } from "../types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function packageAssets(
  ctx: PipelineContext
): Promise<StepResult<{ zipPath: string }>> {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "canvascast-package-"));
    const zipPath = path.join(tempDir, "assets.zip");

    // Create zip archive
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    // Add script
    if (ctx.artifacts.script) {
      archive.append(JSON.stringify(ctx.artifacts.script, null, 2), { name: "script.json" });
    }

    // Add timeline
    if (ctx.artifacts.timeline) {
      archive.append(JSON.stringify(ctx.artifacts.timeline, null, 2), { name: "timeline.json" });
    }

    // Add visual plan
    if (ctx.artifacts.visualPlan) {
      archive.append(JSON.stringify(ctx.artifacts.visualPlan, null, 2), { name: "visuals/plan.json" });
    }

    // Download and add captions
    if (ctx.artifacts.captionsSrtPath) {
      const { data } = await supabase.storage
        .from("project-assets")
        .download(ctx.artifacts.captionsSrtPath);
      if (data) {
        archive.append(Buffer.from(await data.arrayBuffer()), { name: "captions.srt" });
      }
    }

    // Add README
    const readme = `# CanvasCast Video Assets
    
Project: ${ctx.project.title}
Generated: ${new Date().toISOString()}
Job ID: ${ctx.jobId}

## Contents
- script.json - Generated video script
- timeline.json - Remotion timeline data
- captions.srt - Caption file
- visuals/plan.json - Visual generation plan

## Usage
The timeline.json can be used with Remotion to re-render the video.
`;
    archive.append(readme, { name: "README.txt" });

    await archive.finalize();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });

    // Upload zip
    const zipStoragePath = `${ctx.outputPath}/assets.zip`;
    const zipData = await fs.readFile(zipPath);

    await supabase.storage
      .from("project-outputs")
      .upload(zipStoragePath, zipData, {
        upsert: true,
        contentType: "application/zip",
      });

    // Copy captions to outputs
    if (ctx.artifacts.captionsSrtPath) {
      const captionsOutputPath = `${ctx.outputPath}/captions.srt`;
      const { data } = await supabase.storage
        .from("project-assets")
        .download(ctx.artifacts.captionsSrtPath);
      if (data) {
        await supabase.storage
          .from("project-outputs")
          .upload(captionsOutputPath, await data.arrayBuffer(), {
            upsert: true,
            contentType: "text/plain",
          });
      }
    }

    // Create asset record
    await supabase.from("assets").insert({
      project_id: ctx.projectId,
      user_id: ctx.userId,
      job_id: ctx.jobId,
      type: "zip",
      path: zipStoragePath,
      meta: {},
    });

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    return createStepResult({ zipPath: zipStoragePath });
  } catch (error) {
    return createStepError(
      "ERR_PACKAGING",
      error instanceof Error ? error.message : "Unknown error packaging assets"
    );
  }
}

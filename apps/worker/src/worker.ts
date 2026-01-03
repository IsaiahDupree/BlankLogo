import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import os from "node:os";
import { processJob, type JobRow } from "./pipeline/index.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORKER_NAME = `worker-${os.hostname()}-${process.pid}`;
const POLL_INTERVAL_MS = 2000;

async function claimNextJob(): Promise<JobRow | null> {
  const { data, error } = await supabase.rpc("claim_next_job", {
    worker_name: WORKER_NAME,
  });

  if (error) {
    console.error("claim_next_job error:", error.message);
    return null;
  }

  return data ?? null;
}

async function main() {
  console.log(`🚀 BlankLogo worker online: ${WORKER_NAME}`);
  console.log(`   Polling every ${POLL_INTERVAL_MS}ms`);

  while (true) {
    try {
      const job = await claimNextJob();

      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`📦 Claimed job: ${job.id}`);
      await processJob(job, supabase);
    } catch (err) {
      console.error("Worker loop error:", err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error("Fatal worker error:", e);
  process.exit(1);
});

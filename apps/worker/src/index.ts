import "dotenv/config";
import { claimNextJob } from "./lib/claim";
import { requeueStaleJobs } from "./lib/db";
import { runPipeline } from "./pipeline/runner";

const WORKER_ID = process.env.WORKER_ID ?? `worker-${Math.random().toString(16).slice(2, 10)}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 800);
const MAX_ACTIVE_PER_USER = Number(process.env.MAX_ACTIVE_PER_USER ?? 1);
const STALE_SWEEP_INTERVAL_MS = 60_000; // 60 seconds
const STALE_MINUTES = 15;
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log(`[Worker] Starting worker ${WORKER_ID}`);
  console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[Worker] Max active per user: ${MAX_ACTIVE_PER_USER}`);

  let lastSweep = 0;

  while (true) {
    try {
      // Periodic stale job sweep
      const now = Date.now();
      if (now - lastSweep > STALE_SWEEP_INTERVAL_MS) {
        lastSweep = now;
        const requeued = await requeueStaleJobs(STALE_MINUTES, MAX_ATTEMPTS).catch(() => 0);
        if (requeued > 0) {
          console.log(`[Worker] Requeued ${requeued} stale jobs`);
        }
      }

      // Claim and run jobs
      const claimed = await claimNextJob(WORKER_ID, MAX_ACTIVE_PER_USER);

      if (!claimed) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[Worker] Claimed job ${claimed.job.id} for project ${claimed.project.id}`);

      // Run the pipeline
      await runPipeline(claimed.job);

    } catch (error) {
      console.error("[Worker] Error in main loop:", error);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }
}

main().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});

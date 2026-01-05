#!/usr/bin/env npx tsx
/**
 * Remote Worker Integration Test
 * Tests the watermark removal pipeline against deployed services
 * 
 * Usage:
 *   npx tsx scripts/test-remote-worker.ts
 *   API_URL=https://blanklogo-api.onrender.com npx tsx scripts/test-remote-worker.ts
 */

import { createClient } from "@supabase/supabase-js";

// Configuration
const API_URL = process.env.API_URL || process.env.DEPLOY_API_URL || "https://blanklogo-api.onrender.com";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";

// Test configuration
const TEST_TIMEOUT_MS = 180000; // 3 minutes per job
const POLL_INTERVAL_MS = 5000;  // Check every 5 seconds

// Test video URLs from different sources
const TEST_VIDEOS: Array<{
  name: string;
  url: string;
  platform: string;
  expectedToWork: boolean;
  notes?: string;
}> = [
  {
    name: "W3Schools Sample (direct MP4)",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    platform: "auto",
    expectedToWork: true,
    notes: "Simple direct MP4 download",
  },
  {
    name: "Sample Videos 720p",
    url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
    platform: "auto",
    expectedToWork: true,
    notes: "Larger sample video",
  },
  {
    name: "Pexels Sample",
    url: "https://www.pexels.com/download/video/3015510/",
    platform: "auto",
    expectedToWork: false,
    notes: "May require browser - tests download fallback",
  },
];

interface JobStatus {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  current_step?: string;
  output_url?: string;
  error?: string;
  processing_time_ms?: number;
}

interface TestResult {
  name: string;
  url: string;
  platform: string;
  jobId?: string;
  status: "pass" | "fail" | "skip" | "timeout";
  duration_ms: number;
  details?: string;
  error?: string;
}

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTestUserToken(): Promise<string | null> {
  if (!SUPABASE_ANON_KEY) {
    log("⚠️  No SUPABASE_ANON_KEY set, trying without auth...", "yellow");
    return null;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Try to find a test user or create a session
  const testEmail = process.env.TEST_USER_EMAIL || "isaiahdupree33@gmail.com";
  const testPassword = process.env.TEST_USER_PASSWORD || "Frogger12";

  try {
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (data?.session?.access_token) {
      log(`✓ Authenticated as ${testEmail}`, "green");
      return data.session.access_token;
    }

    if (error) {
      log(`⚠️  Auth failed: ${error.message}`, "yellow");
    }
  } catch (err) {
    log(`⚠️  Auth error: ${err}`, "yellow");
  }

  return null;
}

async function createJob(
  videoUrl: string,
  platform: string,
  token: string | null
): Promise<{ jobId: string } | { error: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        video_url: videoUrl,
        platform,
        processing_mode: "crop", // Use crop mode for faster testing
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }

    return { jobId: data.job_id || data.jobId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

async function pollJobStatus(
  jobId: string,
  token: string | null,
  timeoutMs: number
): Promise<JobStatus> {
  const startTime = Date.now();
  const headers: Record<string, string> = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${API_URL}/api/v1/jobs/${jobId}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();

        if (data.status === "completed" || data.status === "failed") {
          return {
            id: jobId,
            status: data.status,
            progress: data.progress,
            output_url: data.output?.downloadUrl,
            error: data.error,
            processing_time_ms: data.processingTimeMs,
          };
        }

        // Log progress
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(
          `\r    ${colors.gray}[${elapsed}s] ${data.status} - ${data.progress || 0}% - ${data.current_step || "waiting"}${colors.reset}    `
        );
      }
    } catch (err) {
      // Ignore polling errors, continue retrying
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return {
    id: jobId,
    status: "failed",
    error: `Timeout after ${timeoutMs / 1000}s`,
  };
}

async function runTest(
  video: (typeof TEST_VIDEOS)[0],
  token: string | null
): Promise<TestResult> {
  const startTime = Date.now();

  log(`\n📹 Testing: ${video.name}`, "blue");
  log(`   URL: ${video.url.substring(0, 60)}...`, "gray");
  log(`   Platform: ${video.platform}`, "gray");
  if (video.notes) {
    log(`   Notes: ${video.notes}`, "gray");
  }

  // Create job
  const createResult = await createJob(video.url, video.platform, token);

  if ("error" in createResult) {
    return {
      name: video.name,
      url: video.url,
      platform: video.platform,
      status: video.expectedToWork ? "fail" : "skip",
      duration_ms: Date.now() - startTime,
      error: createResult.error,
      details: video.expectedToWork ? "Job creation failed" : "Expected to fail",
    };
  }

  log(`   Job ID: ${createResult.jobId}`, "gray");

  // Poll for completion
  const jobResult = await pollJobStatus(createResult.jobId, token, TEST_TIMEOUT_MS);
  console.log(""); // New line after progress

  const duration = Date.now() - startTime;

  if (jobResult.status === "completed") {
    log(`   ✅ Completed in ${(duration / 1000).toFixed(1)}s`, "green");
    if (jobResult.output_url) {
      log(`   Output: ${jobResult.output_url.substring(0, 60)}...`, "gray");
    }
    return {
      name: video.name,
      url: video.url,
      platform: video.platform,
      jobId: createResult.jobId,
      status: "pass",
      duration_ms: duration,
      details: `Output: ${jobResult.output_url || "N/A"}`,
    };
  } else if (jobResult.status === "failed") {
    const status = video.expectedToWork ? "fail" : "skip";
    log(
      `   ${video.expectedToWork ? "❌" : "⚠️"} ${jobResult.error || "Failed"}`,
      video.expectedToWork ? "red" : "yellow"
    );
    return {
      name: video.name,
      url: video.url,
      platform: video.platform,
      jobId: createResult.jobId,
      status,
      duration_ms: duration,
      error: jobResult.error,
      details: video.expectedToWork ? "Job failed" : "Expected to fail",
    };
  } else {
    log(`   ⏱️ Timeout after ${TEST_TIMEOUT_MS / 1000}s`, "yellow");
    return {
      name: video.name,
      url: video.url,
      platform: video.platform,
      jobId: createResult.jobId,
      status: "timeout",
      duration_ms: duration,
      error: "Job did not complete in time",
    };
  }
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║          BlankLogo Remote Worker Integration Test                 ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  log(`API URL: ${API_URL}`, "blue");
  log(`Timeout: ${TEST_TIMEOUT_MS / 1000}s per job`, "gray");
  log(`Videos to test: ${TEST_VIDEOS.length}`, "gray");

  // Check API health first
  log("\n🔍 Checking API health...", "blue");
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const health = await healthResponse.json();
    if (health.status === "healthy") {
      log("✓ API is healthy", "green");
      log(`  Redis: ${health.services?.redis || "unknown"}`, "gray");
      log(`  Queue: ${health.services?.queue || "unknown"}`, "gray");
    } else {
      log(`⚠️ API status: ${health.status}`, "yellow");
    }
  } catch (err) {
    log(`❌ API health check failed: ${err}`, "red");
    process.exit(1);
  }

  // Get authentication token
  log("\n🔐 Getting authentication...", "blue");
  const token = await getTestUserToken();

  if (!token) {
    log("⚠️  Running without authentication (jobs may fail)", "yellow");
  }

  // Run tests
  const results: TestResult[] = [];

  for (const video of TEST_VIDEOS) {
    const result = await runTest(video, token);
    results.push(result);
  }

  // Summary
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║                         Test Results                              ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const timedOut = results.filter((r) => r.status === "timeout").length;

  console.log("| Test                              | Status  | Duration | Details");
  console.log("|-----------------------------------|---------|----------|--------");

  for (const result of results) {
    const statusIcon =
      result.status === "pass"
        ? `${colors.green}✓ PASS${colors.reset}`
        : result.status === "fail"
          ? `${colors.red}✗ FAIL${colors.reset}`
          : result.status === "skip"
            ? `${colors.yellow}○ SKIP${colors.reset}`
            : `${colors.yellow}⏱ TIME${colors.reset}`;

    const name = result.name.substring(0, 33).padEnd(33);
    const duration = `${(result.duration_ms / 1000).toFixed(1)}s`.padEnd(8);
    const details = (result.error || result.details || "").substring(0, 40);

    console.log(`| ${name} | ${statusIcon} | ${duration} | ${details}`);
  }

  console.log("\n");
  log(`Summary: ${passed} passed, ${failed} failed, ${skipped} skipped, ${timedOut} timed out`, 
      failed > 0 ? "red" : "green");

  if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All expected tests passed!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

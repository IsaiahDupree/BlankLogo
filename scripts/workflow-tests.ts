#!/usr/bin/env npx ts-node
/**
 * Watermark Removal Workflow Tests
 * Tests the complete workflow against deployed production system
 * 
 * Usage: SUPABASE_TEST_EMAIL=xxx SUPABASE_TEST_PASSWORD=xxx npx ts-node scripts/workflow-tests.ts
 */

import { createClient } from "@supabase/supabase-js";

const WORKER_URL = process.env.TEST_WORKER_URL || "https://blanklogo-api.onrender.com";
const SUPABASE_URL = "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";

const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL || "isaiahdupree33@gmail.com";
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || "";

// Sample test video URL (short, publicly accessible)
const TEST_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  data?: unknown;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<unknown>): Promise<unknown> {
  const start = Date.now();
  try {
    const data = await testFn();
    results.push({
      name,
      passed: true,
      message: "OK",
      duration: Date.now() - start,
      data,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
    return data;
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function main() {
  console.log("\n🧪 BlankLogo Workflow Tests\n");
  console.log(`📍 Worker API: ${WORKER_URL}`);
  console.log(`📍 Test User: ${TEST_EMAIL}`);
  console.log("─".repeat(50));

  if (!TEST_PASSWORD) {
    console.error("\n❌ Set SUPABASE_TEST_PASSWORD to run workflow tests\n");
    process.exit(1);
  }

  // 1. Authenticate with Supabase
  console.log("\n📋 Authentication:\n");
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const authResult = await runTest("Supabase Login", async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (error) throw new Error(`Auth failed: ${error.message}`);
    if (!data.session) throw new Error("No session returned");
    return { userId: data.user?.id, accessToken: data.session.access_token };
  }) as { userId: string; accessToken: string } | null;

  if (!authResult) {
    console.error("\n❌ Authentication failed, cannot continue\n");
    process.exit(1);
  }

  const { accessToken, userId } = authResult;

  // 2. Check user credits
  console.log("\n📋 Credit Balance:\n");
  
  const creditsResult = await runTest("Get Credit Balance", async () => {
    const { data, error } = await supabase.rpc("get_credit_balance", {
      p_user_id: userId,
    });
    if (error) throw new Error(`Credits RPC failed: ${error.message}`);
    console.log(`   💰 Credits: ${data}`);
    return { credits: data };
  }) as { credits: number } | null;

  if (!creditsResult || creditsResult.credits < 1) {
    console.error("\n⚠️ Insufficient credits for workflow test. Need at least 1 credit.\n");
  }

  // 3. Test Worker API Health
  console.log("\n📋 Worker API:\n");

  await runTest("Worker Health Check", async () => {
    const res = await fetch(`${WORKER_URL}/health`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json() as { status: string; services?: { redis?: string; queue?: string } };
    if (data.status !== "healthy") throw new Error(`Worker unhealthy: ${JSON.stringify(data)}`);
    console.log(`   📊 Redis: ${data.services?.redis}, Queue: ${data.services?.queue}`);
    return data;
  });

  await runTest("Worker Capabilities", async () => {
    const res = await fetch(`${WORKER_URL}/capabilities`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json() as { service?: string; features?: Record<string, boolean> };
    console.log(`   🔧 Service: ${data.service}`);
    return data;
  });

  // 4. Submit a watermark removal job (test even without credits to verify API)
  console.log("\n📋 Job Submission:\n");

  // Always try to submit a job to test the API (will fail with insufficient credits, which is expected)
  {
    const jobResult = await runTest("Submit Watermark Job", async () => {
      const res = await fetch(`${WORKER_URL}/api/v1/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          video_url: TEST_VIDEO_URL,
          crop_pixels: 50,
          crop_position: "bottom",
          platform: "sora",
          processing_mode: "crop", // Use crop mode (1 credit)
        }),
      });

      const data = await res.json() as { job_id?: string; error?: string; status?: string };
      
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Job submission failed: ${data.error || res.status}`);
      }

      console.log(`   📝 Job ID: ${data.job_id}`);
      console.log(`   📊 Status: ${data.status}`);
      return data;
    }) as { job_id?: string } | null;

    // 5. Check job status
    if (jobResult?.job_id) {
      await runTest("Check Job Status", async () => {
        // Wait a moment for job to be queued
        await new Promise((r) => setTimeout(r, 2000));

        const res = await fetch(`${WORKER_URL}/api/v1/jobs/${jobResult.job_id}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        const data = await res.json() as { status?: string; progress?: number; error?: string };
        console.log(`   📊 Job Status: ${data.status}`);
        if (data.progress !== undefined) {
          console.log(`   📈 Progress: ${data.progress}%`);
        }
        return data;
      });

      // 6. List user's jobs
      await runTest("List User Jobs", async () => {
        const res = await fetch(`${WORKER_URL}/api/v1/jobs`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        const data = await res.json() as { jobs?: Array<{ id: string; status: string }> };
        console.log(`   📋 Total Jobs: ${data.jobs?.length || 0}`);
        return data;
      });
    }
  }

  // 7. Test job without auth (should fail)
  console.log("\n📋 Security Tests:\n");

  await runTest("Job Submission Without Auth (should fail)", async () => {
    const res = await fetch(`${WORKER_URL}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: TEST_VIDEO_URL,
        processing_mode: "crop",
      }),
    });

    if (res.status === 401 || res.status === 403) {
      console.log("   🔒 Correctly rejected unauthorized request");
      return { rejected: true };
    }
    throw new Error(`Expected 401/403, got ${res.status}`);
  });

  // Cleanup
  await supabase.auth.signOut();

  // Summary
  console.log("\n" + "─".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${totalTime}ms total)\n`);

  if (failed > 0) {
    console.log("❌ Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log("✅ All workflow tests passed!\n");
  }
}

main().catch(console.error);

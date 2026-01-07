#!/usr/bin/env npx ts-node
/**
 * Test script for BlankLogo Inpaint Service
 * Tests health, capabilities, and video processing endpoints
 */

import * as fs from "fs";
import * as path from "path";

const INPAINT_URL = process.env.INPAINT_SERVICE_URL || "https://blanklogo-inpaint.onrender.com";
const TEST_VIDEO_PATH = path.join(process.cwd(), "test-videos/sora_watermarked.mp4");

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, duration: Date.now() - start, error });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function main() {
  console.log(`\n🧪 Testing Inpaint Service: ${INPAINT_URL}\n`);
  console.log("─".repeat(50));

  // Test 1: Health check
  await test("Health endpoint returns healthy", async () => {
    const res = await fetch(`${INPAINT_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { status: string; service: string };
    if (data.status !== "healthy") throw new Error(`Status: ${data.status}`);
    if (data.service !== "blanklogo-inpainter") throw new Error(`Wrong service: ${data.service}`);
  });

  // Test 2: OpenAPI docs available
  await test("OpenAPI docs available", async () => {
    const res = await fetch(`${INPAINT_URL}/docs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  // Test 3: Process endpoint accepts video (crop mode - fast)
  await test("Process video with crop mode", async () => {
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      throw new Error(`Test video not found: ${TEST_VIDEO_PATH}`);
    }

    const formData = new FormData();
    const videoBuffer = fs.readFileSync(TEST_VIDEO_PATH);
    const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });
    formData.append("video", videoBlob, "test.mp4");
    formData.append("mode", "crop");
    formData.append("crop_pixels", "50");
    formData.append("crop_position", "bottom");

    const res = await fetch(`${INPAINT_URL}/process`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("video")) {
      throw new Error(`Expected video response, got: ${contentType}`);
    }
  });

  // Test 4: Async process endpoint
  await test("Async process endpoint returns job ID", async () => {
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      throw new Error(`Test video not found: ${TEST_VIDEO_PATH}`);
    }

    const formData = new FormData();
    const videoBuffer = fs.readFileSync(TEST_VIDEO_PATH);
    const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });
    formData.append("video", videoBlob, "test.mp4");
    formData.append("mode", "crop");

    const res = await fetch(`${INPAINT_URL}/process/async`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { job_id: string; status: string };
    if (!data.job_id) throw new Error("No job_id in response");
    if (data.status !== "queued") throw new Error(`Expected queued, got: ${data.status}`);
  });

  // Test 5: Status endpoint
  await test("Status endpoint works for valid job", async () => {
    // First create a job
    const formData = new FormData();
    const videoBuffer = fs.readFileSync(TEST_VIDEO_PATH);
    const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });
    formData.append("video", videoBlob, "test.mp4");
    formData.append("mode", "crop");

    const createRes = await fetch(`${INPAINT_URL}/process/async`, {
      method: "POST",
      body: formData,
    });
    const { job_id } = await createRes.json() as { job_id: string };

    // Check status
    const statusRes = await fetch(`${INPAINT_URL}/status/${job_id}`);
    if (!statusRes.ok) throw new Error(`HTTP ${statusRes.status}`);
    const status = await statusRes.json() as { status: string };
    if (!["queued", "processing", "completed"].includes(status.status)) {
      throw new Error(`Unexpected status: ${status.status}`);
    }
  });

  // Test 6: 404 for invalid job
  await test("Status returns 404 for invalid job", async () => {
    const res = await fetch(`${INPAINT_URL}/status/invalid-job-id-12345`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // Summary
  console.log("\n" + "─".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});

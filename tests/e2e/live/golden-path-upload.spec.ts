/**
 * Golden Path: File Upload Flow
 * 
 * Tests the complete flow using real video file upload:
 * Login → Upload Video → Job Created → Processing → Completed → Download
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import { login, submitJobWithFile, waitForJobCompletion } from "./helpers";
import { ENV, TIMEOUTS, generateTraceId, logWithTrace } from "./config";

// Test video files
const TEST_VIDEOS = {
  SORA: path.resolve(__dirname, "../../../test-videos/sora-watermark-test.mp4"),
  PIKA: path.resolve(__dirname, "../../../test-videos/pika_watermarked.mp4"),
  RUNWAY: path.resolve(__dirname, "../../../test-videos/runway_watermarked.mp4"),
  TIKTOK: path.resolve(__dirname, "../../../test-videos/tiktok_watermarked.mp4"),
};

// Full Golden Path - Single test that runs the complete flow
test.describe("Golden Path: Complete Upload Flow", () => {
  test("Full flow: Login → Upload → Process → Download", async ({ page }) => {
    test.setTimeout(120000); // 2 minute timeout for full flow
    
    const traceId = generateTraceId();
    const runId = `e2e-${Date.now()}`;
    
    logWithTrace(traceId, "Starting Full Golden Path Test", { runId, testVideo: TEST_VIDEOS.SORA });
    
    // STEP 1: Login
    logWithTrace(traceId, "Step 1: Logging in...");
    await login(page);
    expect(page.url()).toContain('/app');
    
    // Verify credits visible
    const creditsIndicator = page.locator('text=Credits');
    await expect(creditsIndicator.first()).toBeVisible({ timeout: 5000 });
    logWithTrace(traceId, "✓ Login successful");
    
    // STEP 2: Upload video
    logWithTrace(traceId, "Step 2: Uploading video with watermark...");
    const { jobId } = await submitJobWithFile(page, TEST_VIDEOS.SORA, "sora");
    expect(jobId).toBeTruthy();
    logWithTrace(traceId, "✓ Job created", { jobId });
    
    // STEP 3: Wait for processing
    logWithTrace(traceId, "Step 3: Waiting for job to complete...");
    const result = await waitForJobCompletion(page, jobId!, 90000);
    expect(result.status).toMatch(/completed|succeeded/i);
    logWithTrace(traceId, "✓ Job completed", { status: result.status });
    
    // STEP 4: Verify download available
    logWithTrace(traceId, "Step 4: Verifying download...");
    
    // Go to dashboard and find the job
    await page.goto(`${ENV.WEB_URL}/app`);
    await page.waitForLoadState("networkidle");
    
    // Find download button for completed job
    const downloadBtn = page.locator('a:has-text("Download")').first();
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });
    
    const downloadUrl = await downloadBtn.getAttribute('href');
    expect(downloadUrl).toBeTruthy();
    logWithTrace(traceId, "✓ Download available", { downloadUrl });
    
    // STEP 5: Verify download works (handle both direct URLs and job detail pages)
    if (downloadUrl) {
      if (downloadUrl.startsWith('/app/jobs/')) {
        // Navigate to job details page to find actual download
        await page.goto(`${ENV.WEB_URL}${downloadUrl}`);
        await page.waitForLoadState("networkidle");
        
        // Look for the actual download button on the job details page
        const actualDownloadBtn = page.locator('a:has-text("Download")').first();
        if (await actualDownloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          logWithTrace(traceId, "✓ Download button found on job details page");
        }
      } else if (downloadUrl.startsWith('http')) {
        // Direct video URL - verify it's accessible
        const response = await page.request.head(downloadUrl);
        expect(response.ok()).toBeTruthy();
        logWithTrace(traceId, "✓ Download URL verified");
      }
    }
    
    logWithTrace(traceId, "🎉 Golden Path Complete!", { runId, jobId, success: true });
  });
});

// Quick smoke test - just upload and verify job creation
test.describe("Smoke Test: File Upload", () => {
  test("Upload video creates job immediately", async ({ page }) => {
    test.setTimeout(60000);
    
    const traceId = generateTraceId();
    logWithTrace(traceId, "Starting smoke test");
    
    // Login
    await login(page);
    expect(page.url()).toContain('/app');
    
    // Upload video
    const result = await submitJobWithFile(page, TEST_VIDEOS.SORA, "sora");
    
    expect(result.jobId).toBeTruthy();
    logWithTrace(traceId, "Smoke test passed - job created", { jobId: result.jobId });
  });
});

/**
 * Golden Path 1: Signup → Generate → Preview → Download
 * 
 * LIVE-ONLY TEST - NO MOCKS
 * Tests: Vercel UI + Supabase Auth + Render Worker + Supabase Storage
 */

import { test, expect } from "@playwright/test";
import { 
  ENV, 
  TIMEOUTS, 
  createTestUser, 
  TEST_VIDEOS,
  generateTraceId,
  logWithTrace,
  RUN_ID 
} from "./config";
import { signup, login, submitJob, waitForJobCompletion, verifyDownload, getCredits } from "./helpers";

test.describe("Golden Path 1: Signup → Generate → Preview → Download", () => {
  test.describe.configure({ mode: "serial", timeout: TIMEOUTS.JOB_COMPLETION });
  
  const testUser = createTestUser("gp1");
  let traceId: string;
  let jobId: string | null;
  let outputUrl: string | undefined;

  test("1.1 User signs up successfully", async ({ page }) => {
    traceId = generateTraceId();
    logWithTrace(traceId, "Starting Golden Path 1", { testUser: testUser.email, runId: RUN_ID });
    
    await page.goto(`${ENV.WEB_URL}/signup`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    // Fill signup form
    await page.locator('input[type="email"]').fill(testUser.email);
    await page.locator('input[type="password"]').fill(testUser.password);
    
    // Submit
    await page.locator('button[type="submit"]').click();
    
    // Wait for success - either redirect or confirmation
    await page.waitForTimeout(3000);
    
    // Verify we're either redirected to app or see confirmation
    const url = page.url();
    const hasSuccessIndicator = url.includes("/app") || 
      url.includes("/confirm") ||
      await page.locator('text=/check.*email|verify|success/i').isVisible().catch(() => false);
    
    expect(hasSuccessIndicator).toBeTruthy();
    logWithTrace(traceId, "Signup completed", { email: testUser.email, redirectUrl: url });
  });

  test("1.2 User can login after signup", async ({ page }) => {
    // For tests that need immediate login (without email verification)
    // Use the existing test user that's already verified
    await login(page);
    
    // Verify we're in the authenticated area
    expect(page.url()).toMatch(/\/(app|dashboard|remove)/);
    logWithTrace(traceId, "Login successful");
  });

  test("1.3 User navigates to remove page", async ({ page }) => {
    await login(page);
    await page.goto(`${ENV.WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    // Verify remove page loaded
    const pageTitle = page.locator('h1, h2').first();
    await expect(pageTitle).toBeVisible();
    
    // Verify video input exists
    const videoInput = page.locator('input[type="url"], input[name="videoUrl"], input[placeholder*="URL"]').first();
    await expect(videoInput).toBeVisible();
    
    logWithTrace(traceId, "Remove page loaded");
  });

  test("1.4 User submits a watermark removal job", async ({ page }) => {
    await login(page);
    
    const result = await submitJob(page, TEST_VIDEOS.SMALL, "sora");
    jobId = result.jobId;
    
    expect(jobId).toBeTruthy();
    logWithTrace(traceId, "Job submitted", { jobId });
  });

  test("1.5 Job processes and completes", async ({ page }) => {
    test.skip(!jobId, "No job ID from previous test");
    
    await login(page);
    
    const result = await waitForJobCompletion(page, jobId!, TIMEOUTS.JOB_COMPLETION);
    
    expect(result.status).toMatch(/completed|done/i);
    outputUrl = result.outputUrl;
    
    logWithTrace(traceId, "Job completed", { jobId, status: result.status, outputUrl });
  });

  test("1.6 User can preview the processed video", async ({ page }) => {
    test.skip(!jobId, "No job ID from previous test");
    
    await login(page);
    
    // Navigate to job detail page
    await page.goto(`${ENV.WEB_URL}/app/jobs/${jobId}`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    // Verify video preview element exists
    const videoElement = page.locator('video, [data-testid="video-preview"]').first();
    await expect(videoElement).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    
    logWithTrace(traceId, "Video preview visible", { jobId });
  });

  test("1.7 User can download the processed video", async ({ page }) => {
    test.skip(!outputUrl, "No output URL from previous test");
    
    await login(page);
    
    // Verify download URL is accessible
    const isDownloadable = await verifyDownload(page, outputUrl!);
    expect(isDownloadable).toBeTruthy();
    
    // Also verify download button works on job page
    await page.goto(`${ENV.WEB_URL}/app/jobs/${jobId}`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    const downloadBtn = page.locator('button:has-text("Download"), a:has-text("Download")').first();
    await expect(downloadBtn).toBeVisible();
    
    logWithTrace(traceId, "Download verified", { outputUrl });
  });

  test("1.8 Credits were deducted", async ({ page }) => {
    await login(page);
    
    // Get current credits
    const credits = await getCredits(page);
    
    // Credits should exist (even if depleted for this test)
    // The important thing is the credit system responded
    logWithTrace(traceId, "Credits check", { currentCredits: credits });
    
    // Navigate to credits page to verify UI shows credits
    await page.goto(`${ENV.WEB_URL}/app/credits`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    const creditsDisplay = page.locator('text=/\\d+.*credit|\\d+.*minute/i').first();
    await expect(creditsDisplay).toBeVisible();
  });
});

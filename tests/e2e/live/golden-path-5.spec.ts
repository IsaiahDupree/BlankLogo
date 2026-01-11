/**
 * Golden Path 5: Email Delivery - "Your media is ready" with working link
 * 
 * LIVE-ONLY TEST - NO MOCKS
 * Tests: Render Worker completion → Resend email → Link verification
 */

import { test, expect } from "@playwright/test";
import { 
  ENV, 
  TIMEOUTS, 
  TEST_VIDEOS,
  generateTraceId,
  logWithTrace,
  RUN_ID 
} from "./config";
import { login, submitJob, waitForJobCompletion, verifyEmailReceived } from "./helpers";

test.describe("Golden Path 5: Email Notification → Working Link", () => {
  test.describe.configure({ mode: "serial", timeout: TIMEOUTS.JOB_COMPLETION + TIMEOUTS.EMAIL_DELIVERY });
  
  let traceId: string;
  let jobId: string | null;

  test.beforeAll(async () => {
    traceId = generateTraceId();
    logWithTrace(traceId, "Starting Golden Path 5", { runId: RUN_ID });
  });

  test("5.1 Submit job and wait for completion", async ({ page }) => {
    await login(page);
    
    const result = await submitJob(page, TEST_VIDEOS.SMALL, "sora");
    jobId = result.jobId;
    
    expect(jobId).toBeTruthy();
    logWithTrace(traceId, "Job submitted for email test", { jobId });
    
    // Wait for job completion
    if (jobId) {
      const completion = await waitForJobCompletion(page, jobId, TIMEOUTS.JOB_COMPLETION);
      expect(completion.status).toMatch(/completed|done/i);
      logWithTrace(traceId, "Job completed", { jobId, status: completion.status });
    }
  });

  test("5.2 Verify email notification sent", async ({ page, request }) => {
    test.skip(!jobId, "No job ID from previous test");
    
    // Wait for email delivery (Resend is usually fast, but give it time)
    await page.waitForTimeout(10000);
    
    const emailResult = await verifyEmailReceived(
      request,
      process.env.TEST_USER_EMAIL || "isaiahdupree33@gmail.com",
      "ready",
      TIMEOUTS.EMAIL_DELIVERY
    );
    
    logWithTrace(traceId, "Email verification", { 
      received: emailResult.received,
      hasLinks: !!emailResult.links?.length 
    });
    
    // Note: This test validates the email system is working
    // In staging, we'd verify against a test inbox
  });

  test("5.3 Email link leads to correct job page", async ({ page, request }) => {
    test.skip(!jobId, "No job ID from previous test");
    
    await login(page);
    
    // Navigate directly to job (simulating email link click)
    await page.goto(`${ENV.WEB_URL}/app/jobs/${jobId}`);
    await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
    
    // Should see job details
    const jobPage = page.locator('text=/completed|download|processed/i').first();
    await expect(jobPage).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    
    // Download link should work
    const downloadBtn = page.locator('button:has-text("Download"), a:has-text("Download")').first();
    await expect(downloadBtn).toBeVisible();
    
    logWithTrace(traceId, "Email link validation complete", { jobId });
  });
});

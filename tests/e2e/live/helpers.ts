/**
 * BlankLogo Live E2E Test Helpers
 * 
 * Utility functions for live-only e2e tests.
 * All operations hit REAL services - no mocks.
 */

import { Page, expect, APIRequestContext, Response } from "@playwright/test";
import { ENV, TIMEOUTS, generateTraceId, logWithTrace, EXISTING_TEST_USER } from "./config";

// Ensure test user is configured
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || EXISTING_TEST_USER.email,
  password: process.env.TEST_USER_PASSWORD || EXISTING_TEST_USER.password,
};

// Login helper - hits real Supabase Auth
export async function login(page: Page, email?: string, password?: string) {
  const traceId = generateTraceId();
  const user = {
    email: email || TEST_USER.email,
    password: password || TEST_USER.password,
  };
  
  logWithTrace(traceId, "Starting login flow", { email: user.email });
  
  await page.goto(`${ENV.WEB_URL}/login`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  // Verify we're on the login page
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 5000 });
  
  await emailInput.fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL(/\/(app)/, { timeout: 30000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  
  // Wait for app to fully load
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  // Verify we're now authenticated by checking for user-specific elements
  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    const errorMsg = await page.locator('[role="alert"], .error, .text-red').textContent().catch(() => null);
    logWithTrace(traceId, "Login may have failed", { currentUrl, errorMsg });
    throw new Error(`Login failed - redirected to ${currentUrl}. Error: ${errorMsg || 'unknown'}`);
  }
  
  // Wait for and verify auth indicator (email shown in header)
  const userEmail = page.locator(`text=${user.email}`);
  await expect(userEmail).toBeVisible({ timeout: 5000 });
  
  logWithTrace(traceId, "Login successful and verified", { redirectUrl: currentUrl });
  return traceId;
}

// Signup helper - creates REAL user in Supabase
export async function signup(page: Page, email: string, password: string, name?: string) {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Starting signup flow", { email });
  
  await page.goto(`${ENV.WEB_URL}/signup`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  
  // Fill name if field exists
  const nameField = page.locator('input[name="name"], input[placeholder*="name"]');
  if (await nameField.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameField.fill(name || "E2E Test User");
  }
  
  await page.locator('button[type="submit"]').click();
  
  // Wait for success (could be redirect or confirmation message)
  await page.waitForTimeout(3000);
  
  logWithTrace(traceId, "Signup submitted", { currentUrl: page.url() });
  return traceId;
}

// Submit watermark removal job via FILE UPLOAD - uses real video files
export async function submitJobWithFile(page: Page, filePath: string, platform: string = "sora") {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Submitting job via file upload", { filePath, platform });
  
  // Must be on /app after login - navigate to remove page via UI click
  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    throw new Error(`Must be on /app page first. Current: ${currentUrl}`);
  }
  
  // Click "Remove Watermark" link in sidebar navigation
  const removeLink = page.locator('a[href="/app/remove"]').first();
  await expect(removeLink).toBeVisible({ timeout: 5000 });
  await removeLink.click();
  
  // Wait for navigation and page to settle
  await page.waitForURL(/\/app\/remove/, { timeout: TIMEOUTS.PAGE_LOAD });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  logWithTrace(traceId, "Navigated to remove page");
  
  // Switch to Upload File mode
  const uploadTab = page.locator('button:has-text("Upload File")');
  await expect(uploadTab).toBeVisible({ timeout: 5000 });
  await uploadTab.click();
  
  logWithTrace(traceId, "Switched to upload mode");
  
  // Upload the file using file chooser
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  
  logWithTrace(traceId, "File selected for upload");
  
  // Wait a moment for file to be processed
  await page.waitForTimeout(1000);
  
  // Select platform if not auto
  if (platform !== "auto") {
    const platformBtn = page.locator(`button:has-text("${platform.charAt(0).toUpperCase() + platform.slice(1)}")`).first();
    if (await platformBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await platformBtn.click();
      logWithTrace(traceId, "Selected platform", { platform });
    }
  }
  
  // Set up response listener BEFORE clicking submit
  let jobId: string | null = null;
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/') && response.request().method() === 'POST',
    { timeout: 60000 } // Longer timeout for file upload
  ).catch(() => null);
  
  // Click submit button
  const submitBtn = page.locator('button:has-text("Remove Watermark")').last();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  
  logWithTrace(traceId, "Clicking submit button");
  await submitBtn.click();
  
  // Wait for API response
  const response = await responsePromise;
  if (response) {
    try {
      const data = await response.json();
      logWithTrace(traceId, "Job API response", { status: response.status(), data });
      
      if (response.ok()) {
        jobId = data.jobId || data.job_id || data.id;
      } else {
        logWithTrace(traceId, "Job API error", { status: response.status(), error: data.error || data.message });
      }
    } catch (e) {
      logWithTrace(traceId, "Failed to parse API response", { error: String(e) });
    }
  } else {
    logWithTrace(traceId, "No API response received");
  }
  
  logWithTrace(traceId, "Job submission complete", { jobId });
  return { traceId, jobId };
}

// Submit watermark removal job via URL
export async function submitJob(page: Page, videoUrl: string, platform: string = "sora") {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Submitting watermark removal job via URL", { videoUrl, platform });
  
  // Must be on /app after login - navigate to remove page via UI click
  const currentUrl = page.url();
  if (!currentUrl.includes('/app')) {
    throw new Error(`Must be on /app page first. Current: ${currentUrl}`);
  }
  
  // Click "Remove Watermark" link in sidebar navigation
  const removeLink = page.locator('a[href="/app/remove"]').first();
  await expect(removeLink).toBeVisible({ timeout: 5000 });
  await removeLink.click();
  
  // Wait for navigation and page to settle
  await page.waitForURL(/\/app\/remove/, { timeout: TIMEOUTS.PAGE_LOAD });
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  logWithTrace(traceId, "Navigated to remove page via UI");
  
  // Find and fill video URL input
  const urlInput = page.locator('input[placeholder*="example.com"], input[placeholder*="video"], input[type="text"]').first();
  await expect(urlInput).toBeVisible({ timeout: 5000 });
  await urlInput.fill(videoUrl);
  
  logWithTrace(traceId, "Filled video URL");
  
  // Set up response listener BEFORE clicking submit
  let jobId: string | null = null;
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/') && response.request().method() === 'POST',
    { timeout: 30000 }
  ).catch(() => null);
  
  // Click submit button
  const submitBtn = page.locator('button:has-text("Remove Watermark")').last();
  await expect(submitBtn).toBeVisible({ timeout: 5000 });
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  
  logWithTrace(traceId, "Clicking submit button");
  await submitBtn.click();
  
  // Wait for API response
  const response = await responsePromise;
  if (response) {
    try {
      const data = await response.json();
      logWithTrace(traceId, "Job API response", { status: response.status(), data });
      
      if (response.ok()) {
        jobId = data.jobId || data.job_id || data.id;
      } else {
        logWithTrace(traceId, "Job API error", { status: response.status(), error: data.error || data.message });
      }
    } catch (e) {
      logWithTrace(traceId, "Failed to parse API response", { error: String(e) });
    }
  } else {
    logWithTrace(traceId, "No API response received");
  }
  
  logWithTrace(traceId, "Job submission complete", { jobId });
  return { traceId, jobId };
}

// Wait for job completion - watches dashboard UI for status changes
export async function waitForJobCompletion(
  page: Page, 
  jobId: string, 
  timeout: number = TIMEOUTS.JOB_COMPLETION
): Promise<{ status: string; outputUrl?: string }> {
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  logWithTrace(traceId, "Waiting for job completion via UI", { jobId, timeoutMs: timeout });
  
  // Navigate to dashboard to watch job status
  await page.goto(`${ENV.WEB_URL}/app`);
  await page.waitForLoadState("networkidle");
  
  while (Date.now() - startTime < timeout) {
    // Refresh to get latest status
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Look for Download button (indicates completed)
    const downloadBtn = page.locator('a:has-text("Download")').first();
    if (await downloadBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      const outputUrl = await downloadBtn.getAttribute('href');
      logWithTrace(traceId, "Job completed - Download available", { jobId, outputUrl });
      return { status: "completed", outputUrl: outputUrl || undefined };
    }
    
    // Check if failed
    const failedText = page.locator('text=Failed').first();
    if (await failedText.isVisible({ timeout: 500 }).catch(() => false)) {
      logWithTrace(traceId, "Job failed", { jobId });
      throw new Error(`Job ${jobId} failed`);
    }
    
    logWithTrace(traceId, "Job still processing, waiting...", { jobId });
    await page.waitForTimeout(3000);
  }
  
  throw new Error(`Job ${jobId} timed out after ${timeout}ms`);
}

// Verify download works - hits REAL Supabase Storage
export async function verifyDownload(page: Page, downloadUrl: string): Promise<boolean> {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Verifying download URL", { downloadUrl });
  
  const response = await page.request.head(downloadUrl);
  const contentType = response.headers()["content-type"];
  const contentLength = response.headers()["content-length"];
  
  const isValid = response.ok() && contentType?.includes("video");
  
  logWithTrace(traceId, "Download verification", { 
    status: response.status(),
    contentType,
    contentLength,
    isValid 
  });
  
  return isValid;
}

// Check credits balance - hits REAL Supabase
export async function getCredits(page: Page): Promise<number> {
  const response = await page.request.get(`${ENV.API_URL}/user/credits`);
  if (response.ok()) {
    const data = await response.json();
    return data.credits || data.balance || 0;
  }
  return 0;
}

// Initiate Stripe checkout - REAL Stripe test mode
export async function initiateCheckout(page: Page, priceId?: string) {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Initiating Stripe checkout", { priceId });
  
  await page.goto(`${ENV.WEB_URL}/app/credits`);
  await page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD });
  
  // Click buy/purchase button
  const buyBtn = page.locator('button:has-text("Buy"), button:has-text("Purchase"), a:has-text("Buy")').first();
  await buyBtn.click();
  
  // Should redirect to Stripe Checkout
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: TIMEOUTS.DEFAULT });
  
  logWithTrace(traceId, "Redirected to Stripe Checkout", { url: page.url() });
  return traceId;
}

// Complete Stripe checkout with test card - REAL Stripe
export async function completeStripeCheckout(page: Page, cardNumber: string = "4242424242424242") {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Completing Stripe checkout", { cardLastFour: cardNumber.slice(-4) });
  
  // Fill card details (Stripe Checkout page)
  await page.locator('input[name="cardNumber"]').fill(cardNumber);
  await page.locator('input[name="cardExpiry"]').fill("12/30");
  await page.locator('input[name="cardCvc"]').fill("123");
  await page.locator('input[name="billingName"]').fill("E2E Test User");
  
  // Submit payment
  await page.locator('button[type="submit"]').click();
  
  // Wait for redirect back to app
  await page.waitForURL(/blanklogo/, { timeout: 30000 });
  
  logWithTrace(traceId, "Stripe checkout completed", { returnUrl: page.url() });
  return traceId;
}

// Verify email received - requires test inbox API
export async function verifyEmailReceived(
  request: APIRequestContext,
  toEmail: string,
  subjectContains: string,
  timeout: number = TIMEOUTS.EMAIL_DELIVERY
): Promise<{ received: boolean; body?: string; links?: string[] }> {
  const traceId = generateTraceId();
  logWithTrace(traceId, "Checking for email delivery", { toEmail, subjectContains });
  
  // This would integrate with your test inbox provider (e.g., Mailosaur, Mailtrap)
  // For now, we check the internal test email endpoint
  const response = await request.get(`${ENV.API_URL}/api/test/emails`, {
    headers: {
      "x-internal-secret": process.env.INTERNAL_NOTIFY_SECRET || "",
    },
    params: {
      to: toEmail,
      subject: subjectContains,
    },
  });
  
  if (response.ok()) {
    const data = await response.json();
    return {
      received: data.found || false,
      body: data.body,
      links: data.links,
    };
  }
  
  return { received: false };
}

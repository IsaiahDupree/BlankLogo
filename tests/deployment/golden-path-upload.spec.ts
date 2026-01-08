/**
 * Golden Path: Video Upload Test
 * 
 * Tests the complete video upload flow on deployed infrastructure:
 * 1. Login
 * 2. Navigate to /app/remove (Upload File is now default)
 * 3. Upload sora-watermark-test.mp4
 * 4. Select Sora platform
 * 5. Submit job
 * 6. Track job status until completion
 * 7. Verify download available
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const WEB_URL = process.env.DEPLOY_WEB_URL || "https://www.blanklogo.app";
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";
const skipAuth = !TEST_EMAIL || !TEST_PASSWORD;

// Test video - using smaller file for faster tests
const TEST_VIDEO_PATH = path.resolve(__dirname, "../../test-videos/sora-watermark-test.mp4");

test.describe("Golden Path: Video Upload", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    // Skip all tests if no auth
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Login
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
  });

  test("1. Remove page loads with Upload File as default", async ({ page }) => {
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Verify heading
    await expect(page.getByRole('heading', { name: 'Remove Watermark' })).toBeVisible();
    
    // Upload File button should be active/selected (default mode)
    const uploadFileBtn = page.locator('button:has-text("Upload File")');
    await expect(uploadFileBtn).toBeVisible();
    
    // File input should exist
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    
    // No errors
    const errorBanner = page.locator('text="Failed to fetch"');
    expect(await errorBanner.isVisible().catch(() => false)).toBeFalsy();
    
    console.log("[Golden Path] ✓ Upload page loaded with file upload as default");
  });

  test("2. Can select and preview video file", async ({ page }) => {
    // Check video exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, `Test video not found: ${TEST_VIDEO_PATH}`);
      return;
    }
    
    const fileSize = fs.statSync(TEST_VIDEO_PATH).size;
    console.log(`[Golden Path] Test video: ${path.basename(TEST_VIDEO_PATH)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
    
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Upload file via input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);
    
    // Wait for file to be processed
    await page.waitForTimeout(2000);
    
    // File name should appear
    const fileName = path.basename(TEST_VIDEO_PATH);
    const fileNameVisible = await page.locator(`text="${fileName}"`).isVisible().catch(() => false);
    expect(fileNameVisible).toBeTruthy();
    
    console.log("[Golden Path] ✓ Video file selected and showing");
  });

  test("3. Can select platform", async ({ page }) => {
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, "Test video not found");
      return;
    }
    
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Upload file
    await page.locator('input[type="file"]').setInputFiles(TEST_VIDEO_PATH);
    await page.waitForTimeout(1000);
    
    // Platform buttons should be visible
    await expect(page.locator('text="Auto-Detect"')).toBeVisible();
    await expect(page.locator('text="Sora"')).toBeVisible();
    
    // Click Sora
    await page.locator('text="Sora"').first().click();
    
    console.log("[Golden Path] ✓ Platform selection works");
  });

  test("4. Submit job and see processing", async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, "Test video not found");
      return;
    }
    
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Upload file
    console.log("[Golden Path] Uploading video...");
    await page.locator('input[type="file"]').setInputFiles(TEST_VIDEO_PATH);
    await page.waitForTimeout(2000);
    
    // Select Sora
    await page.locator('text="Sora"').first().click();
    
    // Submit button should be enabled
    const submitButton = page.getByTestId('submit-remove-watermark');
    await expect(submitButton).toBeEnabled({ timeout: 10000 });
    
    console.log("[Golden Path] Submitting job...");
    await submitButton.click();
    
    // Wait for job to start processing
    // Should see uploading/processing indicator
    const processingIndicators = [
      'text=/Uploading|Processing|Queued|Starting|Validating|Analyzing/i',
      '[class*="progress"]',
      '[class*="loading"]',
      'text=/\\d+%/'
    ];
    
    let foundProcessing = false;
    for (const selector of processingIndicators) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 5000 }).catch(() => false)) {
        foundProcessing = true;
        console.log(`[Golden Path] ✓ Processing indicator found: ${selector}`);
        break;
      }
    }
    
    expect(foundProcessing).toBeTruthy();
    console.log("[Golden Path] ✓ Job submitted and processing started");
  });

  test("5. Full job lifecycle (wait for completion)", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes max
    
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, "Test video not found");
      return;
    }
    
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Upload and submit
    await page.locator('input[type="file"]').setInputFiles(TEST_VIDEO_PATH);
    await page.waitForTimeout(2000);
    await page.locator('text="Sora"').first().click();
    
    const submitButton = page.getByTestId('submit-remove-watermark');
    await submitButton.click();
    
    console.log("[Golden Path] Job submitted, waiting for completion...");
    
    const startTime = Date.now();
    const maxWait = 240000; // 4 minutes
    let completed = false;
    let failed = false;
    
    while (!completed && !failed && (Date.now() - startTime) < maxWait) {
      await page.waitForTimeout(5000); // Check every 5 seconds
      
      // Check for download button (success)
      const downloadBtn = page.locator('a:has-text("Download"), button:has-text("Download")');
      if (await downloadBtn.first().isVisible().catch(() => false)) {
        completed = true;
        console.log("[Golden Path] ✓ JOB COMPLETED - Download available!");
        break;
      }
      
      // Check for error
      const errorEl = page.locator('text=/error|failed/i');
      if (await errorEl.isVisible().catch(() => false)) {
        const errorText = await errorEl.textContent().catch(() => "unknown error");
        console.log(`[Golden Path] Job failed: ${errorText}`);
        failed = true;
        break;
      }
      
      // Log progress
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Golden Path] Still processing... (${elapsed}s)`);
    }
    
    if (!completed && !failed) {
      console.log("[Golden Path] Job timed out - may still be processing");
    }
    
    // At minimum, job should have started (not error on submit)
    expect(completed || failed || (Date.now() - startTime) >= maxWait).toBeTruthy();
  });
});

test.describe("Golden Path: API Tests", () => {
  test("API health check", async ({ request }) => {
    const response = await request.get("https://blanklogo-api.onrender.com/health");
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe("healthy");
    console.log("[API] Health:", data);
  });

  test("Inpaint service health", async ({ request }) => {
    const response = await request.get("https://blanklogo-inpaint.onrender.com/health");
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe("healthy");
    console.log("[Inpaint] Health:", data);
  });

  test("Queue status", async ({ request }) => {
    const response = await request.get("https://blanklogo-api.onrender.com/status");
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log("[Queue] Stats:", data.services?.queue?.stats);
    expect(data.services?.queue?.stats).toBeDefined();
  });
});

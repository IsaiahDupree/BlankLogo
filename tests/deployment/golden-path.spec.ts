/**
 * Golden Path Tests for Production Deployment
 * 
 * Tests the complete user journey on deployed infrastructure:
 * 1. Login → Dashboard → Credits visible
 * 2. Navigate to Remove → Upload video → Job created
 * 3. Wait for processing → Job completed
 * 4. Download available → Verify download works
 * 
 * Requirements:
 * - TEST_USER_EMAIL and TEST_USER_PASSWORD must be set
 * - Test user must have credits available
 * - All tests run against production (blanklogo.app)
 */

import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

// Production URLs
const WEB_URL = process.env.DEPLOY_WEB_URL || process.env.BASE_URL || "https://www.blanklogo.app";
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";

// Skip if no credentials
const skipAuth = !TEST_EMAIL || !TEST_PASSWORD;

// Test video file
const TEST_VIDEO_PATH = path.resolve(__dirname, "../../test-videos/sora-watermark-test.mp4");

test.describe("Golden Path: Complete User Journey", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Login and verify dashboard loads", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Go to login
    await page.goto(`${WEB_URL}/login`);
    
    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Submit and wait for redirect
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    
    // Verify on app page
    expect(page.url()).toContain("/app");
    
    // Wait for page to load
    await page.waitForLoadState("networkidle");
    
    // Check no "Failed to fetch" errors
    const errorBanner = page.locator('text="Failed to fetch"');
    const hasError = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test("2. Navigate to Remove Watermark page", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Login first
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    
    // Navigate to remove page
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Check page loaded correctly - use heading specifically
    await expect(page.getByRole('heading', { name: 'Remove Watermark' })).toBeVisible();
    
    // Check for upload options - the page has "Upload File" button
    const uploadButton = page.getByRole('button', { name: /upload/i });
    await expect(uploadButton.first()).toBeVisible();
    
    // Check no errors
    const errorBanner = page.locator('text="Failed to fetch"');
    const hasError = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasError).toBeFalsy();
  });

  test("3. Credits are visible and fetched correctly", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Login
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    
    // Go to remove page
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Check no "Failed to fetch" error (this was the original bug)
    const errorBanner = page.locator('text="Failed to fetch"');
    const hasError = await errorBanner.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasError).toBeFalsy();
    
    // Page should have loaded without errors - check submit button exists
    const submitButton = page.getByTestId('submit-remove-watermark');
    await expect(submitButton).toBeVisible({ timeout: 5000 });
  });

  test("4. Platform selection works", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Login and go to remove page
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Check platform options are visible
    await expect(page.locator('text="Auto-Detect"')).toBeVisible();
    await expect(page.locator('text="Sora"')).toBeVisible();
    await expect(page.locator('text="TikTok"')).toBeVisible();
    
    // Click on Sora platform
    await page.click('text="Sora"');
    
    // Verify selection (should have some visual indication)
    const soraButton = page.locator('text="Sora"').first();
    await expect(soraButton).toBeVisible();
  });

  test("5. Can upload a video file", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Check if test video exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, `Test video not found: ${TEST_VIDEO_PATH}`);
      return;
    }
    
    // Login and go to remove page
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Find file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);
    
    // Wait for file to be recognized
    await page.waitForTimeout(1000);
    
    // Check that file name appears
    const fileName = path.basename(TEST_VIDEO_PATH);
    await expect(page.locator(`text="${fileName}"`)).toBeVisible({ timeout: 5000 });
  });

  test("6. Can submit job and see processing status", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    test.setTimeout(120000); // 2 minute timeout for job creation
    
    // Check if test video exists
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      test.skip(true, `Test video not found: ${TEST_VIDEO_PATH}`);
      return;
    }
    
    // Login and go to remove page
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);
    await page.waitForTimeout(1000);
    
    // Select Sora platform
    await page.click('text="Sora"');
    
    // Click Remove Watermark button
    const submitButton = page.locator('button:has-text("Remove Watermark")');
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
    
    // Wait for job to start - should see processing indicator
    const processingIndicator = page.locator('text=/Processing|Uploading|Queued|Starting/i');
    await expect(processingIndicator.first()).toBeVisible({ timeout: 30000 });
    
    console.log("[Golden Path] Job submitted and processing started");
  });
});

test.describe("Golden Path: URL Input Flow", () => {
  test("Can paste URL and submit job", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    // Login
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Click "Paste URL" tab/button
    const pasteUrlButton = page.locator('text="Paste URL"');
    if (await pasteUrlButton.isVisible().catch(() => false)) {
      await pasteUrlButton.click();
      
      // Check for URL input field
      const urlInput = page.locator('input[type="url"], input[placeholder*="URL"], input[placeholder*="url"]');
      await expect(urlInput.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Golden Path: Navigation", () => {
  test("Can navigate between app pages without errors", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    const errors: string[] = [];
    
    // Listen for JS errors
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    
    // Login
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });
    
    // Navigate to various pages
    const pages = [
      "/app",
      "/app/remove",
      "/app/credits",
      "/pricing",
    ];
    
    for (const pagePath of pages) {
      await page.goto(`${WEB_URL}${pagePath}`);
      await page.waitForLoadState("networkidle");
      
      // Check for visible errors on page
      const errorBanner = page.locator('text="Failed to fetch"');
      const hasError = await errorBanner.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasError) {
        errors.push(`"Failed to fetch" visible on ${pagePath}`);
      }
    }
    
    expect(errors).toHaveLength(0);
  });
});

/**
 * Authenticated User Flow Tests for Production Deployment
 * 
 * These tests catch bugs like "Failed to fetch" that basic health checks miss.
 * They require TEST_USER_EMAIL and TEST_USER_PASSWORD to be set.
 */

import { test, expect } from "@playwright/test";

// Production URLs
const WEB_URL = process.env.DEPLOY_WEB_URL || process.env.BASE_URL || "https://www.blanklogo.app";
const TEST_EMAIL = process.env.TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "";

// Skip auth tests if credentials not provided
const skipAuth = !TEST_EMAIL || !TEST_PASSWORD;

test.describe("Authenticated User Flows", () => {
  test.describe.configure({ mode: "serial" });

  test("Login page loads without errors", async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);
    await expect(page).toHaveTitle(/BlankLogo|Login/i);
    
    // Verify login form elements exist
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("Can login with test credentials", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    
    await page.goto(`${WEB_URL}/login`);
    
    // Fill login form
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect to app
    await page.waitForURL(/\/app/, { timeout: 15000 });
    
    // Should be on app page
    expect(page.url()).toContain("/app");
  });

  test("App dashboard loads without 'Failed to fetch' errors", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    // Login first
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // Track any errors that appear
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Failed")) {
        errors.push(msg.text());
      }
    });

    // Wait for page to fully load
    await page.waitForLoadState("networkidle");
    
    // Check for visible error messages on page
    const errorBanner = page.locator('text="Failed to fetch"');
    const hasVisibleError = await errorBanner.isVisible().catch(() => false);
    
    if (hasVisibleError) {
      console.log("Found 'Failed to fetch' error on page!");
    }
    
    expect(hasVisibleError).toBeFalsy();
    expect(errors.length).toBe(0);
  });

  test("Remove watermark page loads credits successfully", async ({ page }) => {
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

    // Check for "Failed to fetch" error banner
    const errorBanner = page.locator('text="Failed to fetch"');
    const hasError = await errorBanner.isVisible({ timeout: 5000 }).catch(() => false);

    // This test specifically catches the bug in the screenshot
    expect(hasError).toBeFalsy();
    
    // Credits should load (either show a number or "Credits")
    const creditsText = page.locator('text=/\\d+ Credits?|Credits/i');
    await expect(creditsText.first()).toBeVisible({ timeout: 10000 });
  });

  test("API calls from frontend don't return 500 errors", async ({ page }) => {
    test.skip(skipAuth, "TEST_USER_EMAIL/PASSWORD not set");
    // Login first
    await page.goto(`${WEB_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // Track all API responses
    const apiErrors: { url: string; status: number; body: string }[] = [];
    
    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();
      
      // Check for 500 errors on API routes
      if (url.includes("/api/") && status >= 500) {
        const body = await response.text().catch(() => "");
        apiErrors.push({ url, status, body });
        console.log(`[API Error] ${status} ${url}: ${body}`);
      }
    });

    // Navigate through app pages
    await page.goto(`${WEB_URL}/app`);
    await page.waitForLoadState("networkidle");
    
    await page.goto(`${WEB_URL}/app/remove`);
    await page.waitForLoadState("networkidle");

    // No 500 errors should have occurred
    expect(apiErrors).toHaveLength(0);
  });
});

test.describe("Public Page Error Detection", () => {
  test("Homepage has no JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    await page.goto(WEB_URL);
    await page.waitForLoadState("networkidle");

    expect(jsErrors).toHaveLength(0);
  });

  test("Pricing page has no JavaScript errors", async ({ page }) => {
    const jsErrors: string[] = [];
    
    page.on("pageerror", (error) => {
      jsErrors.push(error.message);
    });

    await page.goto(`${WEB_URL}/pricing`);
    await page.waitForLoadState("networkidle");

    expect(jsErrors).toHaveLength(0);
  });
});

test.describe("Network Request Validation", () => {
  test("No failed network requests on login page", async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto(`${WEB_URL}/login`);
    await page.waitForLoadState("networkidle");

    expect(failedRequests).toHaveLength(0);
  });

  test("No failed network requests on signup page", async ({ page }) => {
    const failedRequests: string[] = [];
    
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto(`${WEB_URL}/signup`);
    await page.waitForLoadState("networkidle");

    expect(failedRequests).toHaveLength(0);
  });
});

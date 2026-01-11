import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * BlankLogo Screenshot E2E Tests
 * 
 * Takes screenshots at each step of the user flow to verify visual state.
 * Screenshots are saved to test-results/screenshots/ for review.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3939";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@blanklogo.local";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";
const SCREENSHOT_DIR = "test-results/screenshots";

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let stepNumber = 0;

async function screenshot(page: Page, name: string) {
  stepNumber++;
  const filename = `${String(stepNumber).padStart(2, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filename}`);
  return filepath;
}

async function loginUser(page: Page): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  
  await screenshot(page, "login-page");
  
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  
  await screenshot(page, "login-filled");
  
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  
  const url = page.url();
  const isLoggedIn = url.includes('/app') || !url.includes('/login');
  
  await screenshot(page, isLoggedIn ? "login-success" : "login-failed");
  
  return isLoggedIn;
}

test.describe("Screenshot Flow - Visual Verification", () => {
  test.beforeEach(() => {
    stepNumber = 0;
  });

  test("Complete User Journey with Screenshots", async ({ page }) => {
    test.setTimeout(120000);
    
    console.log("\n" + "=".repeat(50));
    console.log("  SCREENSHOT E2E TEST - Visual Verification");
    console.log("=".repeat(50) + "\n");

    // Step 1: Landing Page
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "01-landing-page");
    
    // Step 2: Login Flow
    const loggedIn = await loginUser(page);
    expect(loggedIn).toBe(true);

    // Step 3: Dashboard
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "dashboard");

    // Step 4: Check Credits Display
    const creditsVisible = await page.locator(':text("Credits")').isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`💰 Credits visible: ${creditsVisible}`);

    // Step 5: Navigate to Remove Watermark
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "remove-watermark-page");
    
    // Verify no hydration errors
    const hasError = await page.locator(':text("Unhandled Runtime Error")').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError).toBe(false);
    console.log(`✅ No hydration errors on remove page`);

    // Step 6: Enter Video URL
    const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
    if (await urlInput.isVisible({ timeout: 3000 })) {
      await urlInput.fill("https://www.w3schools.com/html/mov_bbb.mp4");
      await screenshot(page, "url-entered");
    }

    // Step 7: Select Platform
    const autoDetect = page.locator('button:has-text("Auto-Detect")');
    if (await autoDetect.isVisible({ timeout: 3000 })) {
      await autoDetect.click();
      await screenshot(page, "platform-selected");
    }

    // Step 8: Jobs Page
    await page.goto(`${BASE_URL}/app/jobs`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await screenshot(page, "jobs-page");
    
    // Verify no hydration errors on jobs page
    const hasJobsError = await page.locator(':text("Unhandled Runtime Error")').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasJobsError).toBe(false);
    console.log(`✅ No hydration errors on jobs page`);

    // Step 9: Settings Page
    await page.goto(`${BASE_URL}/app/settings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await screenshot(page, "settings-page");

    // Step 10: Credits/Pricing Page
    await page.goto(`${BASE_URL}/app/credits`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await screenshot(page, "credits-page");

    console.log("\n" + "=".repeat(50));
    console.log(`✅ All ${stepNumber} screenshots captured`);
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}/`);
    console.log("=".repeat(50) + "\n");
  });

  test("Form Validation Screenshots", async ({ page }) => {
    await loginUser(page);
    
    // Remove page with empty form
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Check submit button is disabled without URL
    const submitButton = page.locator('button:has-text("Remove Watermark")').first();
    const isDisabled = await submitButton.isDisabled();
    await screenshot(page, "submit-disabled-no-url");
    console.log(`🔒 Submit disabled without URL: ${isDisabled}`);

    // Enter invalid URL
    const urlInput = page.locator('input[placeholder*="URL"], input[type="url"]').first();
    if (await urlInput.isVisible({ timeout: 3000 })) {
      await urlInput.fill("not-a-valid-url");
      await screenshot(page, "invalid-url-entered");
    }

    // Enter valid URL
    await urlInput.fill("https://www.w3schools.com/html/mov_bbb.mp4");
    await screenshot(page, "valid-url-entered");
    
    const isEnabled = await submitButton.isEnabled();
    console.log(`✅ Submit enabled with valid URL: ${isEnabled}`);
  });

  test("Error State Screenshots", async ({ page }) => {
    // Try to access protected page without login
    await page.goto(`${BASE_URL}/app/jobs`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const url = page.url();
    if (url.includes('/login')) {
      await screenshot(page, "redirect-to-login");
      console.log(`🔐 Redirected to login when not authenticated`);
    } else {
      await screenshot(page, "jobs-page-unauth");
    }
  });

  test("Responsive Screenshots", async ({ page }) => {
    await loginUser(page);
    
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await screenshot(page, "desktop-1920x1080");
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await screenshot(page, "tablet-768x1024");
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await screenshot(page, "mobile-375x667");
  });
});

test.describe("Page-by-Page Screenshots", () => {
  test("All App Pages", async ({ page }) => {
    await loginUser(page);
    
    const pages = [
      { path: "/app", name: "dashboard" },
      { path: "/app/remove", name: "remove-watermark" },
      { path: "/app/jobs", name: "jobs-list" },
      { path: "/app/history", name: "history" },
      { path: "/app/credits", name: "credits" },
      { path: "/app/settings", name: "settings" },
    ];

    for (const p of pages) {
      await page.goto(`${BASE_URL}${p.path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      
      // Check for errors
      const hasError = await page.locator(':text("Error"), :text("error")').first().isVisible({ timeout: 1000 }).catch(() => false);
      
      await screenshot(page, `page-${p.name}`);
      console.log(`📄 ${p.name}: ${hasError ? '⚠️ Has errors' : '✅ OK'}`);
    }
  });

  test("Public Pages", async ({ page }) => {
    const publicPages = [
      { path: "/", name: "home" },
      { path: "/login", name: "login" },
      { path: "/signup", name: "signup" },
      { path: "/pricing", name: "pricing" },
    ];

    for (const p of publicPages) {
      await page.goto(`${BASE_URL}${p.path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      
      await screenshot(page, `public-${p.name}`);
      console.log(`📄 Public ${p.name}: captured`);
    }
  });
});

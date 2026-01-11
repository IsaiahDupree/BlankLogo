import { test, expect, Page } from "@playwright/test";
import * as path from "path";

/**
 * Test file upload functionality
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3939";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@blanklogo.local";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";

async function loginUser(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

test.describe("File Upload Flow", () => {
  test("Upload mode submit button works", async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await loginUser(page);
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Switch to upload mode
    const uploadTab = page.locator('button:has-text("Upload File")');
    await uploadTab.click();
    await page.waitForTimeout(500);
    console.log("✅ Switched to upload mode");

    // Create a small test video file
    const testVideoContent = Buffer.from('fake video content for testing');
    
    // Set up file chooser
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: testVideoContent,
    });
    await page.waitForTimeout(1000);
    console.log("✅ File selected");

    // Take screenshot before submit
    await page.screenshot({ path: 'test-results/upload-before-submit.png' });

    // Check if submit button is enabled
    const submitButton = page.locator('button:has-text("Remove Watermark")');
    const isDisabled = await submitButton.isDisabled();
    console.log(`📋 Submit button disabled: ${isDisabled}`);

    // Set up response listener
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/jobs'),
      { timeout: 30000 }
    ).catch(() => null);

    // Click submit
    await submitButton.click();
    console.log("🚀 Clicked submit button");

    // Wait for response or timeout
    await page.waitForTimeout(5000);

    // Take screenshot after submit
    await page.screenshot({ path: 'test-results/upload-after-submit.png' });

    // Check console logs for errors
    console.log("\n📝 Console logs:");
    consoleLogs.forEach(log => {
      if (log.includes('FORM SUBMITTED') || log.includes('REMOVE') || log.includes('error') || log.includes('Error')) {
        console.log(`  ${log}`);
      }
    });

    // Check if we see processing state or error
    const pageContent = await page.content();
    const hasProcessing = pageContent.includes('Removing Watermark') || pageContent.includes('Processing');
    const hasError = pageContent.includes('error') || pageContent.includes('Error');
    
    console.log(`\n📊 Result: Processing=${hasProcessing}, HasError=${hasError}`);
  });
});

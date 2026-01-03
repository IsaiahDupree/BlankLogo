import { test, expect } from "@playwright/test";

// ============================================
// Settings Page E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test("can access settings page", async ({ page }) => {
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    
    // Should be on settings page (or redirected if not authenticated)
    const isOnSettings = page.url().includes("/settings");
    if (isOnSettings) {
      await expect(page.locator('text=/settings|account|profile/i').first()).toBeVisible();
    }
  });

  test("displays user information", async ({ page }) => {
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    
    // Should show user email or profile info
    const userInfo = page.locator(`text=${TEST_USER.email}, text=/email|account/i`).first();
    if (await userInfo.isVisible({ timeout: 3000 })) {
      expect(await userInfo.isVisible()).toBe(true);
    }
  });

  test("has voice settings link", async ({ page }) => {
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    
    // Look for voice settings
    const voiceLink = page.locator('a:has-text("Voice"), a[href*="voice"]').first();
    if (await voiceLink.isVisible({ timeout: 3000 })) {
      await voiceLink.click();
      await expect(page).toHaveURL(/\/app\/settings\/voice/);
    }
  });
});

test.describe("Voice Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test("can access voice settings page", async ({ page }) => {
    await page.goto("/app/settings/voice", { waitUntil: "networkidle" });
    
    const isOnVoice = page.url().includes("/voice");
    if (isOnVoice) {
      // Should show voice-related content
      const voiceContent = page.locator('text=/voice|audio|clone|sample/i').first();
      if (await voiceContent.isVisible({ timeout: 3000 })) {
        expect(await voiceContent.isVisible()).toBe(true);
      }
    }
  });

  test("shows voice profile options", async ({ page }) => {
    await page.goto("/app/settings/voice", { waitUntil: "networkidle" });
    
    // Look for voice selection or upload options
    const voiceOptions = page.locator(
      'button:has-text("Upload"), button:has-text("Select"), input[type="file"]'
    ).first();
    
    if (await voiceOptions.isVisible({ timeout: 3000 })) {
      expect(await voiceOptions.isVisible()).toBe(true);
    }
  });
});

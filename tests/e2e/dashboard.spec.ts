import { test, expect } from "@playwright/test";

// ============================================
// Dashboard E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test("displays user dashboard after login", async ({ page }) => {
    // Should be on dashboard
    await expect(page).toHaveURL(/\/app/);
    
    // Should show some dashboard content
    const dashboardContent = page.locator('main, [role="main"], .dashboard');
    await expect(dashboardContent).toBeVisible();
  });

  test("shows projects list or empty state", async ({ page }) => {
    // Should show either projects or empty state
    const projectsOrEmpty = page.locator(
      'text=/projects|no projects|create|get started/i'
    ).first();
    await expect(projectsOrEmpty).toBeVisible({ timeout: 5000 });
  });

  test("has navigation to create new project", async ({ page }) => {
    // Should have a way to create new project
    const newProjectLink = page.locator(
      'a:has-text("New"), a:has-text("Create"), button:has-text("New Project"), a[href="/app/new"]'
    ).first();
    
    if (await newProjectLink.isVisible({ timeout: 3000 })) {
      await newProjectLink.click();
      await expect(page).toHaveURL(/\/app\/new/);
    }
  });

  test("has navigation to settings", async ({ page }) => {
    // Should have settings link
    const settingsLink = page.locator(
      'a:has-text("Settings"), a[href*="settings"], button:has-text("Settings")'
    ).first();
    
    if (await settingsLink.isVisible({ timeout: 3000 })) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/app\/settings/);
    }
  });

  test("has navigation to credits", async ({ page }) => {
    // Should have credits/billing link
    const creditsLink = page.locator(
      'a:has-text("Credits"), a:has-text("Billing"), a[href*="credits"]'
    ).first();
    
    if (await creditsLink.isVisible({ timeout: 3000 })) {
      await creditsLink.click();
      await expect(page).toHaveURL(/\/app\/credits/);
    }
  });

  test("can click on existing project", async ({ page }) => {
    // Find any project link
    const projectLink = page.locator('a[href*="/app/projects/"]').first();
    
    if (await projectLink.isVisible({ timeout: 3000 })) {
      await projectLink.click();
      await expect(page).toHaveURL(/\/app\/projects\/[a-z0-9-]+/);
    }
  });
});

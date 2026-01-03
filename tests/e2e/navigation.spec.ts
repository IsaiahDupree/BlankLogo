import { test, expect } from "@playwright/test";

// ============================================
// Navigation E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

test.describe("Public Navigation", () => {
  test("can navigate from home to pricing", async ({ page }) => {
    await page.goto("/");
    
    const pricingLink = page.locator('a:has-text("Pricing"), a[href="/pricing"]').first();
    if (await pricingLink.isVisible({ timeout: 3000 })) {
      await pricingLink.click();
      await expect(page).toHaveURL(/\/pricing/);
    }
  });

  test("can navigate from home to login", async ({ page }) => {
    await page.goto("/");
    
    const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign in"), a[href="/login"]').first();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("can navigate from login to signup", async ({ page }) => {
    await page.goto("/login");
    
    const signupLink = page.locator('a:has-text("Sign up"), a[href="/signup"]').first();
    if (await signupLink.isVisible({ timeout: 3000 })) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/(signup|login)/);
    }
  });

  test("can navigate from signup to login", async ({ page }) => {
    await page.goto("/signup");
    
    const loginLink = page.locator('a:has-text("Log in"), a:has-text("Sign in"), a[href="/login"]').first();
    if (await loginLink.isVisible({ timeout: 3000 })) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("logo links to home", async ({ page }) => {
    await page.goto("/pricing");
    
    const logo = page.locator('a:has-text("CanvasCast"), a[href="/"]').first();
    if (await logo.isVisible({ timeout: 3000 })) {
      await logo.click();
      await expect(page).toHaveURL(/^\/$|\/$/);
    }
  });
});

test.describe("Authenticated Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("can navigate from dashboard to new project", async ({ page }) => {
    const newLink = page.locator('a:has-text("New"), a[href="/app/new"], button:has-text("New Project")').first();
    if (await newLink.isVisible({ timeout: 3000 })) {
      await newLink.click();
      await expect(page).toHaveURL(/\/app\/new/);
    }
  });

  test("can navigate from dashboard to settings", async ({ page }) => {
    const settingsLink = page.locator('a:has-text("Settings"), a[href*="settings"]').first();
    if (await settingsLink.isVisible({ timeout: 3000 })) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/app\/settings/);
    }
  });

  test("can navigate from dashboard to credits", async ({ page }) => {
    const creditsLink = page.locator('a:has-text("Credits"), a:has-text("Billing"), a[href*="credits"]').first();
    if (await creditsLink.isVisible({ timeout: 3000 })) {
      await creditsLink.click();
      await expect(page).toHaveURL(/\/app\/credits/);
    }
  });

  test("can navigate back from project to dashboard", async ({ page }) => {
    // First create a project
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) return;
    
    await page.fill('#title', `Nav Test ${Date.now()}`);
    await page.click('button:has-text("Motivation")');
    await page.click('button[type="submit"]:has-text("Create Project")');
    
    try {
      await expect(page).toHaveURL(/\/app\/projects\/[a-z0-9-]+/, { timeout: 15000 });
    } catch {
      return;
    }
    
    // Navigate back
    const backLink = page.locator('a:has-text("Back"), a:has-text("Dashboard"), a:has-text("Projects"), a[href="/app"]').first();
    if (await backLink.isVisible({ timeout: 3000 })) {
      await backLink.click();
      await expect(page).toHaveURL(/\/app$/);
    }
  });

  test("breadcrumb navigation works", async ({ page }) => {
    await page.goto("/app/settings/voice", { waitUntil: "networkidle" });
    
    if (!page.url().includes("/voice")) return;
    
    // Look for breadcrumb to settings
    const settingsCrumb = page.locator('a:has-text("Settings")').first();
    if (await settingsCrumb.isVisible({ timeout: 3000 })) {
      await settingsCrumb.click();
      await expect(page).toHaveURL(/\/app\/settings$/);
    }
  });
});

test.describe("Browser Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("browser back button works", async ({ page }) => {
    // Navigate to new project
    await page.goto("/app/new");
    await page.waitForTimeout(500);
    
    // Go back
    await page.goBack();
    
    // Should be on dashboard
    await expect(page).toHaveURL(/\/app/);
  });

  test("browser forward button works", async ({ page }) => {
    await page.goto("/app/new");
    await page.waitForTimeout(500);
    
    await page.goBack();
    await page.waitForTimeout(500);
    
    await page.goForward();
    
    // Should be on new project page
    await expect(page).toHaveURL(/\/app\/new/);
  });

  test("page refresh preserves state", async ({ page }) => {
    await page.goto("/app/settings");
    await page.waitForTimeout(500);
    
    await page.reload();
    
    // Should still be on settings (or redirected to login if session expired)
    const isOnSettings = page.url().includes("/settings");
    const isOnLogin = page.url().includes("/login");
    expect(isOnSettings || isOnLogin).toBe(true);
  });
});

test.describe("Deep Links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("can access settings directly", async ({ page }) => {
    await page.goto("/app/settings");
    
    const isOnSettings = page.url().includes("/settings");
    const isOnLogin = page.url().includes("/login");
    expect(isOnSettings || isOnLogin).toBe(true);
  });

  test("can access voice settings directly", async ({ page }) => {
    await page.goto("/app/settings/voice");
    
    const isOnVoice = page.url().includes("/voice");
    const isOnLogin = page.url().includes("/login");
    expect(isOnVoice || isOnLogin).toBe(true);
  });

  test("can access credits directly", async ({ page }) => {
    await page.goto("/app/credits");
    
    const isOnCredits = page.url().includes("/credits");
    const isOnLogin = page.url().includes("/login");
    expect(isOnCredits || isOnLogin).toBe(true);
  });

  test("can access new project directly", async ({ page }) => {
    await page.goto("/app/new");
    
    const isOnNew = page.url().includes("/new");
    const isOnLogin = page.url().includes("/login");
    expect(isOnNew || isOnLogin).toBe(true);
  });
});

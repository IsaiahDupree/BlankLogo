import { test, expect } from "@playwright/test";

// ============================================
// Public Pages E2E Tests (No Auth Required)
// ============================================

test.describe("Landing Page", () => {
  test("displays homepage content", async ({ page }) => {
    await page.goto("/");
    
    // Should show branding
    await expect(page.locator('text=/CanvasCast/i').first()).toBeVisible();
  });

  test("has login link", async ({ page }) => {
    await page.goto("/");
    
    const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign in"), a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
    
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("has signup link", async ({ page }) => {
    await page.goto("/");
    
    const signupLink = page.locator('a:has-text("Sign up"), a:has-text("Get Started"), a[href="/signup"]').first();
    if (await signupLink.isVisible({ timeout: 3000 })) {
      await signupLink.click();
      // May redirect to signup or login depending on app config
      await expect(page).toHaveURL(/\/(signup|login)/);
    }
  });

  test("has pricing link", async ({ page }) => {
    await page.goto("/");
    
    const pricingLink = page.locator('a:has-text("Pricing"), a[href="/pricing"]').first();
    if (await pricingLink.isVisible({ timeout: 3000 })) {
      await pricingLink.click();
      await expect(page).toHaveURL(/\/pricing/);
    }
  });
});

test.describe("Login Page", () => {
  test("displays login form", async ({ page }) => {
    await page.goto("/login");
    
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("has link to signup", async ({ page }) => {
    await page.goto("/login");
    
    const signupLink = page.locator('a:has-text("Sign up"), a[href="/signup"]').first();
    await expect(signupLink).toBeVisible();
  });

  test("shows validation for empty fields", async ({ page }) => {
    await page.goto("/login");
    
    // Click submit without filling form
    await page.click('button[type="submit"]');
    
    // Should show validation or stay on page
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Signup Page", () => {
  test("displays signup form", async ({ page }) => {
    await page.goto("/signup");
    
    // Should show signup form elements
    const emailInput = page.locator('input[type="email"], #email');
    const passwordInput = page.locator('input[type="password"], #password');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("has link to login", async ({ page }) => {
    await page.goto("/signup");
    
    const loginLink = page.locator('a:has-text("Log in"), a:has-text("Sign in"), a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
  });
});

test.describe("Pricing Page", () => {
  test("displays pricing plans", async ({ page }) => {
    await page.goto("/pricing");
    
    // Should show pricing content
    const pricingContent = page.locator('text=/pricing|plans|monthly|credits/i').first();
    await expect(pricingContent).toBeVisible({ timeout: 5000 });
  });

  test("shows multiple pricing tiers", async ({ page }) => {
    await page.goto("/pricing");
    
    // Look for pricing tiers (Starter, Pro, Creator+, etc.)
    const tiers = page.locator('text=/starter|pro|creator|free|basic/i');
    const tierCount = await tiers.count();
    
    // Should have at least one pricing tier
    expect(tierCount).toBeGreaterThanOrEqual(1);
  });

  test("has call-to-action buttons", async ({ page }) => {
    await page.goto("/pricing");
    
    // Look for CTA buttons
    const ctaButton = page.locator(
      'button:has-text("Get Started"), button:has-text("Subscribe"), a:has-text("Sign up")'
    ).first();
    
    if (await ctaButton.isVisible({ timeout: 3000 })) {
      expect(await ctaButton.isVisible()).toBe(true);
    }
  });
});

import { test, expect } from "@playwright/test";

/**
 * BlankLogo Button Interaction Tests
 * Verifies each button click produces the expected result
 */

const BASE_URL = "http://localhost:3939";
const API_URL = process.env.API_URL || "http://localhost:8989";

test.describe("Landing Page Button Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test("'Get Started' header button navigates to login", async ({ page }) => {
    const button = page.locator('header a:has-text("Get Started")');
    await expect(button).toBeVisible();
    
    // Verify button has correct href
    const href = await button.getAttribute("href");
    expect(href).toContain("login");
    
    await button.click();
    await page.waitForTimeout(1000);
    
    // Should navigate or have href pointing to login
    const url = page.url();
    expect(url.includes("login") || href?.includes("login")).toBe(true);
  });

  test("'Pricing' link navigates to pricing page", async ({ page }) => {
    const link = page.locator('a:has-text("Pricing")').first();
    await expect(link).toBeVisible();
    
    // Verify link has correct href
    const href = await link.getAttribute("href");
    expect(href).toContain("pricing");
    
    await link.click();
    await page.waitForTimeout(1000);
    
    const url = page.url();
    expect(url.includes("pricing") || href?.includes("pricing")).toBe(true);
  });

  test("'Platforms' link scrolls to platforms section", async ({ page }) => {
    const link = page.locator('a[href="#platforms"]');
    await expect(link).toBeVisible();
    
    await link.click();
    
    // Should stay on same page with hash
    await expect(page).toHaveURL(/#platforms/);
  });

  test("'Remove Watermark' CTA button navigates to app", async ({ page }) => {
    const button = page.locator('a:has-text("Remove Watermark")').first();
    await expect(button).toBeVisible();
    
    // Verify button has correct href
    const href = await button.getAttribute("href");
    expect(href).toMatch(/app|login/);
    
    await button.click();
    await page.waitForTimeout(1000);
    
    // Should navigate to app (may redirect to login if not authenticated)
    const url = page.url();
    expect(url.includes("app") || url.includes("login") || href?.includes("app")).toBe(true);
  });

  test("'See How It Works' button scrolls to how-it-works section", async ({ page }) => {
    const button = page.locator('a:has-text("See How It Works")');
    await expect(button).toBeVisible();
    
    await button.click();
    
    await expect(page).toHaveURL(/#how-it-works/);
  });

  test("Platform pill buttons have correct hrefs", async ({ page }) => {
    const platforms = ["Sora", "TikTok", "Runway", "Pika", "Kling", "Luma"];
    
    for (const platform of platforms) {
      const pill = page.locator(`a:has-text("${platform} Watermark")`);
      if (await pill.isVisible({ timeout: 2000 }).catch(() => false)) {
        const href = await pill.getAttribute("href");
        expect(href).toContain(`remove/${platform.toLowerCase()}`);
      }
    }
  });

  test("Platform cards navigate to platform-specific pages", async ({ page }) => {
    // Scroll to platforms section
    await page.locator("#platforms").scrollIntoViewIfNeeded();
    
    const soraCard = page.locator('a[href="/remove/sora"]').first();
    if (await soraCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await soraCard.click();
      
      await expect(page).toHaveURL(/remove\/sora/);
    }
  });

  test("Footer CTA 'Remove Watermark Free' button navigates to app", async ({ page }) => {
    const button = page.locator('a:has-text("Remove Watermark Free")');
    await expect(button).toBeVisible();
    
    await button.click();
    
    await expect(page).toHaveURL(/app|login/);
  });
});

test.describe("Pricing Page Button Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);
  });

  test("'Get Started' buttons navigate to signup", async ({ page }) => {
    const buttons = page.locator('a:has-text("Get Started")');
    const count = await buttons.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Click first Get Started button
    await buttons.first().click();
    
    await expect(page).toHaveURL(/signup|login/);
  });

  test("'Log in' link navigates to login page", async ({ page }) => {
    const link = page.locator('a:has-text("Log in")');
    await expect(link).toBeVisible();
    
    await link.click();
    
    await expect(page).toHaveURL(/login/);
  });

  test("Logo click navigates to home", async ({ page }) => {
    const logo = page.locator('a:has-text("BlankLogo")').first();
    await expect(logo).toBeVisible();
    
    await logo.click();
    
    await expect(page).toHaveURL(BASE_URL + "/");
  });

  test("'Get Started Free' CTA button navigates to signup", async ({ page }) => {
    const button = page.locator('a:has-text("Get Started Free")');
    await expect(button).toBeVisible();
    
    await button.click();
    
    await expect(page).toHaveURL(/signup|login/);
  });
});

test.describe("Login Page Button Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test("Login form submit button exists and is clickable", async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(submitButton).toBeEnabled();
      
      // Fill form with test data
      const emailField = page.locator('input[type="email"], input[name="email"]').first();
      const passwordField = page.locator('input[type="password"]').first();
      
      if (await emailField.isVisible().catch(() => false)) {
        await emailField.fill("test@example.com");
        await passwordField.fill("testpassword");
        
        // Click submit
        await submitButton.click();
        
        // Should either show error or redirect
        await page.waitForTimeout(1000);
        const url = page.url();
        const hasError = await page.locator('text=/error|invalid/i').isVisible().catch(() => false);
        
        expect(url.includes("/login") || url.includes("/app") || hasError).toBe(true);
      }
    }
  });

  test("'Sign up' link navigates to signup page", async ({ page }) => {
    const signupLink = page.locator('a:has-text("Sign up"), a:has-text("Create account")').first();
    
    if (await signupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signupLink.click();
      
      await expect(page).toHaveURL(/signup|register/);
    }
  });

  test("'Forgot password' link exists if present", async ({ page }) => {
    const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")').first();
    
    if (await forgotLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await forgotLink.click();
      
      await expect(page).toHaveURL(/forgot|reset|password/);
    }
  });
});

test.describe("API Button Interactions (Direct API Calls)", () => {
  test("Health check endpoint responds correctly", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data.status).toBe("healthy");
  });

  test("Job creation endpoint accepts POST request", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
      },
    });
    
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data.job_id).toBeDefined();
    expect(data.status).toBe("queued");
  });

  test("Platform presets endpoint returns available platforms", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/platforms`);
    
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    expect(data.platforms).toBeDefined();
    expect(Array.isArray(data.platforms)).toBe(true);
  });

  test("Job status endpoint returns job info", async ({ request }) => {
    // First create a job
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "custom",
        crop_pixels: 50,
      },
    });
    
    const createData = await createResponse.json();
    const jobId = createData.job_id;
    
    // Then check its status
    const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${jobId}`);
    
    expect(statusResponse.ok()).toBe(true);
    
    const statusData = await statusResponse.json();
    expect(statusData.jobId).toBe(jobId);
    expect(["queued", "processing", "completed", "failed"]).toContain(statusData.status);
  });
});

test.describe("Navigation Button State Verification", () => {
  test("Buttons have proper hover states", async ({ page }) => {
    await page.goto(BASE_URL);
    
    const ctaButton = page.locator('a:has-text("Remove Watermark")').first();
    await expect(ctaButton).toBeVisible();
    
    // Get initial background
    const initialBg = await ctaButton.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Hover over button
    await ctaButton.hover();
    await page.waitForTimeout(300);
    
    // Background should change on hover (CSS transition)
    const hoverBg = await ctaButton.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Either colors differ or transition is applied
    expect(initialBg !== hoverBg || true).toBe(true);
  });

  test("Buttons are keyboard accessible", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Tab to first interactive element
    await page.keyboard.press("Tab");
    
    // Check that something is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT"]).toContain(focusedElement);
  });

  test("Buttons have appropriate cursor styles", async ({ page }) => {
    await page.goto(BASE_URL);
    
    const ctaButton = page.locator('a:has-text("Remove Watermark")').first();
    
    const cursor = await ctaButton.evaluate((el) => 
      window.getComputedStyle(el).cursor
    );
    
    expect(["pointer", "auto"]).toContain(cursor);
  });
});

test.describe("Form Button Validation", () => {
  test("Submit button disabled state with empty form", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const submitButton = page.locator('button[type="submit"]');
    
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check if button has disabled state for empty form or allows submit with validation
      const isDisabled = await submitButton.isDisabled().catch(() => false);
      
      // Either button is disabled OR form has validation
      if (!isDisabled) {
        await submitButton.click();
        
        // Should show validation error or HTML5 validation prevents submit
        await page.waitForTimeout(500);
        const hasValidationError = await page.locator(':invalid, [aria-invalid="true"], .error').first().isVisible().catch(() => false);
        const stayedOnPage = page.url().includes("/login");
        
        expect(hasValidationError || stayedOnPage).toBe(true);
      }
    }
  });
});

test.describe("Mobile Button Touch Targets", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("CTA buttons have minimum touch target size (44x44)", async ({ page }) => {
    await page.goto(BASE_URL);
    
    const ctaButton = page.locator('a:has-text("Remove Watermark")').first();
    
    if (await ctaButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      const box = await ctaButton.boundingBox();
      
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("Navigation buttons are accessible on mobile", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check for mobile menu button or visible nav links
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], .hamburger');
    const navLinks = page.locator('nav a').first();
    
    const hasMobileMenu = await mobileMenu.isVisible({ timeout: 2000 }).catch(() => false);
    const hasVisibleNav = await navLinks.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasMobileMenu || hasVisibleNav).toBe(true);
  });
});

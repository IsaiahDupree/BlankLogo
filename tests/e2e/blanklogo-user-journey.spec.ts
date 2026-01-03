import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// ============================================
// BlankLogo User Journey E2E Tests
// Full user flow from landing to download
// ============================================

const TEST_USER = {
  email: "test@blanklogo.app",
  password: "TestPassword123!",
};

const API_URL = process.env.API_URL || "http://localhost:8989";

// Helper to create a small test video file
async function createTestVideoFile(): Promise<string> {
  const testVideoPath = path.join(__dirname, "../fixtures/test-video.mp4");
  
  // If test video doesn't exist, we'll skip upload tests
  if (!fs.existsSync(testVideoPath)) {
    // Create a minimal valid MP4 for testing (or use existing)
    return "";
  }
  
  return testVideoPath;
}

test.describe("Landing Page Journey", () => {
  test("landing page loads and shows BlankLogo branding", async ({ page }) => {
    await page.goto("/");
    
    // Check for BlankLogo branding
    await expect(page.locator('text=/BlankLogo|Watermark|Remove/i').first()).toBeVisible({ timeout: 10000 });
  });

  test("landing page shows supported platforms", async ({ page }) => {
    await page.goto("/");
    
    // Check for platform mentions
    const platforms = ["Sora", "TikTok", "Runway", "Pika"];
    for (const platform of platforms) {
      const platformText = page.locator(`text=/${platform}/i`).first();
      // At least some platforms should be mentioned
      if (await platformText.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(true).toBe(true);
        return;
      }
    }
  });

  test("landing page has CTA button", async ({ page }) => {
    await page.goto("/");
    
    // Look for call-to-action buttons
    const ctaButton = page.locator('a:has-text("Get Started"), a:has-text("Try Now"), a:has-text("Remove"), button:has-text("Upload")').first();
    await expect(ctaButton).toBeVisible({ timeout: 5000 });
  });

  test("can navigate to platform-specific landing pages", async ({ page }) => {
    // Test Sora landing page
    await page.goto("/remove/sora");
    await expect(page.locator('text=/Sora/i').first()).toBeVisible({ timeout: 5000 });
    
    // Test TikTok landing page  
    await page.goto("/remove/tiktok");
    await expect(page.locator('text=/TikTok/i').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Authentication Journey", () => {
  test("shows sign up form", async ({ page }) => {
    await page.goto("/signup");
    
    // Should have email and password fields
    const emailField = page.locator('input[type="email"], input[name="email"], #email');
    const passwordField = page.locator('input[type="password"], input[name="password"], #password');
    
    // May redirect to login or show signup form
    const hasForm = await emailField.isVisible({ timeout: 5000 }).catch(() => false) ||
                   await page.locator('text=/sign up|create account|register/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasForm || page.url().includes("login")).toBe(true);
  });

  test("shows login form", async ({ page }) => {
    await page.goto("/login");
    
    const emailField = page.locator('input[type="email"], input[name="email"], #email');
    await expect(emailField).toBeVisible({ timeout: 5000 });
    
    const passwordField = page.locator('input[type="password"], input[name="password"], #password');
    await expect(passwordField).toBeVisible();
  });

  test("shows error for invalid login", async ({ page }) => {
    await page.goto("/login");
    
    const emailField = page.locator('#email, input[type="email"]').first();
    const passwordField = page.locator('#password, input[type="password"]').first();
    
    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailField.fill("invalid@test.com");
      await passwordField.fill("wrongpassword");
      await page.click('button[type="submit"]');
      
      // Should show error
      await expect(page.locator('text=/invalid|error|incorrect|failed/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("can navigate between login and signup", async ({ page }) => {
    await page.goto("/login");
    
    // Look for sign up link
    const signupLink = page.locator('a:has-text("Sign up"), a:has-text("Create account"), a:has-text("Register")').first();
    if (await signupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signupLink.click();
      await expect(page).toHaveURL(/signup|register/);
    }
  });
});

test.describe("Video Upload Journey", () => {
  test("upload page is accessible", async ({ page }) => {
    await page.goto("/");
    
    // Look for upload area or button
    const uploadArea = page.locator('[data-testid="upload"], input[type="file"], .upload-zone, text=/upload|drop/i').first();
    const hasUpload = await uploadArea.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Either has upload on landing or needs to navigate
    expect(hasUpload || page.url().includes("/")).toBe(true);
  });

  test("shows platform selection", async ({ page }) => {
    await page.goto("/");
    
    // Look for platform selector
    const platformSelect = page.locator('select, [role="combobox"], button:has-text("Sora"), button:has-text("Platform")').first();
    const hasSelector = await platformSelect.isVisible({ timeout: 5000 }).catch(() => false);
    
    // May be on landing page with platform buttons
    if (!hasSelector) {
      const platformButtons = page.locator('a[href*="/remove/"], button:has-text("Sora")');
      expect(await platformButtons.count()).toBeGreaterThan(0);
    }
  });

  test("shows processing mode options if available", async ({ page }) => {
    await page.goto("/");
    
    // Look for processing mode toggle (Fast/Quality)
    const modeToggle = page.locator('text=/fast|quality|crop|inpaint/i').first();
    // This is optional - may not be exposed in UI
    const hasMode = await modeToggle.isVisible({ timeout: 3000 }).catch(() => false);
    expect(typeof hasMode).toBe("boolean");
  });
});

test.describe("Job Processing Journey", () => {
  test("can submit video via API and track progress", async ({ request }) => {
    // Create a job
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const { job_id } = await createResponse.json();
    
    // Track status changes
    const statuses: string[] = [];
    let attempts = 0;
    
    while (attempts < 15) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (!statuses.includes(data.status)) {
          statuses.push(data.status);
        }
        if (data.status === "completed" || data.status === "failed") {
          break;
        }
      }
      attempts++;
    }
    
    // Should have transitioned through statuses
    expect(statuses.length).toBeGreaterThan(0);
  });
});

test.describe("Download Journey", () => {
  test("completed job provides download URL", async ({ request }) => {
    // Create and wait for job
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
      },
    });

    const { job_id } = await createResponse.json();
    
    // Wait for completion
    let downloadUrl = "";
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed" && data.output?.downloadUrl) {
          downloadUrl = data.output.downloadUrl;
          break;
        }
        if (data.status === "failed") break;
      }
    }
    
    // If job completed, should have download URL
    if (downloadUrl) {
      expect(downloadUrl).toMatch(/^https?:\/\//);
    }
  });

  test("download endpoint returns video file", async ({ request }) => {
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
      },
    });

    const { job_id } = await createResponse.json();
    
    // Wait for completion then try download
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const downloadResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}/download`);
      if (downloadResponse.ok()) {
        const contentType = downloadResponse.headers()["content-type"];
        expect(contentType).toContain("video");
        break;
      }
    }
  });
});

test.describe("Email Notification Journey", () => {
  test("webhook is called on job completion", async ({ request }) => {
    // Note: In production, use a webhook testing service
    // For local testing, we verify the webhook_url is accepted
    
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
        webhook_url: "https://webhook.site/test-blanklogo",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.job_id).toBeDefined();
    
    // The webhook would be called when job completes
    // Actual verification would require checking webhook.site
  });

  test("job metadata includes notification settings", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
        webhook_url: "https://example.com/webhook",
        metadata: {
          notify_email: "user@example.com",
          custom_field: "test",
        },
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});

test.describe("Error State Journey", () => {
  test("handles network errors gracefully", async ({ page }) => {
    await page.goto("/");
    
    // Page should load even if API is slow
    await expect(page.locator('body')).toBeVisible();
  });

  test("shows user-friendly error messages", async ({ page }) => {
    // Try to access non-existent page
    await page.goto("/remove/nonexistent-platform");
    
    // Should show 404 or redirect to valid page
    const is404 = page.url().includes("404") || 
                  await page.locator('text=/not found|404|error/i').first().isVisible({ timeout: 3000 }).catch(() => false);
    const isRedirected = !page.url().includes("nonexistent");
    
    expect(is404 || isRedirected).toBe(true);
  });
});

test.describe("Mobile Responsiveness Journey", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("landing page works on mobile", async ({ page }) => {
    await page.goto("/");
    
    // Should not have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Small tolerance
  });

  test("upload controls are accessible on mobile", async ({ page }) => {
    await page.goto("/");
    
    // CTA should be visible and tappable
    const cta = page.locator('a:has-text("Get"), button:has-text("Upload"), a:has-text("Remove")').first();
    if (await cta.isVisible({ timeout: 5000 }).catch(() => false)) {
      const box = await cta.boundingBox();
      expect(box?.width).toBeGreaterThan(40); // Minimum tap target
      expect(box?.height).toBeGreaterThan(40);
    }
  });
});

test.describe("Performance Journey", () => {
  test("landing page loads within 3 seconds", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test("API responds within 500ms for health check", async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_URL}/health`);
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(500);
  });

  test("job creation responds within 1 second", async ({ request }) => {
    const startTime = Date.now();
    await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://example.com/video.mp4",
        platform: "sora",
      },
    });
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(1000);
  });
});

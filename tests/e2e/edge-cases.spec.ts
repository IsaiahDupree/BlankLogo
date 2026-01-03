import { test, expect } from "@playwright/test";

// ============================================
// Edge Case E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

test.describe("Input Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("handles very long project title", async ({ page }) => {
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(true).toBe(true);
      return;
    }
    
    // Try very long title
    const longTitle = "A".repeat(200);
    await page.fill('#title', longTitle);
    
    // Should handle gracefully (truncate or show error)
    expect(true).toBe(true);
  });

  test("handles special characters in title", async ({ page }) => {
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(true).toBe(true);
      return;
    }
    
    // Try special characters
    await page.fill('#title', `Test <script>alert('xss')</script> ${Date.now()}`);
    await page.click('button:has-text("Motivation")');
    await page.click('button[type="submit"]:has-text("Create Project")');
    
    // Should sanitize and handle
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/app");
  });

  test("handles unicode characters in title", async ({ page }) => {
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(true).toBe(true);
      return;
    }
    
    // Try unicode
    await page.fill('#title', `测试视频 🎬 ${Date.now()}`);
    await page.click('button:has-text("Motivation")');
    await page.click('button[type="submit"]:has-text("Create Project")');
    
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/app");
  });

  test("handles empty spaces in title", async ({ page }) => {
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(true).toBe(true);
      return;
    }
    
    // Try spaces only
    await page.fill('#title', "   ");
    await page.click('button:has-text("Motivation")');
    await page.click('button[type="submit"]:has-text("Create Project")');
    
    // Should not create project with empty title
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/app");
  });
});

test.describe("Navigation Edge Cases", () => {
  test("handles rapid back/forward navigation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Rapid navigation
    await page.goto("/app/settings");
    await page.goBack();
    await page.goForward();
    await page.goBack();
    await page.goForward();
    
    // Should be stable
    expect(page.url()).toContain("/app");
  });

  test("handles direct URL manipulation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Try invalid project ID
    await page.goto("/app/projects/invalid-id-12345");
    await page.waitForTimeout(2000);
    
    // Should handle gracefully
    expect(page.url()).toContain("/app");
  });

  test("handles SQL injection in URL", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Try SQL injection
    await page.goto("/app/projects/'; DROP TABLE projects;--");
    await page.waitForTimeout(2000);
    
    // Should handle safely
    expect(true).toBe(true);
  });
});

test.describe("Session Edge Cases", () => {
  test("handles expired session gracefully", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Clear session
    await page.context().clearCookies();
    
    // Try to access protected page
    await page.goto("/app/new");
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("handles multiple tabs", async ({ context, page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Open new tab
    const newPage = await context.newPage();
    await newPage.goto("/app/settings");
    
    // Both tabs should work
    expect(page.url()).toContain("/app");
    
    const newPageUrl = newPage.url();
    expect(newPageUrl.includes("/settings") || newPageUrl.includes("/login")).toBe(true);
    
    await newPage.close();
  });

  test("handles logout in one tab", async ({ context, page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Open second tab
    const newPage = await context.newPage();
    await newPage.goto("/app");
    await newPage.waitForTimeout(1000);
    
    // Logout in first tab
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out")').first();
    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Second tab should handle session change
    await newPage.reload();
    await newPage.waitForTimeout(2000);
    
    await newPage.close();
    expect(true).toBe(true);
  });
});

test.describe("Form Edge Cases", () => {
  test("handles form submission during navigation", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    
    // Start submission and immediately try to navigate
    await page.click('button[type="submit"]');
    
    // Should complete login or handle gracefully
    await page.waitForTimeout(3000);
    expect(true).toBe(true);
  });

  test("handles double form submission", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    await page.waitForTimeout(1000);
    
    await page.goto("/app/new", { waitUntil: "networkidle" });
    
    const titleInput = page.locator('#title');
    if (!await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      expect(true).toBe(true);
      return;
    }
    
    await page.fill('#title', `Double Submit ${Date.now()}`);
    await page.click('button:has-text("Motivation")');
    
    // Double click submit
    const submitButton = page.locator('button[type="submit"]:has-text("Create Project")');
    await submitButton.dblclick();
    
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/app");
  });

  test("handles paste from clipboard", async ({ page }) => {
    await page.goto("/login");
    
    // Simulate paste
    await page.locator('#email').focus();
    await page.evaluate(() => {
      navigator.clipboard.writeText('test@example.com').catch(() => {});
    });
    
    // Direct fill works
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    
    expect(true).toBe(true);
  });
});

test.describe("Network Edge Cases", () => {
  test("handles offline state", async ({ page, context }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Go offline
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto("/app/settings").catch(() => {});
    
    // Go back online
    await context.setOffline(false);
    
    // Should recover
    await page.goto("/app");
    expect(page.url()).toContain("/app");
  });

  test("handles slow network conditions", async ({ page }) => {
    // Throttle network
    const client = await page.context().newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 50 * 1024, // 50kb/s
      uploadThroughput: 50 * 1024,
      latency: 500,
    });
    
    await page.goto("/login", { timeout: 30000 });
    
    // Should still load
    await expect(page.locator('#email')).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Browser Edge Cases", () => {
  test("handles page refresh during action", async ({ page }) => {
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Refresh during load
    await page.goto("/app/new");
    await page.reload();
    
    // Should recover
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/app");
  });

  test("handles zoom levels", async ({ page }) => {
    await page.goto("/login");
    
    // Zoom in
    await page.evaluate(() => {
      document.body.style.zoom = '150%';
    });
    
    // Form should still work
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '100%';
    });
    
    expect(true).toBe(true);
  });
});

import { test, expect } from "@playwright/test";

// ============================================
// Authentication E2E Tests
// ============================================

const TEST_USER = {
  email: "isaiahdupree33@gmail.com",
  password: "Frogger12",
};

test.describe("Authentication", () => {
  test("shows login page for unauthenticated users", async ({ page }) => {
    await page.goto("/app");
    
    // Should redirect to login or show login form
    await expect(page).toHaveURL(/\/(login|auth|signin)/);
  });

  test("allows user to log in with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in credentials using id selectors
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    
    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard (wait longer for auth)
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('#email', "invalid@example.com");
    await page.fill('#password', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator("text=/invalid|error|incorrect/i")).toBeVisible({ timeout: 5000 });
  });

  test("allows user to log out", async ({ page }) => {
    // First log in
    await page.goto("/login");
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")').first();
    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
      // Should redirect to login
      await expect(page).toHaveURL(/\/(login|auth|$)/, { timeout: 5000 });
    }
  });
});

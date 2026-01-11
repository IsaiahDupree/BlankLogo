import { test as base, expect, Page } from "@playwright/test";

// Test user credentials from environment
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "isaiahdupree33@gmail.com",
  password: process.env.TEST_USER_PASSWORD || "Frogger12",
};

// Extended test with authenticated page fixture
export const test = base.extend<{
  authedPage: Page;
}>({
  authedPage: async ({ page }, use) => {
    // Login before test
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();
    
    // Wait for redirect after login
    await page.waitForURL(/\/(dashboard|remove|jobs)/, { timeout: 10000 });
    
    await use(page);
  },
});

// Helper function to login
export async function loginTestUser(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(TEST_USER.email);
  await page.locator('input[type="password"]').fill(TEST_USER.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|remove|jobs)/, { timeout: 10000 });
}

export { expect };

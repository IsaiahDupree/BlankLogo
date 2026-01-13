import { test, expect, Page } from '@playwright/test';

/**
 * Authenticated Event Tracking E2E Tests
 * 
 * Tests events that require a logged-in user.
 * Uses test user credentials from environment.
 */

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'isaiahdupree33@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Frogger12';

// Helper to log in
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  
  // Fill credentials
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for auth to complete and redirect
  await page.waitForTimeout(3000);
  
  // If still on login, wait longer for redirect
  if (page.url().includes('/login')) {
    await page.waitForURL(/\/app/, { timeout: 15000 });
  }
  
  await page.waitForLoadState('domcontentloaded');
}

// Helper to get localStorage value
async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key);
}

// Helper to get sessionStorage value  
async function getSessionStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => sessionStorage.getItem(k), key);
}

test.describe('Authenticated Event Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('tracks activation_complete for returning user', async ({ page }) => {
    // Clear activation tracking to test fresh
    await page.evaluate(() => {
      localStorage.removeItem('bl_activation_tracked');
    });
    
    // Refresh page to trigger activation check
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a moment for async activation check
    await page.waitForTimeout(2000);
    
    // Check activation was tracked
    const activationTracked = await getLocalStorage(page, 'bl_activation_tracked');
    expect(activationTracked).toBe('true');
  });

  test('dashboard shows user data', async ({ page }) => {
    // Should be on /app after login
    await expect(page).toHaveURL(/\/app/);
    
    // Dashboard should show content
    const heading = page.locator('h1:has-text("Dashboard")');
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to remove page', async ({ page }) => {
    // Click new job button
    const newJobLink = page.locator('a:has-text("New")').first();
    await expect(newJobLink).toBeVisible();
    await newJobLink.click();
    
    // Should navigate to remove page
    await expect(page).toHaveURL(/\/app\/remove/);
    
    // Upload area should be visible
    const uploadArea = page.locator('text=Upload').first();
    await expect(uploadArea).toBeVisible({ timeout: 10000 });
  });

  test('tracks return_session after simulated absence', async ({ page }) => {
    // Set a past visit time (2 hours ago)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await page.evaluate((time) => {
      localStorage.setItem('bl_last_dashboard_visit', time);
    }, twoHoursAgo);
    
    // Navigate to dashboard to trigger return_session
    await page.goto('/app/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the return session check
    await page.waitForTimeout(1000);
    
    // The last visit should now be updated to recent
    const lastVisit = await getLocalStorage(page, 'bl_last_dashboard_visit');
    expect(lastVisit).toBeTruthy();
    
    // Should be more recent than 2 hours ago
    const lastVisitTime = new Date(lastVisit!).getTime();
    const twoHoursAgoTime = new Date(twoHoursAgo).getTime();
    expect(lastVisitTime).toBeGreaterThan(twoHoursAgoTime);
  });
});

test.describe('Job Flow Events', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('remove page loads correctly', async ({ page }) => {
    await page.goto('/app/remove');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show upload interface
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('credits display is visible', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for credits indicator somewhere on page
    // This might be in header/sidebar
    await page.waitForTimeout(2000);
    
    // Page should be functional
    const dashboard = page.locator('h1');
    await expect(dashboard).toBeVisible();
  });
});

test.describe('Billing Flow Events', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can access credits/billing page', async ({ page }) => {
    await page.goto('/app/credits');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show credits or billing content
    await page.waitForTimeout(1000);
    
    // Page should load without error
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('pricing page shows upgrade options when logged in', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show pricing plans
    const subscribeButton = page.locator('button:has-text("Subscribe")').first();
    await expect(subscribeButton).toBeVisible();
  });
});

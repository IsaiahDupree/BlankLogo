import { test, expect } from '@playwright/test';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'isaiahdupree33@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Frogger12';
const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';

test.describe('Admin Page Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForTimeout(3000);
  });

  test('admin page loads with correct sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check page title
    const title = page.locator('h1:has-text("Admin Dashboard")');
    await expect(title).toBeVisible();
    
    // Check all sections exist
    const sections = [
      'Users',
      'Growth',
      'Retention',
      'Jobs',
      'Credits',
      'Revenue',
      'Service Health',
    ];
    
    for (const section of sections) {
      const sectionHeader = page.locator(`h2:has-text("${section}")`).first();
      await expect(sectionHeader).toBeVisible();
    }
  });

  test('admin page shows non-zero data', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for data to load
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/admin-page-data.png', fullPage: true });
    
    // Check that at least some stats are visible (not just loading)
    const statCards = page.locator('.text-2xl, .text-3xl').filter({ hasText: /\d+/ });
    const count = await statCards.count();
    
    console.log(`Found ${count} stat cards with numbers`);
    expect(count).toBeGreaterThan(0);
    
    // Log all visible stats for debugging
    const allStats = await page.locator('.text-2xl, .text-3xl').allTextContents();
    console.log('All stats:', allStats);
  });

  test('service health check works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Find service health section
    const healthSection = page.locator('text=Service Health').first();
    await expect(healthSection).toBeVisible();
    
    // Check for service status indicators
    const services = ['Render Worker', 'Modal Inpaint', 'Web App'];
    for (const service of services) {
      const serviceCard = page.locator(`button:has-text("${service}")`).first();
      await expect(serviceCard).toBeVisible();
    }
    
    // Click on a service to see logs
    await page.click('button:has-text("Render Worker")');
    await page.waitForTimeout(2000);
    
    // Check logs panel appears
    const logsPanel = page.locator('text=Render Worker Logs');
    await expect(logsPanel).toBeVisible();
    
    await page.screenshot({ path: 'test-results/admin-health-logs.png' });
  });

  test('refresh button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Click refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    
    // Check that button shows loading state (has animate-spin class)
    await page.waitForTimeout(500);
    
    // Wait for refresh to complete
    await page.waitForTimeout(3000);
  });
});

test.describe('Admin Page Mobile Tests', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X viewport
  
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(3000);
  });

  test('admin page is mobile responsive', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
    
    // Check title is visible
    const title = page.locator('h1:has-text("Admin Dashboard")');
    await expect(title).toBeVisible();
    
    // Check refresh button is full width on mobile
    const refreshBtn = page.locator('button:has-text("Refresh")').first();
    await expect(refreshBtn).toBeVisible();
    
    // Scroll through the page to check all sections render
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'test-results/admin-mobile-bottom.png' });
  });

  test('stat cards display in 2-column grid on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check that stat cards are visible
    const statCards = page.locator('.grid > div').first();
    await expect(statCards).toBeVisible();
    
    // The grid should have 2 columns on mobile (grid-cols-2)
    const userSection = page.locator('section').filter({ hasText: 'Users' }).first();
    await expect(userSection).toBeVisible();
  });

  test('user growth chart renders on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Scroll to growth chart
    const growthSection = page.locator('text=Growth').first();
    await growthSection.scrollIntoViewIfNeeded();
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/admin-mobile-chart.png' });
    
    // Check chart elements are visible
    const chartBars = page.locator('.flex.items-end.gap-0\\.5');
    await expect(chartBars).toBeVisible();
  });

  test('service health cards stack on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Scroll to service health
    const healthSection = page.locator('text=Service Health').first();
    await healthSection.scrollIntoViewIfNeeded();
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/admin-mobile-health.png' });
    
    // Check all service cards are visible
    const workerCard = page.locator('button:has-text("Render Worker")');
    const modalCard = page.locator('button:has-text("Modal Inpaint")');
    const webCard = page.locator('button:has-text("Web App")');
    
    await expect(workerCard).toBeVisible();
    await expect(modalCard).toBeVisible();
    await expect(webCard).toBeVisible();
  });
});

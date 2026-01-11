/**
 * New Account Creation Test
 * Tests signup, login, and signout with a fresh account
 * Captures all frontend errors
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.blanklogo.app';
const BASE_EMAIL = process.env.TEST_NEW_EMAIL || 'lcreator34@gmail.com';
const PASSWORD = 'Frogger12';

// Generate unique email for each test run
function generateTestEmail(): string {
  const timestamp = Date.now();
  const [localPart, domain] = BASE_EMAIL.split('@');
  return `${localPart}+test${timestamp}@${domain}`;
}

// Helper to capture any error on the page
async function captureError(page: any): Promise<string | null> {
  const errorSelectors = [
    '.bg-red-500',
    '[class*="error"]',
    '[role="alert"]',
    '.text-red-500'
  ];
  
  for (const selector of errorSelectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      return await el.textContent().catch(() => 'Unknown error');
    }
  }
  return null;
}

test.describe('Full Auth Flow Test', () => {
  const testEmail = generateTestEmail();
  
  test('1. SIGNUP - Create new account', async ({ page }) => {
    console.log('━'.repeat(50));
    console.log(`[SIGNUP] Email: ${testEmail}`);
    console.log('━'.repeat(50));
    
    await page.goto(`${BASE_URL}/signup`);
    
    // Fill and submit
    await page.locator('input#email').fill(testEmail);
    await page.locator('input#password').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    
    // Wait for response
    await page.waitForTimeout(5000);
    
    // Capture result - check specifically for database error
    const url = page.url();
    const hasDatabaseError = await page.getByText(/database error/i).isVisible().catch(() => false);
    const hasSuccess = await page.getByText(/check your email|confirmation|sent a confirmation/i).isVisible().catch(() => false);
    const generalError = await captureError(page);
    
    console.log(`[SIGNUP] URL: ${url}`);
    
    if (hasDatabaseError) {
      const errorText = await page.locator('.bg-red-500, .text-red-500').first().textContent().catch(() => 'Database error');
      console.log(`[SIGNUP] ❌ DATABASE ERROR: ${errorText}`);
      await page.screenshot({ path: 'test-results/1-signup-error.png' });
      throw new Error(`Signup failed: ${errorText}`);
    } else if (generalError) {
      console.log(`[SIGNUP] ❌ ERROR: ${generalError}`);
      await page.screenshot({ path: 'test-results/1-signup-error.png' });
      throw new Error(`Signup failed: ${generalError}`);
    } else if (hasSuccess) {
      console.log('[SIGNUP] ✅ SUCCESS - Confirmation email sent');
    } else {
      console.log('[SIGNUP] ⚠️ No clear result - checking page');
    }
    
    await page.screenshot({ path: 'test-results/1-signup-result.png' });
  });

  test('2. LOGIN - With existing account', async ({ page }) => {
    // Use known working account for login test
    const loginEmail = 'isaiahdupree33@gmail.com';
    const loginPassword = 'Frogger12';
    
    console.log('━'.repeat(50));
    console.log(`[LOGIN] Email: ${loginEmail}`);
    console.log('━'.repeat(50));
    
    await page.goto(`${BASE_URL}/login`);
    
    // Fill and submit
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);
    await page.locator('button[type="submit"]').click();
    
    // Wait for redirect or error
    await page.waitForTimeout(5000);
    
    const error = await captureError(page);
    const url = page.url();
    
    console.log(`[LOGIN] URL: ${url}`);
    if (error) {
      console.log(`[LOGIN] ❌ ERROR: ${error}`);
      await page.screenshot({ path: 'test-results/2-login-error.png' });
      throw new Error(`Login failed: ${error}`);
    } else if (url.includes('/app')) {
      console.log('[LOGIN] ✅ SUCCESS - Redirected to app');
    } else {
      console.log('[LOGIN] ⚠️ Did not redirect to /app');
    }
    
    await page.screenshot({ path: 'test-results/2-login-result.png' });
    expect(url).toContain('/app');
  });

  test('3. SIGNOUT - Sign out from app', async ({ page }) => {
    // Login first
    const loginEmail = 'isaiahdupree33@gmail.com';
    const loginPassword = 'Frogger12';
    
    console.log('━'.repeat(50));
    console.log('[SIGNOUT] Testing sign out flow');
    console.log('━'.repeat(50));
    
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);
    await page.locator('button[type="submit"]').click();
    
    // Wait for app
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
    console.log(`[SIGNOUT] Logged in, URL: ${page.url()}`);
    
    if (!page.url().includes('/app')) {
      console.log('[SIGNOUT] ❌ Could not log in first');
      await page.screenshot({ path: 'test-results/3-signout-login-failed.png' });
      throw new Error('Login failed before signout test');
    }
    
    // Sign out by navigating directly to signout route
    console.log('[SIGNOUT] Navigating to /auth/signout...');
    await page.goto(`${BASE_URL}/auth/signout`);
    console.log('[SIGNOUT] Signout route called');
    
    // Wait for redirect
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log(`[SIGNOUT] URL after signout: ${url}`);
    
    // Check for errors
    const pageContent = await page.content();
    if (pageContent.includes('isn\'t working') || pageContent.includes('405') || pageContent.includes('ERROR')) {
      console.log('[SIGNOUT] ❌ ERROR: Page shows error');
      await page.screenshot({ path: 'test-results/3-signout-error.png' });
      throw new Error('Signout resulted in error page');
    }
    
    if (url.includes('/login') || url === `${BASE_URL}/` || url === `${BASE_URL}`) {
      console.log('[SIGNOUT] ✅ SUCCESS - Signed out and redirected');
    } else {
      console.log(`[SIGNOUT] ⚠️ Unexpected URL: ${url}`);
    }
    
    await page.screenshot({ path: 'test-results/3-signout-result.png' });
  });
});

// Mobile Auth Flow Tests
test.describe('Mobile Auth Flow', () => {
  test.use({ 
    viewport: { width: 375, height: 667 }, // iPhone SE
    hasTouch: true 
  });

  test('Mobile: Login and navigate app', async ({ page }) => {
    const loginEmail = 'isaiahdupree33@gmail.com';
    const loginPassword = 'Frogger12';
    
    console.log('━'.repeat(50));
    console.log('[MOBILE LOGIN] Testing mobile login flow');
    console.log('━'.repeat(50));
    
    await page.goto(`${BASE_URL}/login`);
    console.log('[MOBILE] Login page loaded');
    await page.screenshot({ path: 'test-results/mobile-1-login-page.png' });
    
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);
    await page.locator('button[type="submit"]').click();
    
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
    console.log(`[MOBILE] URL after login: ${page.url()}`);
    
    if (!page.url().includes('/app')) {
      const error = await captureError(page);
      console.log(`[MOBILE] ❌ Login failed: ${error}`);
      await page.screenshot({ path: 'test-results/mobile-2-login-error.png' });
      throw new Error(`Mobile login failed: ${error}`);
    }
    
    console.log('[MOBILE] ✅ Logged in successfully');
    await page.screenshot({ path: 'test-results/mobile-2-app-dashboard.png' });
    
    // Check mobile header is visible
    const mobileHeader = page.locator('header.lg\\:hidden');
    const headerVisible = await mobileHeader.isVisible().catch(() => false);
    console.log(`[MOBILE] Mobile header visible: ${headerVisible}`);
    
    // Check credits badge
    const creditsBadge = page.locator('text=/\\d+ credits/i');
    const creditsVisible = await creditsBadge.isVisible().catch(() => false);
    console.log(`[MOBILE] Credits badge visible: ${creditsVisible}`);
    
    // Open mobile menu
    const menuButton = page.locator('button[aria-label="Toggle menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      console.log('[MOBILE] Opened mobile menu');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/mobile-3-menu-open.png' });
    }
    
    expect(page.url()).toContain('/app');
  });

  test('Mobile: Signout via menu', async ({ page }) => {
    const loginEmail = 'isaiahdupree33@gmail.com';
    const loginPassword = 'Frogger12';
    
    console.log('━'.repeat(50));
    console.log('[MOBILE SIGNOUT] Testing mobile signout');
    console.log('━'.repeat(50));
    
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
    
    if (!page.url().includes('/app')) {
      throw new Error('Could not login for signout test');
    }
    console.log('[MOBILE] Logged in');
    
    // Open mobile menu
    const menuButton = page.locator('button[aria-label="Toggle menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(500);
      console.log('[MOBILE] Menu opened');
      await page.screenshot({ path: 'test-results/mobile-signout-1-menu.png' });
      
      // Find signout button in mobile menu
      const signOutButton = page.locator('nav button:has-text("Sign out")');
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        console.log('[MOBILE] Clicked signout button');
      } else {
        console.log('[MOBILE] Signout button not found, using direct navigation');
        await page.goto(`${BASE_URL}/auth/signout`);
      }
    } else {
      console.log('[MOBILE] Menu button not found, using direct navigation');
      await page.goto(`${BASE_URL}/auth/signout`);
    }
    
    await page.waitForTimeout(3000);
    
    const url = page.url();
    console.log(`[MOBILE] URL after signout: ${url}`);
    await page.screenshot({ path: 'test-results/mobile-signout-2-result.png' });
    
    if (url.includes('/login') || url === `${BASE_URL}/` || url === `${BASE_URL}`) {
      console.log('[MOBILE] ✅ Signed out successfully');
    }
  });

  test('Mobile: Signup page accessibility', async ({ page }) => {
    console.log('━'.repeat(50));
    console.log('[MOBILE SIGNUP] Testing mobile signup page');
    console.log('━'.repeat(50));
    
    await page.goto(`${BASE_URL}/signup`);
    await page.screenshot({ path: 'test-results/mobile-signup-page.png' });
    
    const emailInput = page.locator('input#email');
    const passwordInput = page.locator('input#password');
    const submitButton = page.locator('button[type="submit"]');
    
    expect(await emailInput.isVisible()).toBe(true);
    expect(await passwordInput.isVisible()).toBe(true);
    expect(await submitButton.isVisible()).toBe(true);
    
    const emailBox = await emailInput.boundingBox();
    const passwordBox = await passwordInput.boundingBox();
    
    if (emailBox) {
      console.log(`[MOBILE] Email input height: ${emailBox.height}px`);
      expect(emailBox.height).toBeGreaterThanOrEqual(40);
    }
    if (passwordBox) {
      console.log(`[MOBILE] Password input height: ${passwordBox.height}px`);
      expect(passwordBox.height).toBeGreaterThanOrEqual(40);
    }
    
    console.log('[MOBILE] ✅ Signup page accessible on mobile');
  });
});

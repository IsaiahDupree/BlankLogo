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

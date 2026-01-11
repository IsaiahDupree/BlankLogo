/**
 * New Account Creation Test
 * Tests signup and login with a fresh account
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'https://www.blanklogo.app';
const NEW_EMAIL = 'lcreator34@gmail.com';
const PASSWORD = 'Frogger12';

test.describe('New Account Flow', () => {
  test('1. Sign up with new email', async ({ page }) => {
    console.log(`[SIGNUP] Testing with email: ${NEW_EMAIL}`);
    
    await page.goto(`${BASE_URL}/signup`);
    console.log('[SIGNUP] Page loaded');
    
    // Fill form
    await page.locator('input#email').fill(NEW_EMAIL);
    await page.locator('input#password').fill(PASSWORD);
    console.log('[SIGNUP] Form filled');
    
    // Submit
    await page.locator('button[type="submit"]').click();
    console.log('[SIGNUP] Form submitted, waiting for response...');
    
    // Wait for result
    await page.waitForTimeout(5000);
    
    // Check what happened
    const url = page.url();
    console.log(`[SIGNUP] Current URL: ${url}`);
    
    // Look for success or error
    const hasSuccess = await page.getByText(/check your email|confirmation/i).isVisible().catch(() => false);
    const hasError = await page.locator('.bg-red-500').isVisible().catch(() => false);
    
    if (hasSuccess) {
      console.log('[SIGNUP] ✅ SUCCESS - Check email for confirmation link');
    } else if (hasError) {
      const errorText = await page.locator('.bg-red-500').textContent().catch(() => 'Unknown error');
      console.log(`[SIGNUP] ❌ Error: ${errorText}`);
      
      // If already registered, that's OK - we can proceed to login
      if (errorText?.includes('already') || errorText?.includes('registered')) {
        console.log('[SIGNUP] Account already exists - will test login instead');
      }
    } else {
      console.log('[SIGNUP] No clear success/error - checking page state');
    }
    
    await page.screenshot({ path: 'test-results/new-account-signup.png' });
  });

  test('2. Login with new account', async ({ page }) => {
    console.log(`[LOGIN] Testing login with: ${NEW_EMAIL}`);
    
    await page.goto(`${BASE_URL}/login`);
    console.log('[LOGIN] Page loaded');
    
    // Fill form
    await page.locator('input#email').fill(NEW_EMAIL);
    await page.locator('input#password').fill(PASSWORD);
    console.log('[LOGIN] Form filled');
    
    // Submit
    await page.locator('button[type="submit"]').click();
    console.log('[LOGIN] Form submitted, waiting...');
    
    // Wait for redirect or error
    await page.waitForTimeout(5000);
    
    const url = page.url();
    console.log(`[LOGIN] Current URL: ${url}`);
    
    if (url.includes('/app')) {
      console.log('[LOGIN] ✅ SUCCESS - Logged in and redirected to app!');
      
      // Check if we can see dashboard
      const hasDashboard = await page.getByText(/dashboard|remove watermark/i).isVisible().catch(() => false);
      console.log(`[LOGIN] Dashboard visible: ${hasDashboard}`);
    } else {
      const hasError = await page.locator('.bg-red-500').isVisible().catch(() => false);
      if (hasError) {
        const errorText = await page.locator('.bg-red-500').textContent();
        console.log(`[LOGIN] ❌ Error: ${errorText}`);
        
        if (errorText?.includes('confirm') || errorText?.includes('verify')) {
          console.log('[LOGIN] Need to confirm email first');
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/new-account-login.png' });
  });

  test('3. Access app after login', async ({ page }) => {
    console.log('[APP] Testing app access');
    
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input#email').fill(NEW_EMAIL);
    await page.locator('input#password').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    
    // Wait for redirect
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {
      console.log('[APP] Did not redirect to /app');
    });
    
    const url = page.url();
    console.log(`[APP] Current URL: ${url}`);
    
    if (url.includes('/app')) {
      console.log('[APP] ✅ In app!');
      
      // Check credits
      const creditsVisible = await page.getByText(/credits/i).isVisible().catch(() => false);
      console.log(`[APP] Credits visible: ${creditsVisible}`);
      
      // Try to navigate to remove page
      await page.goto(`${BASE_URL}/app/remove`);
      await page.waitForTimeout(2000);
      
      const removePageLoaded = await page.getByText(/remove watermark|upload/i).isVisible().catch(() => false);
      console.log(`[APP] Remove page loaded: ${removePageLoaded}`);
    }
    
    await page.screenshot({ path: 'test-results/new-account-app.png' });
  });
});

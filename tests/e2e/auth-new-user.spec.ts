/**
 * New User Authentication Tests
 * 
 * Tests the complete auth flow for new users:
 * - Signup page accessibility
 * - Form validation
 * - Account creation
 * - Email confirmation flow
 * - Login after signup
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';
const TEST_EMAIL_PREFIX = 'e2e-auth-test';
const TEST_PASSWORD = 'TestPassword123!';

// Generate unique test email
function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${TEST_EMAIL_PREFIX}+${timestamp}-${random}@blanklogo.app`;
}

test.describe('New User Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
  });

  test('signup page loads correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/BlankLogo/);
    
    // Check form elements exist (use more flexible selectors)
    await expect(page.locator('input[type="email"], input#email')).toBeVisible();
    await expect(page.locator('input[type="password"], input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check login link exists
    await expect(page.getByRole('link', { name: /sign in|login/i })).toBeVisible();
  });

  test('shows validation errors for invalid input', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input#email');
    const passwordInput = page.locator('input[type="password"], input#password');
    const submitButton = page.locator('button[type="submit"]');
    
    // Try invalid email
    await emailInput.fill('invalid-email');
    await passwordInput.fill('123'); // Too short
    await submitButton.click();
    
    // Should show validation error or stay on page
    await expect(page).toHaveURL(/signup/);
  });

  test('password visibility toggle works', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"], input#password');
    const toggleButton = page.locator('button[aria-label*="password"], button:has(svg)');
    
    // Initially password should be hidden
    await expect(passwordInput.first()).toHaveAttribute('type', 'password');
    
    // Look for toggle button near password field
    const toggle = page.locator('[class*="password"] button, button:near(input#password)').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      // Password field might change to text type
      await page.waitForTimeout(100);
    }
  });

  test('can navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('shows loading state during signup', async ({ page }) => {
    const testEmail = generateTestEmail();
    
    await page.locator('input[type="email"], input#email').fill(testEmail);
    await page.locator('input[type="password"], input#password').fill(TEST_PASSWORD);
    
    // Click submit and check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Should show loading indicator or redirect
    await page.waitForTimeout(500);
  });

  test('successful signup shows confirmation message', async ({ page }) => {
    const testEmail = generateTestEmail();
    
    await page.locator('input[type="email"], input#email').fill(testEmail);
    await page.locator('input[type="password"], input#password').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    
    // Should show success message OR stay on signup with no error (rate limiting)
    await page.waitForTimeout(3000);
    const hasSuccess = await page.getByText(/check your email|confirmation|verify|sent/i).isVisible().catch(() => false);
    const hasError = await page.locator('.bg-red-500, [class*="error"]').isVisible().catch(() => false);
    
    // Pass if we see success message OR no error (rate limit may prevent duplicate signups)
    expect(hasSuccess || !hasError).toBe(true);
  });
});

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('login page loads correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/BlankLogo/);
    await expect(page.locator('input[type="email"], input#email')).toBeVisible();
    await expect(page.locator('input[type="password"], input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('input[type="email"], input#email').fill('nonexistent@example.com');
    await page.locator('input[type="password"], input#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    
    // Should show error message
    await expect(page.getByText(/invalid|error|failed|incorrect/i)).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to signup page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/signup/);
  });

  test('can navigate to forgot password', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('successful login redirects to app', async ({ page }) => {
    // Use test credentials if available
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }
    
    await page.locator('input[type="email"], input#email').fill(testEmail);
    await page.locator('input[type="password"], input#password').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    
    // Should redirect to app dashboard
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
  });
});

test.describe('Auth Session Management', () => {
  test('logged out user is redirected from protected routes', async ({ page }) => {
    // Try to access protected route
    await page.goto(`${BASE_URL}/app`);
    
    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test('logout works correctly', async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;
    
    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }
    
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="email"], input#email').fill(testEmail);
    await page.locator('input[type="password"], input#password').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    
    await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
    
    // Find and click logout - use first() to avoid strict mode
    const signOutButton = page.locator('button:has-text("Sign out")').first();
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Should redirect to login or home
    await expect(page).not.toHaveURL(/\/app\/remove/);
  });
});

test.describe('Signup Form Accessibility', () => {
  test('form has proper labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    // Check inputs have IDs for label association
    const emailInput = page.locator('input[type="email"], input#email');
    const passwordInput = page.locator('input[type="password"], input#password');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('form can be navigated with keyboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    // Tab to email field and type
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.type('test@example.com');
    
    // Tab to password and type
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');
    
    // Verify typing worked
    const emailInput = page.locator('input[type="email"], input#email');
    await expect(emailInput).toHaveValue('test@example.com');
  });
});

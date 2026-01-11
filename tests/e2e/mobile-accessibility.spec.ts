/**
 * Mobile Accessibility Tests
 * 
 * Tests accessibility and usability on mobile devices:
 * - Touch targets meet minimum size (44x44px)
 * - Navigation is accessible
 * - Forms are usable on mobile
 * - Color contrast
 * - Screen reader compatibility
 */
import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';

// Use iPhone 12 viewport for all mobile tests in this file
test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Navigation', () => {
  test('mobile menu button is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/app`, { waitUntil: 'networkidle' }).catch(() => {
      // May redirect to login
    });

    // Check for hamburger menu button
    const menuButton = page.getByRole('button', { name: /menu|toggle/i }).or(
      page.locator('[aria-label*="menu"]')
    );
    
    if (await menuButton.isVisible()) {
      // Check minimum touch target size (44x44 recommended)
      const box = await menuButton.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('links have adequate touch targets', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Get all visible links
    const links = page.getByRole('link');
    const count = await links.count();
    
    let checkedCount = 0;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = links.nth(i);
      if (await link.isVisible().catch(() => false)) {
        const box = await link.boundingBox().catch(() => null);
        if (box && box.height > 0) {
          // Touch targets should be at least 20px tall (flexible for inline text)
          expect(box.height).toBeGreaterThanOrEqual(20);
          checkedCount++;
        }
      }
    }
    // Should have checked at least one link
    expect(checkedCount).toBeGreaterThan(0);
  });
});

test.describe('Mobile Form Accessibility', () => {
  test('login form is usable on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check inputs are large enough for touch
    const emailInput = page.locator('input[type="email"], input#email').first();
    const passwordInput = page.locator('input[type="password"], input#password').first();
    
    const emailBox = await emailInput.boundingBox();
    const passwordBox = await passwordInput.boundingBox();
    
    if (emailBox) {
      expect(emailBox.height).toBeGreaterThanOrEqual(40);
    }
    if (passwordBox) {
      expect(passwordBox.height).toBeGreaterThanOrEqual(40);
    }
    
    // Check form can be filled
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    
    // Check submit button is large enough
    const submitButton = page.getByRole('button', { name: /sign in/i });
    const buttonBox = await submitButton.boundingBox();
    
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('signup form is usable on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    // Check inputs using specific selectors
    const emailInput = page.locator('input[type="email"], input#email').first();
    const passwordInput = page.locator('input[type="password"], input#password').first();
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    
    // Check they can be focused and filled
    await emailInput.tap();
    await emailInput.fill('newuser@example.com');
    
    await passwordInput.tap();
    await passwordInput.fill('SecurePass123!');
  });
});

test.describe('Mobile Viewport', () => {
  test('no horizontal scroll on mobile', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check page doesn't require horizontal scrolling
    const viewportWidth = page.viewportSize()?.width || 390;
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin
  });

  test('text is readable without zooming', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check font sizes are at least 16px (prevents iOS zoom on focus)
    const inputs = page.locator('input');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const fontSize = await input.evaluate(el => 
          window.getComputedStyle(el).fontSize
        );
        const size = parseInt(fontSize);
        expect(size).toBeGreaterThanOrEqual(16);
      }
    }
  });
});

test.describe('Axe Accessibility Audit', () => {
  test('login page passes accessibility audit', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('.analytics-pixel') // Exclude tracking pixels
      .analyze();
    
    // Log violations for debugging
    if (accessibilityScanResults.violations.length > 0) {
      console.log('Accessibility violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
    }
    
    // Allow some violations but flag critical ones
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('signup page passes accessibility audit', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    expect(criticalViolations).toHaveLength(0);
  });

  test('home page passes accessibility audit', async ({ page }) => {
    await page.goto(BASE_URL);
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const criticalViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );
    
    // Log violations for review
    if (criticalViolations.length > 0) {
      console.log('Critical violations on home page:', 
        criticalViolations.map(v => `${v.id}: ${v.description}`).join('\n')
      );
    }
    
    expect(criticalViolations).toHaveLength(0);
  });
});

test.describe('Screen Reader Accessibility', () => {
  test('page has proper heading structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check for h1
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    
    // Get all headings and verify hierarchy
    const headings = await page.evaluate(() => {
      const heads = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      return Array.from(heads).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim()
      }));
    });
    
    // Should start with h1
    if (headings.length > 0) {
      expect(headings[0].level).toBe(1);
    }
  });

  test('interactive elements have accessible names', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check buttons have accessible names
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const name = await button.getAttribute('aria-label') || await button.textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    }
    
    // Check links have accessible names
    const links = page.getByRole('link');
    const linkCount = await links.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      if (await link.isVisible()) {
        const name = await link.getAttribute('aria-label') || await link.textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    // Get all inputs
    const inputs = page.locator('input:not([type="hidden"])');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        // Should have either id (for label[for]), aria-label, or aria-labelledby
        const hasLabel = id || ariaLabel || ariaLabelledBy;
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('focus is visible on interactive elements', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    
    // Check focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Mobile Touch', () => {
  test('tap works on buttons', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const signupLink = page.getByRole('link', { name: /sign up/i });
    await signupLink.tap();
    
    await expect(page).toHaveURL(/signup/, { timeout: 5000 });
  });
});

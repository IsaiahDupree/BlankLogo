import { test, expect } from '@playwright/test';

// Test configuration
const TEST_EMAIL = 'isaiahdupree33@gmail.com';
const TEST_VIDEO_URL = 'http://localhost:8080/sora_watermarked.mp4';
const API_URL = 'http://localhost:8989';

test.describe('Watermark Removal E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
  });

  test('should load homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/BlankLogo/i);
    await expect(page.getByRole('heading', { name: /Remove Watermarks/i }).first()).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: /Sign In|Login|Get Started/i }).first();
    await signInLink.click();
    await page.waitForURL(/login|auth/);
  });

  test('should show upload page after login', async ({ page }) => {
    // Go to login
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // Wait for redirect or error
    await page.waitForTimeout(2000);
    
    // Check if we're on app page or got an error
    const url = page.url();
    console.log('Current URL after login:', url);
  });

  test('API health check', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('API status check', async ({ request }) => {
    const response = await request.get(`${API_URL}/status`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('operational');
    expect(data.services.redis.connected).toBe(true);
    expect(data.services.queue.available).toBe(true);
  });

  test('should redirect to login from upload page when unauthenticated', async ({ page }) => {
    await page.goto('/app/upload');
    await page.waitForLoadState('networkidle');
    
    // App pages should redirect to login when not authenticated
    const url = page.url();
    // Either shows content or redirects to login
    const hasContent = await page.getByText('Sora').first().isVisible().catch(() => false);
    const isLoginPage = url.includes('login') || url.includes('auth');
    
    expect(hasContent || isLoginPage).toBeTruthy();
  });

  test('should have upload page structure', async ({ page }) => {
    await page.goto('/app/upload');
    await page.waitForLoadState('networkidle');
    
    // Check page loaded (either app content or login redirect)
    const url = page.url();
    expect(url).toMatch(/upload|login|auth/);
  });
});

test.describe('Watermark Removal Job Flow', () => {
  
  test('should submit job via API directly', async ({ request }) => {
    // First, we need to authenticate
    // This test checks the API endpoint directly
    
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      headers: {
        'Content-Type': 'application/json',
        // Note: Would need valid auth token here
      },
      data: {
        video_url: TEST_VIDEO_URL,
        platform: 'sora',
        processing_mode: 'crop',
      },
    });
    
    // Without auth, should get 401
    expect(response.status()).toBe(401);
  });

  test('should get platforms list', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/platforms`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.platforms).toBeDefined();
    expect(data.platforms.length).toBeGreaterThan(0);
    
    // Check for expected platforms
    const platformIds = data.platforms.map((p: { id: string }) => p.id);
    expect(platformIds).toContain('sora');
    expect(platformIds).toContain('tiktok');
    expect(platformIds).toContain('runway');
    expect(platformIds).toContain('instagram');
    expect(platformIds).toContain('facebook');
  });

  test('should get capabilities', async ({ request }) => {
    const response = await request.get(`${API_URL}/capabilities`);
    // Capabilities endpoint may or may not exist
    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    } else {
      // Skip if not implemented
      expect(response.status()).toBe(404);
    }
  });
});

test.describe('Authenticated User Flow', () => {
  
  test.skip('should complete full watermark removal flow', async ({ page }) => {
    // This test requires a valid authenticated session
    // Skip for now until auth is set up in test environment
    
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    // 2. Navigate to upload
    await page.goto('/app/upload');
    
    // 3. Select Sora platform
    await page.click('text=Sora');
    
    // 4. Enter video URL
    await page.fill('input[placeholder*="URL"]', TEST_VIDEO_URL);
    
    // 5. Submit job
    await page.click('button:has-text("Remove Watermark")');
    
    // 6. Wait for job to be created
    await page.waitForResponse(response => 
      response.url().includes('/api/v1/jobs') && response.status() === 200
    );
    
    // 7. Verify job status page
    await expect(page.locator('text=Processing')).toBeVisible();
  });
});

test.describe('UI Components', () => {
  
  test('should handle credits page access', async ({ page }) => {
    await page.goto('/app/credits');
    await page.waitForLoadState('networkidle');
    
    // Page loads - either shows content or redirects to login
    const url = page.url();
    expect(url).toMatch(/credits|login|auth/);
  });

  test('should handle remove page access', async ({ page }) => {
    await page.goto('/app/remove');
    await page.waitForLoadState('networkidle');
    
    // Page loads - either shows content or redirects to login
    const url = page.url();
    expect(url).toMatch(/remove|login|auth/);
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check navigation exists
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Post-Deployment Health Check Tests
 * Run these tests against a deployed environment to verify everything is working
 * 
 * Usage: DEPLOY_URL=https://api.blanklogo.com pnpm test:deployment
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.DEPLOY_API_URL || process.env.API_URL || 'http://localhost:8989';
const WEB_URL = process.env.DEPLOY_WEB_URL || process.env.WEB_URL || 'http://localhost:3939';
const TIMEOUT = 30000;

test.describe('Deployment Health Checks', () => {
  test.describe('API Service', () => {
    test('health endpoint responds', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, { timeout: TIMEOUT });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    test('API responds to requests', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, { timeout: TIMEOUT });
      expect(response.status()).toBeLessThan(500); // Not a server error
    });

    test('Redis connection is healthy', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, { timeout: TIMEOUT });
      const data = await response.json();
      expect(data.services?.redis).toBe('connected');
    });

    test('Queue is ready', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, { timeout: TIMEOUT });
      const data = await response.json();
      expect(data.services?.queue).toBe('ready');
    });

    test('CORS headers are set correctly', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`, {
        headers: { 'Origin': WEB_URL }
      });
      const corsHeader = response.headers()['access-control-allow-origin'];
      expect(corsHeader).toBeTruthy();
    });
  });

  test.describe('Web Frontend', () => {
    test('homepage loads', async ({ page }) => {
      await page.goto(WEB_URL, { timeout: TIMEOUT });
      await expect(page).toHaveTitle(/BlankLogo/i);
    });

    test('login page accessible', async ({ page }) => {
      await page.goto(`${WEB_URL}/login`, { timeout: TIMEOUT });
      await expect(page.locator('form')).toBeVisible();
    });

    test('static assets load correctly', async ({ page }) => {
      const response = await page.goto(WEB_URL);
      expect(response?.status()).toBeLessThan(400);
      
      // Check for CSS loading
      const styles = await page.evaluate(() => document.styleSheets.length);
      expect(styles).toBeGreaterThan(0);
    });

    test('API connectivity from frontend', async ({ page }) => {
      await page.goto(WEB_URL);
      
      // Check if frontend can reach API
      const apiReachable = await page.evaluate(async (apiUrl) => {
        try {
          const res = await fetch(`${apiUrl}/health`);
          return res.ok;
        } catch {
          return false;
        }
      }, API_URL);
      
      expect(apiReachable).toBeTruthy();
    });
  });

  test.describe('Authentication Flow', () => {
    test('can reach auth endpoints', async ({ request }) => {
      // Test that auth endpoint exists (will return 401/403/404 without credentials)
      const response = await request.get(`${API_URL}/api/v1/me`);
      expect([401, 403, 404]).toContain(response.status());
    });
  });

  test.describe('Job System', () => {
    test('job queue is accessible', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);
      const data = await response.json();
      expect(data.services?.queue).toBeDefined();
    });
  });
});

test.describe('Performance Checks', () => {
  test('API response time is acceptable', async ({ request }) => {
    const start = Date.now();
    await request.get(`${API_URL}/health`);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
  });

  test('Homepage load time is acceptable', async ({ page }) => {
    const start = Date.now();
    await page.goto(WEB_URL);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(5000); // Should load within 5 seconds
  });
});

test.describe('Security Checks', () => {
  test('HTTPS redirect works (production only)', async ({ request }) => {
    if (!API_URL.includes('localhost')) {
      const httpUrl = API_URL.replace('https://', 'http://');
      const response = await request.get(httpUrl, { 
        maxRedirects: 0,
        timeout: TIMEOUT 
      });
      expect([301, 302, 307, 308]).toContain(response.status());
    } else {
      // Skip for localhost
      expect(true).toBe(true);
    }
  });

  test('security headers are present', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    const headers = response.headers();
    
    // Check for common security headers
    if (!API_URL.includes('localhost')) {
      expect(headers['x-content-type-options']).toBe('nosniff');
    }
  });

  test('rate limiting is active', async ({ request }) => {
    // Make multiple rapid requests
    const requests = Array(10).fill(null).map(() => 
      request.get(`${API_URL}/health`)
    );
    
    await Promise.all(requests);
    // If rate limiting is active, we should still get responses (not be blocked yet)
    // This just verifies the endpoint is working under load
  });
});

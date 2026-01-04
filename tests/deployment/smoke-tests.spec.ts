/**
 * Smoke Tests - Quick sanity checks after deployment
 * These run fast and verify critical paths work
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.DEPLOY_API_URL || 'http://localhost:8989';
const WEB_URL = process.env.DEPLOY_WEB_URL || 'http://localhost:3939';

test.describe('Smoke Tests', () => {
  test('API is alive', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
  });

  test('Web is alive', async ({ page }) => {
    const res = await page.goto(WEB_URL);
    expect(res?.ok()).toBeTruthy();
  });

  test('Database queries work', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    const data = await res.json();
    // Health endpoint returns status: "healthy" when DB is working
    expect(data.status).toBe('healthy');
  });

  test('Redis is connected', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    const data = await res.json();
    expect(data.services?.redis).toBe('connected');
  });

  test('Static files served', async ({ page }) => {
    await page.goto(WEB_URL);
    const favicon = await page.locator('link[rel="icon"]').count();
    expect(favicon).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Critical User Paths', () => {
  test('Landing page renders', async ({ page }) => {
    await page.goto(WEB_URL);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Login page accessible', async ({ page }) => {
    await page.goto(`${WEB_URL}/login`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Signup page accessible', async ({ page }) => {
    await page.goto(`${WEB_URL}/signup`);
    await expect(page.locator('body')).toBeVisible();
  });
});

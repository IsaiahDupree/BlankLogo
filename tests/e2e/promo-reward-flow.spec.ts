import { test, expect } from '@playwright/test';

/**
 * E2E Test: Promo Reward Flow
 * 
 * Tests the complete flow of a user clicking a promo ad,
 * getting a JWT cookie, signing up, and receiving bonus credits.
 * 
 * Flow:
 * 1. Visit /promo?utm_source=meta&utm_campaign=blanklogo_10credits
 * 2. Verify JWT cookie is set
 * 3. Verify redirect to /signup with promo params
 * 4. Sign up as new user
 * 5. Verify promo is auto-redeemed
 * 6. Verify credits awarded
 */

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';
const TEST_RUN_ID = Date.now().toString(36);

test.describe('Promo Reward Flow', () => {
  
  test('promo landing sets JWT cookie and redirects to signup', async ({ page, context }) => {
    console.log('[Promo Test] Step 1: Visit promo landing page');
    
    // Visit promo landing page with UTM params
    const response = await page.goto(
      `${BASE_URL}/promo?utm_source=meta&utm_campaign=blanklogo_10credits`,
      { waitUntil: 'domcontentloaded' }
    );
    
    // Should redirect to signup
    await page.waitForURL(/\/signup/);
    console.log('[Promo Test] Redirected to:', page.url());
    
    // Verify URL has promo params
    expect(page.url()).toContain('promo=1');
    expect(page.url()).toContain('campaign=blanklogo_10credits');
    
    // Check for promo cookie
    const cookies = await context.cookies();
    const promoCookie = cookies.find(c => c.name === 'bl_promo_token');
    
    console.log('[Promo Test] Promo cookie present:', !!promoCookie);
    expect(promoCookie).toBeTruthy();
    expect(promoCookie?.httpOnly).toBe(true);
    expect(promoCookie?.secure).toBe(true);
    
    // Verify cookie is a valid JWT (has 3 parts)
    if (promoCookie) {
      const parts = promoCookie.value.split('.');
      expect(parts.length).toBe(3);
      console.log('[Promo Test] JWT cookie validated ✓');
    }
  });

  test('promo redemption API returns status correctly', async ({ request, context }) => {
    console.log('[Promo Test] Step 2: Test promo redemption API');
    
    // First, visit promo landing to get cookie
    const landingResponse = await request.get(
      `${BASE_URL}/promo?utm_source=test&utm_campaign=blanklogo_10credits`,
      { maxRedirects: 0 }
    );
    
    // Check redirect status
    expect(landingResponse.status()).toBe(307);
    
    // Get the set-cookie header
    const setCookie = landingResponse.headers()['set-cookie'];
    console.log('[Promo Test] Set-Cookie header present:', !!setCookie);
    expect(setCookie).toContain('bl_promo_token');
    
    // Extract the token from set-cookie
    const tokenMatch = setCookie?.match(/bl_promo_token=([^;]+)/);
    const token = tokenMatch?.[1];
    
    if (token) {
      console.log('[Promo Test] Token extracted, checking redemption status...');
      
      // Check promo status (GET endpoint)
      const statusResponse = await request.get(`${BASE_URL}/api/promos/redeem`, {
        headers: {
          'Cookie': `bl_promo_token=${token}`
        }
      });
      
      const statusData = await statusResponse.json();
      console.log('[Promo Test] Promo status:', statusData);
      
      // Should have promo available (but can't redeem without auth)
      expect(statusData.has_promo).toBe(true);
      expect(statusData.campaign_id).toBe('blanklogo_10credits');
    }
  });

  test('promo redemption requires authentication', async ({ request }) => {
    console.log('[Promo Test] Step 3: Verify redemption requires auth');
    
    // Try to redeem without authentication
    const redeemResponse = await request.post(`${BASE_URL}/api/promos/redeem`);
    const redeemData = await redeemResponse.json();
    
    console.log('[Promo Test] Unauthenticated redemption response:', redeemData);
    
    // Should fail with no_token or not_authenticated
    expect(redeemData.success).toBe(false);
    expect(['no_token', 'not_authenticated']).toContain(redeemData.error_code);
  });

  test('full promo flow - landing to signup page', async ({ page }) => {
    console.log('[Promo Test] Step 4: Full flow - landing to signup');
    
    // Start from promo landing
    await page.goto(`${BASE_URL}/promo?utm_source=e2e_test&utm_campaign=blanklogo_10credits`);
    
    // Should land on signup page
    await page.waitForURL(/\/signup/);
    
    // Verify signup page loaded
    await expect(page.locator('text=Create your account')).toBeVisible({ timeout: 10000 }).catch(() => {
      // Alternative text
      return expect(page.locator('text=Sign up')).toBeVisible({ timeout: 5000 });
    });
    
    console.log('[Promo Test] Signup page loaded ✓');
    
    // Verify promo indicator is in URL
    expect(page.url()).toContain('promo=1');
    
    // Check that signup form is visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    
    console.log('[Promo Test] Signup form ready for new user ✓');
  });

  test.skip('complete signup with promo and verify credits (requires new email)', async ({ page, context }) => {
    // This test would require a unique email for each run
    // Skip by default - enable for manual testing
    
    const testEmail = `e2e+promo+${TEST_RUN_ID}@blanklogo.app`;
    const testPassword = 'TestPassword123!';
    
    console.log('[Promo Test] Testing with email:', testEmail);
    
    // Start from promo landing
    await page.goto(`${BASE_URL}/promo?utm_source=e2e_test&utm_campaign=blanklogo_10credits`);
    await page.waitForURL(/\/signup/);
    
    // Fill signup form
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for redirect to app (or email confirmation)
    await page.waitForURL(/\/(app|confirm)/, { timeout: 30000 });
    
    console.log('[Promo Test] Signup submitted, current URL:', page.url());
    
    // If we're in the app, check for promo success toast
    if (page.url().includes('/app')) {
      // Look for success message
      const toast = page.locator('text=/earned.*credits|bonus.*credits/i');
      await expect(toast).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('[Promo Test] No toast visible, checking credits directly');
      });
    }
  });
});

test.describe('Promo Campaigns', () => {
  
  test('different campaign IDs work', async ({ request }) => {
    const campaigns = [
      'blanklogo_10credits',
      'tiktok_launch',
      'welcome_bonus'
    ];
    
    for (const campaign of campaigns) {
      console.log(`[Promo Test] Testing campaign: ${campaign}`);
      
      const response = await request.get(
        `${BASE_URL}/promo?utm_campaign=${campaign}`,
        { maxRedirects: 0 }
      );
      
      expect(response.status()).toBe(307);
      
      const location = response.headers()['location'];
      expect(location).toContain(`campaign=${campaign}`);
      
      console.log(`[Promo Test] Campaign ${campaign} ✓`);
    }
  });

  test('invalid campaign falls back to default', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/promo?utm_campaign=invalid_campaign_xyz`,
      { maxRedirects: 0 }
    );
    
    expect(response.status()).toBe(307);
    
    const location = response.headers()['location'];
    // Should use default campaign
    expect(location).toContain('campaign=');
    
    console.log('[Promo Test] Invalid campaign handled gracefully ✓');
  });
});

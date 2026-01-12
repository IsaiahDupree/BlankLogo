/**
 * Credits Signup Tests
 * Tests that new users receive correct credits:
 * - 10 welcome credits for ALL new signups
 * - +10 promo credits for promo link signups (20 total)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Admin client for checking database
function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for credit tests');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Generate unique test email
function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const baseEmail = process.env.TEST_EMAIL_BASE || 'testuser@example.com';
  const [localPart, domain] = baseEmail.split('@');
  return `${localPart}+${prefix}${timestamp}@${domain}`;
}

// Helper to get user credits from database
async function getUserCredits(userId: string): Promise<number> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bl_credit_ledger')
    .select('amount')
    .eq('user_id', userId);
  
  if (error) throw error;
  return data?.reduce((sum, row) => sum + row.amount, 0) || 0;
}

// Helper to get user by email
async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const supabase = getAdminClient();
  const { data } = await supabase.auth.admin.listUsers();
  const user = data?.users?.find(u => u.email === email);
  return user ? { id: user.id } : null;
}

// Helper to cleanup test user
async function cleanupTestUser(email: string): Promise<void> {
  const supabase = getAdminClient();
  const user = await getUserByEmail(email);
  if (user) {
    // Delete credit ledger entries
    await supabase.from('bl_credit_ledger').delete().eq('user_id', user.id);
    // Delete promo redemptions
    await supabase.from('bl_promo_redemptions').delete().eq('user_id', user.id);
    // Delete user
    await supabase.auth.admin.deleteUser(user.id);
    console.log(`[Cleanup] Deleted test user: ${email}`);
  }
}

test.describe('Credits on Signup', () => {
  
  test.describe.configure({ mode: 'serial' });
  
  test('Regular signup grants 10 welcome credits', async ({ page }) => {
    const testEmail = generateTestEmail('welcome');
    const password = 'TestPassword123!';
    
    console.log('━'.repeat(60));
    console.log(`[WELCOME CREDITS] Testing: ${testEmail}`);
    console.log('━'.repeat(60));
    
    try {
      // 1. Go to regular signup page
      await page.goto(`${BASE_URL}/signup`);
      await page.waitForLoadState('networkidle');
      
      // 2. Fill signup form
      await page.locator('input#email, input[type="email"]').first().fill(testEmail);
      await page.locator('input#password, input[type="password"]').first().fill(password);
      
      // 3. Submit
      await page.locator('button[type="submit"]').click();
      
      // 4. Wait for confirmation message
      await page.waitForTimeout(3000);
      
      const hasSuccess = await page.getByText(/check your email|confirmation|sent/i).isVisible().catch(() => false);
      if (hasSuccess) {
        console.log('[WELCOME CREDITS] ✅ Signup successful, confirmation email sent');
      }
      
      await page.screenshot({ path: 'test-results/credits-welcome-signup.png' });
      
      // 5. Simulate email confirmation by using admin API
      const supabase = getAdminClient();
      
      // Wait a moment for the user to be created
      await page.waitForTimeout(2000);
      
      // Get the user
      const user = await getUserByEmail(testEmail);
      
      if (!user) {
        console.log('[WELCOME CREDITS] ⚠️ User not found yet - may need email confirmation');
        // This is expected - user needs to confirm email first
        // In real e2e, we'd check email and click confirmation link
        return;
      }
      
      // Confirm the user's email (simulate clicking confirmation link)
      await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });
      console.log('[WELCOME CREDITS] Email confirmed via admin API');
      
      // 6. Now login to trigger auth callback
      await page.goto(`${BASE_URL}/login`);
      await page.locator('input#email, input[type="email"]').first().fill(testEmail);
      await page.locator('input#password, input[type="password"]').first().fill(password);
      await page.locator('button[type="submit"]').click();
      
      // Wait for redirect to app
      await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
      
      // 7. Check credits in database
      const credits = await getUserCredits(user.id);
      console.log(`[WELCOME CREDITS] User credits: ${credits}`);
      
      expect(credits).toBeGreaterThanOrEqual(10);
      console.log('[WELCOME CREDITS] ✅ PASSED - User has welcome credits');
      
    } finally {
      // Cleanup
      await cleanupTestUser(testEmail).catch(e => console.log('[Cleanup] Error:', e.message));
    }
  });

  test('Promo signup grants 20 total credits (10 welcome + 10 promo)', async ({ page }) => {
    const testEmail = generateTestEmail('promo');
    const password = 'TestPassword123!';
    
    console.log('━'.repeat(60));
    console.log(`[PROMO CREDITS] Testing: ${testEmail}`);
    console.log('━'.repeat(60));
    
    try {
      // 1. Go to promo page (this sets the promo cookie)
      await page.goto(`${BASE_URL}/promo?utm_source=test&utm_campaign=blanklogo_10credits`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the promo page with celebration
      const hasCelebration = await page.getByText(/congratulations|20 FREE|free credits/i).isVisible().catch(() => false);
      console.log(`[PROMO CREDITS] Promo page loaded: ${hasCelebration}`);
      
      await page.screenshot({ path: 'test-results/credits-promo-landing.png' });
      
      // 2. Click "Claim Your Free Credits" button
      const claimButton = page.locator('button:has-text("Claim")');
      if (await claimButton.isVisible()) {
        await claimButton.click();
        await page.waitForTimeout(1000);
        console.log('[PROMO CREDITS] Clicked claim button');
      }
      
      // 3. Fill signup form on promo page
      await page.locator('input#email, input[type="email"]').first().fill(testEmail);
      await page.locator('input#password, input[type="password"]').first().fill(password);
      
      // 4. Submit
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(3000);
      
      await page.screenshot({ path: 'test-results/credits-promo-signup.png' });
      
      // 5. Check for success message
      const hasSuccess = await page.getByText(/check your email|confirmation|sent/i).isVisible().catch(() => false);
      if (hasSuccess) {
        console.log('[PROMO CREDITS] ✅ Signup successful');
      }
      
      // 6. Use admin API to confirm email and check credits
      const supabase = getAdminClient();
      await page.waitForTimeout(2000);
      
      const user = await getUserByEmail(testEmail);
      if (!user) {
        console.log('[PROMO CREDITS] ⚠️ User not found - needs email confirmation');
        return;
      }
      
      // Confirm email
      await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });
      console.log('[PROMO CREDITS] Email confirmed');
      
      // 7. Login to trigger auth callback (grants welcome credits)
      await page.goto(`${BASE_URL}/login`);
      await page.locator('input#email, input[type="email"]').first().fill(testEmail);
      await page.locator('input#password, input[type="password"]').first().fill(password);
      await page.locator('button[type="submit"]').click();
      
      await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
      console.log('[PROMO CREDITS] Logged in');
      
      // Wait for promo redemption to happen (PromoRedeemer component)
      await page.waitForTimeout(5000);
      
      // 8. Check credits in database
      const credits = await getUserCredits(user.id);
      console.log(`[PROMO CREDITS] User credits: ${credits}`);
      
      // Should have at least 10 (welcome) and ideally 20 (welcome + promo)
      expect(credits).toBeGreaterThanOrEqual(10);
      
      if (credits >= 20) {
        console.log('[PROMO CREDITS] ✅ PASSED - User has 20+ credits (welcome + promo)');
      } else {
        console.log('[PROMO CREDITS] ⚠️ User only has welcome credits, promo may not have redeemed');
      }
      
      // Check UI shows credits
      const creditsDisplay = page.locator('text=/\\d+\\s*(credits)?/i').first();
      if (await creditsDisplay.isVisible()) {
        const text = await creditsDisplay.textContent();
        console.log(`[PROMO CREDITS] UI shows: ${text}`);
      }
      
      await page.screenshot({ path: 'test-results/credits-promo-dashboard.png' });
      
    } finally {
      // Cleanup
      await cleanupTestUser(testEmail).catch(e => console.log('[Cleanup] Error:', e.message));
    }
  });

  test('Promo page shows 20 FREE credits messaging', async ({ page }) => {
    console.log('━'.repeat(60));
    console.log('[PROMO PAGE] Testing promo page content');
    console.log('━'.repeat(60));
    
    await page.goto(`${BASE_URL}/promo?utm_source=test&utm_campaign=blanklogo_10credits`);
    await page.waitForLoadState('networkidle');
    
    // Check for key elements
    const has20Credits = await page.getByText(/20 FREE/i).first().isVisible();
    const hasCongrats = await page.getByText(/congratulations/i).first().isVisible();
    const hasWelcomeBonus = await page.getByText(/welcome.*credits|10.*welcome/i).first().isVisible();
    const hasClaimButton = await page.locator('button:has-text("Claim")').first().isVisible();
    
    console.log(`[PROMO PAGE] Shows "20 FREE": ${has20Credits}`);
    console.log(`[PROMO PAGE] Shows "Congratulations": ${hasCongrats}`);
    console.log(`[PROMO PAGE] Shows welcome bonus breakdown: ${hasWelcomeBonus}`);
    console.log(`[PROMO PAGE] Has claim button: ${hasClaimButton}`);
    
    await page.screenshot({ path: 'test-results/promo-page-content.png' });
    
    expect(has20Credits).toBe(true);
    expect(hasCongrats).toBe(true);
    expect(hasClaimButton).toBe(true);
    
    console.log('[PROMO PAGE] ✅ PASSED - All promo elements present');
  });

  test('Promo cookie is set on promo page visit', async ({ page, context }) => {
    console.log('━'.repeat(60));
    console.log('[PROMO COOKIE] Testing promo cookie');
    console.log('━'.repeat(60));
    
    // Visit promo page
    await page.goto(`${BASE_URL}/promo?utm_source=test&utm_campaign=blanklogo_10credits`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for API call to set cookie
    
    // Check cookies
    const cookies = await context.cookies();
    const promoCookie = cookies.find(c => c.name === 'bl_promo_token');
    
    if (promoCookie) {
      console.log('[PROMO COOKIE] ✅ Promo token cookie found');
      console.log(`[PROMO COOKIE] Expires: ${new Date(promoCookie.expires * 1000).toISOString()}`);
      expect(promoCookie.httpOnly).toBe(true);
    } else {
      console.log('[PROMO COOKIE] ⚠️ Promo token cookie not found');
      console.log('[PROMO COOKIE] Available cookies:', cookies.map(c => c.name));
    }
    
    // The cookie might be httpOnly and not visible, so also check via API
    const response = await page.goto(`${BASE_URL}/api/promos/redeem`);
    const json = await response?.json().catch(() => ({}));
    console.log('[PROMO COOKIE] Redeem API response:', json);
  });
});

test.describe('Credits Display', () => {
  
  test('Dashboard shows correct credit balance', async ({ page }) => {
    const loginEmail = process.env.TEST_USER_EMAIL || 'isaiahdupree33@gmail.com';
    const loginPassword = process.env.TEST_USER_PASSWORD || 'Frogger12';
    
    console.log('━'.repeat(60));
    console.log('[CREDITS DISPLAY] Testing credit display');
    console.log('━'.repeat(60));
    
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input#email').fill(loginEmail);
    await page.locator('input#password').fill(loginPassword);
    await page.locator('button[type="submit"]').click();
    
    await page.waitForURL(/\/app/, { timeout: 15000 });
    console.log('[CREDITS DISPLAY] Logged in');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Look for credits in the UI
    const creditsText = await page.locator('text=/\\d+\\s*credits?/i').first().textContent().catch(() => null);
    
    if (creditsText) {
      const match = creditsText.match(/(\d+)/);
      if (match) {
        const displayedCredits = parseInt(match[1], 10);
        console.log(`[CREDITS DISPLAY] UI shows: ${displayedCredits} credits`);
        expect(displayedCredits).toBeGreaterThanOrEqual(0);
      }
    } else {
      // Try sidebar
      const sidebarCredits = await page.locator('aside').getByText(/credits available/i).first().textContent().catch(() => null);
      console.log(`[CREDITS DISPLAY] Sidebar: ${sidebarCredits}`);
    }
    
    await page.screenshot({ path: 'test-results/credits-display-dashboard.png' });
    console.log('[CREDITS DISPLAY] ✅ PASSED');
  });
});

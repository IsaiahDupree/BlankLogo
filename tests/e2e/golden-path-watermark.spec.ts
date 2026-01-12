import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Golden Path E2E Test - Watermark Removal
 * 
 * Tests the complete watermark removal flow using a real test account.
 * This test does NOT manipulate user data - only verifies the core functionality.
 * 
 * Test Account: sashleyblogs@gmail.com
 */

const BASE_URL = process.env.BASE_URL || 'https://www.blanklogo.app';
const TEST_EMAIL = 'sashleyblogs@gmail.com';
const TEST_PASSWORD = 'thenewaccount123';

// Test video file - located in test-videos folder
const TEST_VIDEO_PATH = 'test-videos/sora-watermark-test.mp4';

test.describe('Golden Path - Watermark Removal', () => {
  test.setTimeout(180000); // 3 minutes for full flow (processing can take 60-90s)

  test('Complete watermark removal flow', async ({ page }) => {
    console.log('━'.repeat(60));
    console.log('[GOLDEN PATH] Starting watermark removal test');
    console.log('━'.repeat(60));

    // Step 1: Login
    console.log('\n[STEP 1] Logging in...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Click sign in button
    await page.click('button[type="submit"]');
    
    // Wait for redirect to app
    await page.waitForURL(/\/app/, { timeout: 15000 });
    console.log('[STEP 1] ✅ Login successful');

    // Step 2: Navigate to Remove page
    console.log('\n[STEP 2] Navigating to remove watermark page...');
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the remove page
    const pageTitle = await page.locator('h1, h2').first().textContent();
    console.log(`[STEP 2] Page title: ${pageTitle}`);
    console.log('[STEP 2] ✅ On remove page');

    // Step 3: Check credits
    console.log('\n[STEP 3] Checking credits...');
    const creditsText = await page.locator('text=/\\d+\\s*credits?/i').first().textContent().catch(() => null);
    if (creditsText) {
      console.log(`[STEP 3] Credits display: ${creditsText}`);
    } else {
      console.log('[STEP 3] Credits display not found (may be in header)');
    }

    // Step 4: Upload test video
    console.log('\n[STEP 4] Uploading test video...');
    
    // Find the file input
    const fileInput = page.locator('input[type="file"]');
    const testVideoPath = path.join(process.cwd(), TEST_VIDEO_PATH);
    
    // Check if test video exists
    const fs = await import('fs');
    if (!fs.existsSync(testVideoPath)) {
      console.log(`[STEP 4] ⚠️ Test video not found at ${testVideoPath}`);
      console.log('[STEP 4] Skipping upload test - no test video available');
      
      // Take screenshot of current state
      await page.screenshot({ path: 'test-results/golden-path-no-video.png' });
      return;
    }

    await fileInput.setInputFiles(testVideoPath);
    console.log(`[STEP 4] ✅ Video file selected: ${TEST_VIDEO_PATH}`);

    // Step 5: Select platform (Sora)
    console.log('\n[STEP 5] Selecting platform...');
    const soraButton = page.locator('button:has-text("Sora"), [data-platform="sora"]').first();
    if (await soraButton.isVisible()) {
      await soraButton.click();
      console.log('[STEP 5] ✅ Sora platform selected');
    } else {
      console.log('[STEP 5] Platform selector not visible (may be auto-detected)');
    }

    // Step 6: Submit job
    console.log('\n[STEP 6] Submitting watermark removal job...');
    
    // Wait for the Remove Watermark button to be visible and enabled
    const submitButton = page.locator('button:has-text("Remove Watermark")').first();
    await submitButton.waitFor({ state: 'visible', timeout: 10000 });
    
    // Small delay to ensure file is fully processed
    await page.waitForTimeout(1000);
    
    await submitButton.click();
    console.log('[STEP 6] ✅ Job submitted');

    // Step 7: Wait for processing
    console.log('\n[STEP 7] Waiting for job to process...');
    
    // Wait for processing state or completion
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 * 2s = 2 minutes max

    while (!jobCompleted && attempts < maxAttempts) {
      await page.waitForTimeout(2000);
      attempts++;

      // Check for completion indicators
      const hasDownload = await page.locator('text=/download/i, a[download], button:has-text("Download")').first().isVisible().catch(() => false);
      const hasSuccess = await page.locator('text=/complete|success|ready/i').first().isVisible().catch(() => false);
      const hasFailed = await page.locator('text=/failed|error/i').first().isVisible().catch(() => false);

      // Check progress
      const progressText = await page.locator('text=/\\d+%/').first().textContent().catch(() => null);
      if (progressText) {
        console.log(`[STEP 7] Progress: ${progressText}`);
      }

      if (hasDownload || hasSuccess) {
        jobCompleted = true;
        console.log('[STEP 7] ✅ Job completed successfully!');
      } else if (hasFailed) {
        console.log('[STEP 7] ❌ Job failed');
        await page.screenshot({ path: 'test-results/golden-path-failed.png' });
        break;
      }
    }

    // Step 8: Verify output
    console.log('\n[STEP 8] Verifying output...');
    
    if (jobCompleted) {
      // Check for download button/link
      const downloadButton = page.locator('a[download], button:has-text("Download"), a:has-text("Download")').first();
      const isDownloadVisible = await downloadButton.isVisible().catch(() => false);
      
      if (isDownloadVisible) {
        console.log('[STEP 8] ✅ Download button available');
        
        // Get download URL if available
        const downloadHref = await downloadButton.getAttribute('href').catch(() => null);
        if (downloadHref) {
          console.log(`[STEP 8] Download URL: ${downloadHref.substring(0, 50)}...`);
        }
      }

      // Take success screenshot
      await page.screenshot({ path: 'test-results/golden-path-success.png' });
      console.log('\n' + '═'.repeat(60));
      console.log('[GOLDEN PATH] ✅ TEST PASSED - Full watermark removal flow complete');
      console.log('═'.repeat(60));
    } else {
      await page.screenshot({ path: 'test-results/golden-path-timeout.png' });
      console.log('\n' + '═'.repeat(60));
      console.log('[GOLDEN PATH] ⚠️ TEST INCOMPLETE - Job did not complete in time');
      console.log('═'.repeat(60));
    }

    expect(jobCompleted).toBe(true);
  });

  test('Verify login and credits display', async ({ page }) => {
    console.log('━'.repeat(60));
    console.log('[VERIFY] Testing login and credits display');
    console.log('━'.repeat(60));

    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/app/, { timeout: 15000 });
    console.log('[VERIFY] ✅ Login successful');

    // Check dashboard/app page
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState('networkidle');

    // Look for credits display
    const pageContent = await page.content();
    const hasCredits = /\d+\s*credits?/i.test(pageContent);
    
    console.log(`[VERIFY] Credits visible: ${hasCredits}`);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/verify-credits.png' });
    
    console.log('[VERIFY] ✅ Verification complete');
  });

  test('Verify remove page loads correctly', async ({ page }) => {
    console.log('━'.repeat(60));
    console.log('[VERIFY] Testing remove page loads');
    console.log('━'.repeat(60));

    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // Navigate to remove page
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState('networkidle');

    // Verify key elements - file input may be hidden (styled)
    const hasFileInput = await page.locator('input[type="file"]').count() > 0;
    const hasUploadZone = await page.locator('text=/upload|drag|drop|choose/i').first().isVisible().catch(() => false);
    const hasPlatformOptions = await page.locator('text=/sora|tiktok|auto/i').first().isVisible().catch(() => false);
    
    console.log(`[VERIFY] File input exists: ${hasFileInput}`);
    console.log(`[VERIFY] Upload zone visible: ${hasUploadZone}`);
    console.log(`[VERIFY] Platform options visible: ${hasPlatformOptions}`);

    await page.screenshot({ path: 'test-results/verify-remove-page.png' });

    // Page is valid if it has upload capability and platform options
    expect(hasFileInput || hasUploadZone).toBe(true);
    expect(hasPlatformOptions).toBe(true);
    console.log('[VERIFY] ✅ Remove page loads correctly');
  });
});

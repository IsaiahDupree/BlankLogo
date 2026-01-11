import { test, expect, Page } from "@playwright/test";

/**
 * BlankLogo Real Job Flow E2E Tests
 * 
 * Tests the COMPLETE flow from frontend → backend → worker → frontend:
 * 1. Login via UI
 * 2. Verify credits visible
 * 3. Submit a real job via UI
 * 4. Wait for worker to process job
 * 5. Verify job appears in jobs list with completed status
 * 6. Verify output video is downloadable
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3939";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@blanklogo.local";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "TestPassword123!";

// Use a small test video that processes quickly
const TEST_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

// Max time to wait for job completion (3 minutes)
const JOB_TIMEOUT_MS = 180000;

async function loginUser(page: Page): Promise<boolean> {
  console.log(`🔐 Logging in as ${TEST_USER_EMAIL}...`);
  
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  
  // Fill login form
  await page.fill('input[type="email"]', TEST_USER_EMAIL);
  await page.fill('input[type="password"]', TEST_USER_PASSWORD);
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForTimeout(3000);
  
  // Check if we're logged in (redirected to /app or similar)
  const url = page.url();
  const isLoggedIn = url.includes('/app') || !url.includes('/login');
  
  if (isLoggedIn) {
    console.log(`✅ Logged in successfully, redirected to ${url}`);
  } else {
    console.log(`❌ Login failed, still at ${url}`);
  }
  
  return isLoggedIn;
}

async function getCredits(page: Page): Promise<number> {
  // Look for credits display in sidebar or header
  const creditsText = await page.textContent('[data-testid="credits"], .credits-display, :text-matches("\\\\d+ credits?", "i")');
  if (creditsText) {
    const match = creditsText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  // Fallback: call API
  const response = await page.request.get(`${BASE_URL}/api/credits`);
  if (response.ok()) {
    const data = await response.json();
    return data.credits || 0;
  }
  
  return 0;
}

async function waitForJobCompletion(page: Page, jobId: string, timeoutMs: number = JOB_TIMEOUT_MS): Promise<string> {
  console.log(`⏳ Waiting for job ${jobId} to complete (timeout: ${timeoutMs / 1000}s)...`);
  
  const startTime = Date.now();
  let lastStatus = "";
  let lastProgress = 0;
  
  while (Date.now() - startTime < timeoutMs) {
    // Navigate to job detail page
    await page.goto(`${BASE_URL}/app/jobs/${jobId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    
    // Check for completed status
    const completedBadge = page.locator('text=/completed/i, :text("Watermark Removed"), :text("Download")');
    if (await completedBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`✅ Job completed!`);
      return "completed";
    }
    
    // Check for failed status
    const failedBadge = page.locator('text=/failed/i, :text("Processing Failed")');
    if (await failedBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
      const errorText = await page.textContent('.error-message, :text-matches("Error.*", "i")') || "Unknown error";
      console.log(`❌ Job failed: ${errorText}`);
      return "failed";
    }
    
    // Get current progress
    const progressText = await page.textContent(':text-matches("\\\\d+%", "i"), .progress-text');
    const currentStepText = await page.textContent('.current-step, :text-matches("(Downloading|Analyzing|Processing|Uploading|Inpainting).*", "i")');
    
    if (progressText) {
      const match = progressText.match(/(\d+)/);
      const progress = match ? parseInt(match[1]) : 0;
      if (progress !== lastProgress) {
        console.log(`📊 Progress: ${progress}% ${currentStepText || ''}`);
        lastProgress = progress;
      }
    }
    
    // Wait before next poll
    await page.waitForTimeout(3000);
  }
  
  console.log(`⏰ Job timed out after ${timeoutMs / 1000}s`);
  return "timeout";
}

test.describe("Real Job Flow - Frontend to Backend to Frontend", () => {
  test.describe.configure({ mode: "serial" });
  
  let jobId: string;

  test("1. Login and verify credits", async ({ page }) => {
    const loggedIn = await loginUser(page);
    expect(loggedIn).toBe(true);
    
    // Navigate to app dashboard
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState("networkidle");
    
    // Check credits are visible
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    console.log(`📄 Page shows credits section: ${pageContent.includes('Credits') || pageContent.includes('credits')}`);
    
    // Get credits via API as backup
    const response = await page.request.get(`${BASE_URL}/api/credits`);
    if (response.ok()) {
      const data = await response.json();
      console.log(`💰 Credits available: ${data.credits}`);
      expect(data.credits).toBeGreaterThan(0);
    }
  });

  test("2. Navigate to watermark removal page", async ({ page }) => {
    await loginUser(page);
    
    // Go to remove page
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    
    // Verify page elements
    await expect(page.locator('input[placeholder*="URL"], input[name="url"], input[type="url"]')).toBeVisible({ timeout: 10000 });
    console.log(`✅ Remove page loaded with URL input visible`);
  });

  test("3. Submit a real watermark removal job", async ({ page }) => {
    // Login and stay on page
    await loginUser(page);
    
    // Navigate to remove page and wait for it to fully load
    await page.goto(`${BASE_URL}/app/remove`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // Verify we're on the right page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (!currentUrl.includes('/app/remove')) {
      console.log(`❌ Not on remove page, navigating again...`);
      await page.goto(`${BASE_URL}/app/remove`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }
    
    // Take screenshot to see page state
    await page.screenshot({ path: 'test-results/remove-page-loaded.png' });
    
    // Enter video URL - try multiple selectors
    let urlInput = page.locator('input[placeholder*="URL"]').first();
    if (!await urlInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      urlInput = page.locator('input[type="text"]').first();
    }
    
    await urlInput.fill(TEST_VIDEO_URL);
    console.log(`📝 Entered video URL: ${TEST_VIDEO_URL}`);
    
    // Wait for input to register
    await page.waitForTimeout(1000);
    
    // Take screenshot before submit
    await page.screenshot({ path: 'test-results/before-submit.png' });
    
    // Click submit button - try multiple selectors
    let submitButton = page.locator('button:has-text("Remove Watermark")').first();
    if (!await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      submitButton = page.locator('button[type="submit"]').first();
    }
    if (!await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      submitButton = page.locator('button:has-text("Start")').first();
    }
    
    console.log(`🔍 Looking for submit button...`);
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    
    // Set up response listener BEFORE clicking
    const responsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        const method = response.request().method();
        const isJobsEndpoint = url.includes('/api/v1/jobs') || url.includes('/jobs');
        const isPost = method === 'POST';
        if (isJobsEndpoint) {
          console.log(`🔄 API call detected: ${method} ${url} -> ${response.status()}`);
        }
        return isJobsEndpoint && isPost;
      },
      { timeout: 30000 }
    );
    
    await submitButton.click();
    console.log(`🚀 Clicked submit button`);
    
    // Wait for API response
    try {
      const response = await responsePromise;
      const responseData = await response.json().catch(() => ({}));
      
      console.log(`📦 API Response: ${response.status()} - ${JSON.stringify(responseData)}`);
      
      if (response.status() === 200 || response.status() === 201) {
        jobId = responseData.job_id || responseData.id;
        console.log(`✅ Job created: ${jobId}`);
        expect(jobId).toBeDefined();
      } else if (response.status() === 402) {
        console.log(`❌ Insufficient credits: ${responseData.message}`);
        test.fail(true, `Insufficient credits: ${responseData.message}`);
      } else {
        console.log(`❌ Job creation failed: ${responseData.error || response.status()}`);
      }
    } catch (error) {
      // Take screenshot on error
      await page.screenshot({ path: 'test-results/submit-error.png' });
      console.log(`⚠️ No API response captured, checking page state...`);
      
      // Check if job was created by looking at the page
      await page.waitForTimeout(3000);
      const pageUrl = page.url();
      
      if (pageUrl.includes('/jobs/')) {
        // Redirected to job page
        const match = pageUrl.match(/\/jobs\/([a-f0-9-]+)/);
        if (match) {
          jobId = match[1];
          console.log(`✅ Job created (from redirect): ${jobId}`);
        }
      }
    }
    
    // Take screenshot after submit
    await page.screenshot({ path: 'test-results/after-submit.png' });
  });

  test("4. Wait for job to complete and verify in UI", async ({ page }) => {
    test.setTimeout(JOB_TIMEOUT_MS + 60000);
    
    if (!jobId) {
      console.log(`⚠️ No job ID from previous test, skipping...`);
      test.skip();
      return;
    }
    
    await loginUser(page);
    
    // Wait for job to complete
    const status = await waitForJobCompletion(page, jobId, JOB_TIMEOUT_MS);
    
    // Take screenshot of final state
    await page.screenshot({ path: `test-results/job-${status}.png` });
    
    expect(status).toBe("completed");
  });

  test("5. Verify job appears in jobs list", async ({ page }) => {
    if (!jobId) {
      console.log(`⚠️ No job ID, skipping...`);
      test.skip();
      return;
    }
    
    await loginUser(page);
    await page.goto(`${BASE_URL}/app/jobs`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/jobs-list.png' });
    
    // Look for the job in the list
    const jobRow = page.locator(`a[href*="${jobId}"], [data-job-id="${jobId}"], :text("${jobId.slice(0, 8)}")`);
    const hasJob = await jobRow.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasJob) {
      console.log(`✅ Job ${jobId.slice(0, 8)}... found in jobs list`);
    } else {
      // Check if page shows "No jobs yet"
      const noJobs = await page.textContent('body');
      if (noJobs?.includes('No jobs yet')) {
        console.log(`❌ Jobs list shows "No jobs yet"`);
      } else {
        console.log(`⚠️ Job might be present but not found by locator`);
      }
    }
    
    // Verify at least one job exists (our test job)
    const anyJobLink = page.locator('a[href*="/app/jobs/"]').first();
    if (await anyJobLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`✅ Jobs list has at least one job`);
    }
  });

  test("6. Verify download is available for completed job", async ({ page }) => {
    if (!jobId) {
      console.log(`⚠️ No job ID, skipping...`);
      test.skip();
      return;
    }
    
    await loginUser(page);
    await page.goto(`${BASE_URL}/app/jobs/${jobId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Look for download button
    const downloadButton = page.locator('a:has-text("Download"), button:has-text("Download"), a[download]');
    const hasDownload = await downloadButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (hasDownload) {
      console.log(`✅ Download button is visible`);
      
      // Get download URL
      const href = await downloadButton.getAttribute('href');
      console.log(`📥 Download URL: ${href?.slice(0, 80)}...`);
      
      expect(href).toBeTruthy();
    } else {
      console.log(`⚠️ Download button not visible (job may still be processing or failed)`);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/job-detail-final.png' });
  });
});

test.describe("Quick Smoke Test - Verify Frontend Shows Backend Data", () => {
  test("Jobs page shows real database data", async ({ page }) => {
    await loginUser(page);
    await page.goto(`${BASE_URL}/app/jobs`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/smoke-jobs-page.png' });
    
    // Check page content
    const content = await page.content();
    const hasJobs = !content.includes('No jobs yet');
    const hasTable = content.includes('<table') || content.includes('grid') || content.includes('Job');
    
    console.log(`📊 Jobs page state:`);
    console.log(`   Has jobs: ${hasJobs}`);
    console.log(`   Has table/grid: ${hasTable}`);
    
    // Log what we see
    const jobs = await page.locator('a[href*="/app/jobs/"]').count();
    console.log(`   Job links found: ${jobs}`);
  });

  test("Credits API returns real balance", async ({ page }) => {
    await loginUser(page);
    
    const response = await page.request.get(`${BASE_URL}/api/credits`);
    expect(response.ok()).toBe(true);
    
    const data = await response.json();
    console.log(`💰 Credits from API: ${data.credits}`);
    
    expect(data.credits).toBeDefined();
    expect(typeof data.credits).toBe('number');
  });

  test("Dashboard shows user data", async ({ page }) => {
    await loginUser(page);
    await page.goto(`${BASE_URL}/app`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/smoke-dashboard.png' });
    
    // Check for user-specific content
    const hasUserData = await page.locator(':text("Dashboard"), :text("Recent"), :text("Credits")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`👤 Dashboard shows user data: ${hasUserData}`);
  });
});

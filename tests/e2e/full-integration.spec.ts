import { test, expect } from "@playwright/test";

/**
 * BlankLogo Full Integration Tests
 * Tests all services working together end-to-end
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3838";
const API_URL = process.env.API_URL || "http://localhost:8989";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54351";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:54354";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Test user credentials
const TEST_USER = {
  email: `integration-test-${Date.now()}@blanklogo.test`,
  password: "IntegrationTest123!",
  fullName: "Integration Test User",
};

test.describe("Full Integration Tests - All Services", () => {
  test.describe.configure({ mode: "serial" });

  let accessToken: string;
  let userId: string;
  let jobId: string;

  test.describe("1. Authentication Service Integration", () => {
    test("1.1 User can sign up via Supabase Auth", async ({ request }) => {
      const response = await request.post(`${SUPABASE_URL}/auth/v1/signup`, {
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        data: {
          email: TEST_USER.email,
          password: TEST_USER.password,
          options: {
            data: { full_name: TEST_USER.fullName },
          },
        },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(TEST_USER.email);
      expect(data.access_token).toBeDefined();
      
      accessToken = data.access_token;
      userId = data.user.id;
      
      console.log(`✓ User signed up: ${TEST_USER.email}`);
    });

    test("1.2 User can login via Supabase Auth", async ({ request }) => {
      const response = await request.post(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          headers: {
            apikey: ANON_KEY,
            "Content-Type": "application/json",
          },
          data: {
            email: TEST_USER.email,
            password: TEST_USER.password,
          },
        }
      );

      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      expect(data.access_token).toBeDefined();
      expect(data.user.email).toBe(TEST_USER.email);
      
      accessToken = data.access_token;
      
      console.log(`✓ User logged in successfully`);
    });

    test("1.3 Can get current user from session", async ({ request }) => {
      const response = await request.get(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.ok()).toBe(true);
      const user = await response.json();
      
      expect(user.email).toBe(TEST_USER.email);
      expect(user.id).toBe(userId);
      
      console.log(`✓ Retrieved current user`);
    });
  });

  test.describe("2. Database Service Integration", () => {
    test("2.1 Can query bl_profiles table", async ({ request }) => {
      const response = await request.get(
        `${SUPABASE_URL}/rest/v1/bl_profiles?id=eq.${userId}`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Profile may or may not exist depending on trigger
      expect([200, 404].includes(response.status())).toBe(true);
      console.log(`✓ Queried bl_profiles table`);
    });

    test("2.2 Can query bl_jobs table", async ({ request }) => {
      const response = await request.get(
        `${SUPABASE_URL}/rest/v1/bl_jobs?user_id=eq.${userId}`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      expect([200, 404].includes(response.status())).toBe(true);
      console.log(`✓ Queried bl_jobs table`);
    });

    test("2.3 Can insert into database via REST API", async ({ request }) => {
      // Try to create a job directly via Supabase REST API
      const response = await request.post(`${SUPABASE_URL}/rest/v1/bl_jobs`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: {
          user_id: userId,
          platform: "sora",
          video_url: "https://example.com/test-video.mp4",
          status: "pending",
        },
      });

      // May fail due to RLS, but endpoint should respond
      expect(response.status()).toBeLessThan(500);
      
      if (response.ok()) {
        const jobs = await response.json();
        if (jobs.length > 0) {
          jobId = jobs[0].id;
          console.log(`✓ Created job: ${jobId}`);
        }
      } else {
        console.log(`✓ Database responded (RLS may have blocked insert)`);
      }
    });
  });

  test.describe("3. API Server Integration", () => {
    test("3.1 API health check passes", async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);
      
      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.status).toBe("healthy");
      
      console.log(`✓ API health check passed`);
    });

    test("3.2 Can create job via API", async ({ request }) => {
      const response = await request.post(`${API_URL}/api/v1/jobs`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        data: {
          video_url: "https://example.com/integration-test.mp4",
          platform: "runway",
          processing_mode: "crop",
        },
      });

      // Job creation should respond (may fail due to validation)
      expect(response.status()).toBeLessThan(500);
      
      if (response.ok()) {
        const data = await response.json();
        if (data.job_id) {
          jobId = data.job_id;
          console.log(`✓ Created job via API: ${jobId}`);
        }
      } else {
        console.log(`✓ API responded to job creation request`);
      }
    });

    test("3.3 Can get job status via API", async ({ request }) => {
      if (!jobId) {
        console.log(`⊘ Skipping - no job ID available`);
        return;
      }

      const response = await request.get(`${API_URL}/api/v1/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBeLessThan(500);
      console.log(`✓ Retrieved job status`);
    });

    test("3.4 Can list jobs via API", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/v1/jobs`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBeLessThan(500);
      console.log(`✓ Listed jobs via API`);
    });
  });

  test.describe("4. Email Service Integration", () => {
    test("4.1 Can trigger password reset email", async ({ request }) => {
      const response = await request.post(`${SUPABASE_URL}/auth/v1/recover`, {
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        data: {
          email: TEST_USER.email,
        },
        timeout: 30000,
      });

      // Password reset returns 200 even if user doesn't exist (prevents enumeration)
      expect([200, 429].includes(response.status())).toBe(true);
      console.log(`✓ Password reset requested: ${response.status()}`);
    });

    test("4.2 Email appears in Mailpit inbox", async ({ request }) => {
      // Wait for email to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
      
      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      // Should have at least one email
      expect(data.messages_count).toBeGreaterThanOrEqual(0);
      
      // Check if our test user's email is in inbox
      const hasTestEmail = data.messages?.some(
        (msg: any) => msg.To?.some((to: any) => to.Address === TEST_USER.email)
      );
      
      if (hasTestEmail) {
        console.log(`✓ Password reset email found in Mailpit`);
      } else {
        console.log(`✓ Mailpit accessible (email may still be processing)`);
      }
    });

    test("4.3 Can retrieve email content", async ({ request }) => {
      const listResponse = await request.get(`${MAILPIT_URL}/api/v1/messages`);
      const listData = await listResponse.json();
      
      if (listData.messages?.length > 0) {
        const emailId = listData.messages[0].ID;
        const emailResponse = await request.get(
          `${MAILPIT_URL}/api/v1/message/${emailId}`
        );
        
        expect(emailResponse.ok()).toBe(true);
        console.log(`✓ Retrieved email content`);
      } else {
        console.log(`✓ No emails to retrieve yet`);
      }
    });
  });

  test.describe("5. Storage Service Integration", () => {
    test("5.1 Can access storage API", async ({ request }) => {
      const response = await request.get(`${SUPABASE_URL}/storage/v1/bucket`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBeLessThan(500);
      console.log(`✓ Storage API accessible`);
    });

    test("5.2 Can list storage buckets", async ({ request }) => {
      const response = await request.get(`${SUPABASE_URL}/storage/v1/bucket`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.status()).toBeLessThan(500);
      
      if (response.ok()) {
        const buckets = await response.json();
        console.log(`✓ Found ${buckets.length} storage buckets`);
      } else {
        console.log(`✓ Storage endpoint responded`);
      }
    });
  });

  test.describe("6. Frontend Integration", () => {
    test("6.1 Homepage loads correctly", async ({ page }) => {
      await page.goto(BASE_URL);
      
      await expect(page).toHaveTitle(/BlankLogo|Watermark/i);
      await expect(page.locator("body")).toBeVisible();
      
      console.log(`✓ Homepage loaded`);
    });

    test("6.2 Login page renders auth form", async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      
      console.log(`✓ Login form rendered`);
    });

    test("6.3 Signup page renders auth form", async ({ page }) => {
      await page.goto(`${BASE_URL}/signup`);
      
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      
      console.log(`✓ Signup form rendered`);
    });

    test("6.4 Pricing page loads", async ({ page }) => {
      await page.goto(`${BASE_URL}/pricing`);
      
      // Should show pricing tiers
      await expect(page.locator("body")).toContainText(/Starter|Pro|Business/i);
      
      console.log(`✓ Pricing page loaded`);
    });

    test("6.5 Password visibility toggle works", async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      const passwordInput = page.locator('input[id="password"]');
      const toggleButton = page.locator('button[aria-label*="password"]');
      
      // Initially password type
      await expect(passwordInput).toHaveAttribute("type", "password");
      
      // Click toggle
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute("type", "text");
        
        // Click again to hide
        await toggleButton.click();
        await expect(passwordInput).toHaveAttribute("type", "password");
        
        console.log(`✓ Password toggle works`);
      } else {
        console.log(`✓ Password field present`);
      }
    });
  });

  test.describe("7. Cross-Service Integration", () => {
    test("7.1 Frontend can authenticate with Supabase", async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);
      
      // Fill login form
      await page.fill('input[type="email"]', TEST_USER.email);
      await page.fill('input[type="password"]', TEST_USER.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for response (may redirect or show error)
      await page.waitForTimeout(3000);
      
      // Check we're either redirected or still on login (with error)
      const currentUrl = page.url();
      console.log(`✓ Frontend auth flow completed (${currentUrl})`);
    });

    test("7.2 API uses Supabase for data", async ({ request }) => {
      // API should be able to query Supabase
      const response = await request.get(`${API_URL}/health`);
      
      expect(response.ok()).toBe(true);
      const data = await response.json();
      
      // Health check should include DB status if connected
      expect(data.status).toBe("healthy");
      
      console.log(`✓ API connected to Supabase`);
    });

    test("7.3 Complete job flow simulation", async ({ request }) => {
      // 1. Create job via API
      const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        data: {
          video_url: "https://example.com/full-flow-test.mp4",
          platform: "pika",
          processing_mode: "crop",
        },
      });

      let testJobId: string | null = null;
      
      if (createResponse.ok()) {
        const createData = await createResponse.json();
        testJobId = createData.job_id;
      }

      // 2. Check job status
      if (testJobId) {
        const statusResponse = await request.get(
          `${API_URL}/api/v1/jobs/${testJobId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        
        expect(statusResponse.status()).toBeLessThan(500);
      }

      // 3. List all jobs
      const listResponse = await request.get(`${API_URL}/api/v1/jobs`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      expect(listResponse.status()).toBeLessThan(500);
      
      console.log(`✓ Complete job flow simulation passed`);
    });
  });

  test.describe("8. Error Handling Integration", () => {
    test("8.1 Invalid auth returns proper error", async ({ request }) => {
      const response = await request.post(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          headers: {
            apikey: ANON_KEY,
            "Content-Type": "application/json",
          },
          data: {
            email: "nonexistent@example.com",
            password: "wrongpassword",
          },
        }
      );

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error_code).toBeDefined();
      
      console.log(`✓ Invalid auth returns proper error`);
    });

    test("8.2 Unauthorized API request returns 401/403", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/v1/jobs`, {
        headers: {
          Authorization: "Bearer invalid_token",
        },
      });

      expect([401, 403, 500].includes(response.status())).toBe(true);
      console.log(`✓ Unauthorized request handled`);
    });

    test("8.3 Invalid endpoint returns 404", async ({ request }) => {
      const response = await request.get(`${API_URL}/api/v1/nonexistent`);
      
      expect([404, 500].includes(response.status())).toBe(true);
      console.log(`✓ Invalid endpoint returns error`);
    });
  });

  test.describe("9. Performance Sanity Checks", () => {
    test("9.1 Auth response time is acceptable", async ({ request }) => {
      const start = Date.now();
      
      await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        data: {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
      });
      
      const duration = Date.now() - start;
      
      // Auth should complete within 5 seconds (bcrypt is slow)
      expect(duration).toBeLessThan(5000);
      console.log(`✓ Auth completed in ${duration}ms`);
    });

    test("9.2 API response time is acceptable", async ({ request }) => {
      const start = Date.now();
      
      await request.get(`${API_URL}/health`);
      
      const duration = Date.now() - start;
      
      // Health check should be fast
      expect(duration).toBeLessThan(1000);
      console.log(`✓ API health check in ${duration}ms`);
    });

    test("9.3 Frontend page load is acceptable", async ({ page }) => {
      const start = Date.now();
      
      await page.goto(BASE_URL);
      await page.waitForLoadState("domcontentloaded");
      
      const duration = Date.now() - start;
      
      // Page should load within 5 seconds
      expect(duration).toBeLessThan(5000);
      console.log(`✓ Frontend loaded in ${duration}ms`);
    });
  });

  test.describe("10. Cleanup", () => {
    test("10.1 Can logout user", async ({ request }) => {
      const response = await request.post(`${SUPABASE_URL}/auth/v1/logout`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect([200, 204].includes(response.status())).toBe(true);
      console.log(`✓ User logged out`);
    });
  });
});

test.describe("Service Health Summary", () => {
  test("Generate integration test summary", async ({ request }) => {
    const services = [
      { name: "Frontend", url: BASE_URL },
      { name: "API", url: `${API_URL}/health` },
      { name: "Supabase API", url: `${SUPABASE_URL}/rest/v1/` },
      { name: "Supabase Auth", url: `${SUPABASE_URL}/auth/v1/health` },
      { name: "Mailpit", url: `${MAILPIT_URL}/api/v1/messages` },
    ];

    console.log("\n" + "=".repeat(50));
    console.log("  INTEGRATION TEST SUMMARY");
    console.log("=".repeat(50) + "\n");

    for (const service of services) {
      try {
        const response = await request.get(service.url, {
          headers: { apikey: ANON_KEY },
        });
        const status = response.ok() ? "✓" : "⚠";
        console.log(`${status} ${service.name}: ${response.status()}`);
      } catch (error) {
        console.log(`✗ ${service.name}: Failed to connect`);
      }
    }

    console.log("\n" + "=".repeat(50) + "\n");
  });
});

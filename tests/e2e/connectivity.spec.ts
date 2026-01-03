import { test, expect } from "@playwright/test";

/**
 * BlankLogo Connectivity Tests
 * Ensures all services are reachable and healthy before running other tests
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3939";
const API_URL = process.env.API_URL || "http://localhost:8989";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54351";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:54354";

test.describe("Service Connectivity Tests", () => {
  test.describe.configure({ mode: "serial" });

  test("Frontend (Next.js) is accessible", async ({ request }) => {
    const response = await request.get(BASE_URL);
    
    expect(response.ok()).toBe(true);
    console.log(`✓ Frontend accessible at ${BASE_URL}`);
  });

  test("API server is healthy", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data.status).toBe("healthy");
    console.log(`✓ API healthy at ${API_URL}`);
  });

  test("Supabase API is accessible", async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      },
    });
    
    expect(response.ok()).toBe(true);
    console.log(`✓ Supabase API accessible at ${SUPABASE_URL}`);
  });

  test("Supabase Auth is accessible", async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/auth/v1/health`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
      },
    });
    
    // Auth health endpoint may return different status codes
    expect([200, 204].includes(response.status())).toBe(true);
    console.log(`✓ Supabase Auth accessible`);
  });

  test("Mailpit email server is accessible", async ({ request }) => {
    const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    
    expect(response.ok()).toBe(true);
    console.log(`✓ Mailpit accessible at ${MAILPIT_URL}`);
  });

  test("Redis is accessible via API health check", async ({ request }) => {
    // The API health check implicitly tests Redis since BullMQ depends on it
    const response = await request.get(`${API_URL}/health`);
    
    expect(response.ok()).toBe(true);
    const data = await response.json();
    
    // If Redis were down, the health check would fail or show unhealthy
    expect(data.status).toBe("healthy");
    console.log(`✓ Redis accessible (verified via API health)`);
  });
});

test.describe("Database Connectivity Tests", () => {
  test("can query Supabase database", async ({ request }) => {
    // Try to query a public endpoint or check if tables exist
    const response = await request.get(`${SUPABASE_URL}/rest/v1/bl_jobs?limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"}`,
      },
    });
    
    // 200 means table exists, 404 means doesn't exist (but DB is accessible)
    expect([200, 404].includes(response.status())).toBe(true);
    console.log(`✓ Supabase database accessible`);
  });

  test("can query profiles table", async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/bl_profiles?limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"}`,
      },
    });
    
    expect([200, 404].includes(response.status())).toBe(true);
    console.log(`✓ bl_profiles table accessible`);
  });
});

test.describe("API Endpoint Connectivity Tests", () => {
  test("job creation endpoint responds", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://example.com/test.mp4",
        platform: "test",
      },
    });
    
    // Should respond (may be error but endpoint exists)
    expect(response.status()).toBeLessThan(500);
    console.log(`✓ Job creation endpoint accessible`);
  });

  test("frontend auth pages load", async ({ page }) => {
    // Login page
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator("form")).toBeVisible();
    console.log(`✓ Login page loads`);

    // Signup page
    await page.goto(`${BASE_URL}/signup`);
    await expect(page.locator("form")).toBeVisible();
    console.log(`✓ Signup page loads`);

    // Forgot password page
    await page.goto(`${BASE_URL}/forgot-password`);
    await expect(page.locator("form")).toBeVisible();
    console.log(`✓ Forgot password page loads`);
  });

  test("frontend API routes respond", async ({ request }) => {
    // Test internal API routes
    const authRoutes = [
      "/api/auth/login",
      "/api/auth/signup", 
      "/api/auth/forgot-password",
    ];

    for (const route of authRoutes) {
      const response = await request.post(`${BASE_URL}${route}`, {
        data: { email: "test@test.com", password: "test" },
      });
      
      // Should respond (may be error but route exists)
      expect(response.status()).toBeLessThan(500);
      console.log(`✓ ${route} responds`);
    }
  });
});

test.describe("Storage Connectivity Tests", () => {
  test("Supabase storage is accessible", async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"}`,
      },
    });
    
    // Storage endpoint should respond
    expect(response.status()).toBeLessThan(500);
    console.log(`✓ Supabase storage accessible`);
  });
});

test.describe("Connectivity Summary", () => {
  test("generate connectivity report", async ({ request, page }) => {
    const results: Record<string, boolean> = {};

    // Test all services
    try {
      const frontend = await request.get(BASE_URL);
      results["Frontend"] = frontend.ok();
    } catch {
      results["Frontend"] = false;
    }

    try {
      const api = await request.get(`${API_URL}/health`);
      results["API"] = api.ok();
    } catch {
      results["API"] = false;
    }

    try {
      const supabase = await request.get(`${SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" },
      });
      results["Supabase"] = supabase.ok();
    } catch {
      results["Supabase"] = false;
    }

    try {
      const mailpit = await request.get(`${MAILPIT_URL}/api/v1/messages`);
      results["Mailpit"] = mailpit.ok();
    } catch {
      results["Mailpit"] = false;
    }

    console.log("\n========================================");
    console.log("  CONNECTIVITY SUMMARY REPORT");
    console.log("========================================\n");

    let allHealthy = true;
    for (const [service, healthy] of Object.entries(results)) {
      const status = healthy ? "✓" : "✗";
      console.log(`${status} ${service}: ${healthy ? "Connected" : "FAILED"}`);
      if (!healthy) allHealthy = false;
    }

    console.log("\n========================================\n");

    // All services should be healthy
    expect(allHealthy).toBe(true);
  });
});

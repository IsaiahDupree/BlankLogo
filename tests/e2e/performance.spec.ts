import { test, expect } from "@playwright/test";

/**
 * BlankLogo Performance Tests
 * Tests response times and performance metrics for all user-facing flows
 */

const BASE_URL = "http://localhost:3939";
const API_URL = "http://localhost:8989";

// Performance thresholds (in milliseconds)
// Note: Local dev thresholds are more lenient than production
const THRESHOLDS = {
  pageLoad: 5000,          // Page should load in under 5s (dev)
  apiResponse: 1000,       // API should respond in under 1s
  authFlow: 30000,         // Auth operations under 30s (Supabase can be slow locally)
  navigation: 2000,        // Navigation under 2s
  firstContentfulPaint: 2500,  // FCP under 2.5s
  largestContentfulPaint: 4000, // LCP under 4s
  timeToInteractive: 5000,     // TTI under 5s
  jobCreation: 30000,      // Job creation under 30s (includes video download)
  concurrentJobs: 30000,   // Concurrent job creation under 30s
};

// Helper to measure execution time
async function measureTime(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

test.describe("Page Load Performance", () => {
  test("landing page loads within threshold", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Landing page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
  });

  test("login page loads within threshold", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Login page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
  });

  test("signup page loads within threshold", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/signup`, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Signup page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
  });

  test("pricing page loads within threshold", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Pricing page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
  });

  test("forgot-password page loads within threshold", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Forgot password page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
  });

  const platformPages = ["sora", "tiktok", "runway", "pika", "kling", "luma"];
  
  for (const platform of platformPages) {
    test(`/remove/${platform} page loads within threshold`, async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/remove/${platform}`, { waitUntil: "domcontentloaded" });
      
      const loadTime = Date.now() - startTime;
      
      console.log(`/remove/${platform} load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(THRESHOLDS.pageLoad);
    });
  }
});

test.describe("Navigation Performance", () => {
  test("navigation from landing to login is fast", async ({ page }) => {
    await page.goto(BASE_URL);
    
    const startTime = Date.now();
    
    // Click login link - try multiple selectors
    const loginLink = page.locator('a[href="/login"]').first();
    await loginLink.click();
    await page.waitForURL(/login/, { timeout: 10000 });
    
    const navTime = Date.now() - startTime;
    
    console.log(`Landing -> Login navigation: ${navTime}ms`);
    expect(navTime).toBeLessThan(THRESHOLDS.navigation);
  });

  test("navigation from login to signup is fast", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const startTime = Date.now();
    
    await page.click('a[href="/signup"]');
    await page.waitForURL(/signup/);
    
    const navTime = Date.now() - startTime;
    
    console.log(`Login -> Signup navigation: ${navTime}ms`);
    expect(navTime).toBeLessThan(THRESHOLDS.navigation);
  });

  test("navigation from login to forgot-password is fast", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    const startTime = Date.now();
    
    await page.click('a[href="/forgot-password"]');
    await page.waitForURL(/forgot-password/);
    
    const navTime = Date.now() - startTime;
    
    console.log(`Login -> Forgot Password navigation: ${navTime}ms`);
    expect(navTime).toBeLessThan(THRESHOLDS.navigation);
  });
});

test.describe("API Response Performance", () => {
  test("health endpoint responds quickly", async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.get(`${API_URL}/health`);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Health endpoint response time: ${responseTime}ms`);
    expect(response.ok()).toBe(true);
    expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse);
  });

  test("job creation endpoint responds within threshold", async ({ request }) => {
    const startTime = Date.now();
    
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "sora",
      },
    });
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Job creation response time: ${responseTime}ms`);
    expect(response.ok()).toBe(true);
    expect(responseTime).toBeLessThan(THRESHOLDS.jobCreation);
  });

  test("job status endpoint responds quickly", async ({ request }) => {
    // First create a job
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        platform: "custom",
      },
    });
    
    const { job_id } = await createResponse.json();
    
    const startTime = Date.now();
    
    const response = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Job status response time: ${responseTime}ms`);
    expect(response.ok()).toBe(true);
    expect(responseTime).toBeLessThan(THRESHOLDS.apiResponse);
  });
});

test.describe("Auth Flow Performance", () => {
  test("login form submission responds within threshold", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('#email, input[type="email"]', "test@example.com");
    await page.fill('#password, input[type="password"]', "testpassword123");
    
    const startTime = Date.now();
    
    await page.click('button[type="submit"]');
    
    // Wait for either redirect or error message
    await Promise.race([
      page.waitForURL(/app/, { timeout: 5000 }).catch(() => {}),
      page.waitForSelector('text=/error|invalid/i', { timeout: 5000 }).catch(() => {}),
    ]);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Login form submission time: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(THRESHOLDS.authFlow);
  });

  test("signup form submission responds within threshold", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    
    const testEmail = `perf-test-${Date.now()}@example.com`;
    
    await page.fill('#email, input[type="email"]', testEmail);
    await page.fill('#password, input[type="password"]', "testpassword123!");
    
    const startTime = Date.now();
    
    await page.click('button[type="submit"]');
    
    // Wait for response (success message or error)
    await Promise.race([
      page.waitForSelector('text=/check.*email|success|created/i', { timeout: 5000 }).catch(() => {}),
      page.waitForSelector('text=/error/i', { timeout: 5000 }).catch(() => {}),
    ]);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Signup form submission time: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(THRESHOLDS.authFlow);
  });

  test("forgot password form submission responds within threshold", async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    
    await page.fill('#email, input[type="email"]', "test@example.com");
    
    const startTime = Date.now();
    
    await page.click('button[type="submit"]');
    
    // Wait for confirmation
    await Promise.race([
      page.waitForSelector('text=/check|sent|email/i', { timeout: 5000 }).catch(() => {}),
      page.waitForSelector('text=/error/i', { timeout: 5000 }).catch(() => {}),
    ]);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`Forgot password submission time: ${responseTime}ms`);
    expect(responseTime).toBeLessThan(THRESHOLDS.authFlow);
  });

  test("auth API endpoints respond quickly", async ({ request }) => {
    // Test login API
    const loginStart = Date.now();
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: "test@example.com", password: "wrongpassword" },
    });
    const loginTime = Date.now() - loginStart;
    
    console.log(`Login API response time: ${loginTime}ms`);
    expect(loginTime).toBeLessThan(THRESHOLDS.authFlow);
    
    // Test forgot password API
    const forgotStart = Date.now();
    const forgotResponse = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: "test@example.com" },
    });
    const forgotTime = Date.now() - forgotStart;
    
    console.log(`Forgot password API response time: ${forgotTime}ms`);
    expect(forgotTime).toBeLessThan(THRESHOLDS.authFlow);
  });
});

test.describe("Core Web Vitals", () => {
  test("measures First Contentful Paint on landing page", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === "first-contentful-paint");
          if (fcpEntry) {
            resolve(fcpEntry.startTime);
          }
        });
        
        observer.observe({ type: "paint", buffered: true });
        
        // Fallback if already painted
        setTimeout(() => {
          const paintEntries = performance.getEntriesByType("paint");
          const fcpEntry = paintEntries.find(entry => entry.name === "first-contentful-paint");
          resolve(fcpEntry ? fcpEntry.startTime : 0);
        }, 100);
      });
    });
    
    console.log(`First Contentful Paint: ${fcp}ms`);
    expect(fcp).toBeLessThan(THRESHOLDS.firstContentfulPaint);
  });

  test("measures Largest Contentful Paint on landing page", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            // @ts-ignore - LCP entries have startTime
            lcpValue = entry.startTime;
          });
        });
        
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        
        setTimeout(() => {
          resolve(lcpValue);
        }, 500);
      });
    });
    
    console.log(`Largest Contentful Paint: ${lcp}ms`);
    expect(lcp).toBeLessThan(THRESHOLDS.largestContentfulPaint);
  });

  test("page does not have layout shifts above threshold", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-ignore - CLS entries have value
            if (!entry.hadRecentInput) {
              // @ts-ignore
              clsValue += entry.value;
            }
          }
        });
        
        observer.observe({ type: "layout-shift", buffered: true });
        
        setTimeout(() => {
          resolve(clsValue);
        }, 1000);
      });
    });
    
    console.log(`Cumulative Layout Shift: ${cls}`);
    expect(cls).toBeLessThan(0.1); // Good CLS is < 0.1
  });
});

test.describe("Concurrent Load Performance", () => {
  test("handles multiple simultaneous page requests", async ({ browser }) => {
    const pages = await Promise.all([
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
    ]);
    
    const startTime = Date.now();
    
    await Promise.all([
      pages[0].goto(BASE_URL),
      pages[1].goto(`${BASE_URL}/login`),
      pages[2].goto(`${BASE_URL}/signup`),
    ]);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`3 concurrent page loads: ${totalTime}ms`);
    expect(totalTime).toBeLessThan(THRESHOLDS.pageLoad * 1.5); // 50% overhead allowed
    
    // Cleanup
    await Promise.all(pages.map(p => p.close()));
  });

  test("handles multiple simultaneous API requests", async ({ request }) => {
    const startTime = Date.now();
    
    const responses = await Promise.all([
      request.get(`${API_URL}/health`),
      request.get(`${API_URL}/health`),
      request.get(`${API_URL}/health`),
      request.get(`${API_URL}/health`),
      request.get(`${API_URL}/health`),
    ]);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`5 concurrent API requests: ${totalTime}ms`);
    expect(totalTime).toBeLessThan(THRESHOLDS.apiResponse * 2);
    
    // All should succeed
    responses.forEach(r => expect(r.ok()).toBe(true));
  });

  test("handles concurrent job creations", async ({ request }) => {
    const startTime = Date.now();
    
    const responses = await Promise.all([
      request.post(`${API_URL}/api/v1/jobs`, {
        data: { video_url: "https://www.w3schools.com/html/mov_bbb.mp4", platform: "sora" },
      }),
      request.post(`${API_URL}/api/v1/jobs`, {
        data: { video_url: "https://www.w3schools.com/html/mov_bbb.mp4", platform: "tiktok" },
      }),
      request.post(`${API_URL}/api/v1/jobs`, {
        data: { video_url: "https://www.w3schools.com/html/mov_bbb.mp4", platform: "runway" },
      }),
    ]);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`3 concurrent job creations: ${totalTime}ms`);
    expect(totalTime).toBeLessThan(THRESHOLDS.concurrentJobs);
    
    // All should succeed
    responses.forEach(r => expect(r.ok()).toBe(true));
  });
});

test.describe("Resource Loading Performance", () => {
  test("CSS loads within threshold", async ({ page }) => {
    let cssCount = 0;
    const startTime = Date.now();
    
    page.on("response", (response) => {
      if (response.url().includes(".css")) {
        cssCount++;
      }
    });
    
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`CSS files loaded: ${cssCount}, Total time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test("JavaScript loads within threshold", async ({ page }) => {
    let jsCount = 0;
    const startTime = Date.now();
    
    page.on("response", (response) => {
      if (response.url().includes(".js")) {
        jsCount++;
      }
    });
    
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const loadTime = Date.now() - startTime;
    
    console.log(`JS files loaded: ${jsCount}, Total time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test("total page weight is reasonable", async ({ page }) => {
    let totalBytes = 0;
    
    page.on("response", async (response) => {
      const headers = response.headers();
      const contentLength = headers["content-length"];
      if (contentLength) {
        totalBytes += parseInt(contentLength, 10);
      }
    });
    
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    
    const totalKB = totalBytes / 1024;
    console.log(`Total page weight: ${totalKB.toFixed(2)}KB`);
    
    // Should be under 2MB
    expect(totalBytes).toBeLessThan(2 * 1024 * 1024);
  });
});

test.describe("Memory Performance", () => {
  test("page does not leak memory during navigation", async ({ page }) => {
    await page.goto(BASE_URL);
    
    const initialMemory = await page.evaluate(() => {
      // @ts-ignore - performance.memory is Chrome-specific
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    // Navigate through pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto(`${BASE_URL}/login`);
      await page.goto(`${BASE_URL}/signup`);
      await page.goto(BASE_URL);
    }
    
    const finalMemory = await page.evaluate(() => {
      // @ts-ignore
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const increasePercent = (memoryIncrease / initialMemory) * 100;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${increasePercent.toFixed(1)}%)`);
      
      // Memory should not increase more than 50%
      expect(increasePercent).toBeLessThan(50);
    }
  });
});

test.describe("Performance Summary Report", () => {
  test("generate performance report", async ({ page, request }) => {
    const metrics: Record<string, number> = {};
    
    // Landing page load
    let start = Date.now();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    metrics["Landing Page Load"] = Date.now() - start;
    
    // Login page load
    start = Date.now();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    metrics["Login Page Load"] = Date.now() - start;
    
    // API health
    start = Date.now();
    await request.get(`${API_URL}/health`);
    metrics["API Health Response"] = Date.now() - start;
    
    // Job creation
    start = Date.now();
    await request.post(`${API_URL}/api/v1/jobs`, {
      data: { video_url: "https://www.w3schools.com/html/mov_bbb.mp4", platform: "sora" },
    });
    metrics["Job Creation"] = Date.now() - start;
    
    console.log("\n========================================");
    console.log("  PERFORMANCE SUMMARY REPORT");
    console.log("========================================\n");
    
    for (const [metric, time] of Object.entries(metrics)) {
      const status = time < THRESHOLDS.pageLoad ? "✓" : "✗";
      console.log(`${status} ${metric}: ${time}ms`);
    }
    
    console.log("\n========================================\n");
    
    // All metrics should be within threshold
    expect(metrics["Landing Page Load"]).toBeLessThan(THRESHOLDS.pageLoad);
    expect(metrics["Login Page Load"]).toBeLessThan(THRESHOLDS.pageLoad);
    expect(metrics["API Health Response"]).toBeLessThan(THRESHOLDS.apiResponse);
  });
});

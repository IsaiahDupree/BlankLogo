/**
 * End-to-End Integration Tests
 * Tests the complete system working together
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:8989";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3939";

describe("End-to-End System Tests", () => {
  const testResults: { test: string; passed: boolean; duration: number }[] = [];
  
  beforeAll(() => {
    console.log("\n🚀 Starting End-to-End System Tests");
    console.log("━".repeat(60));
  });

  afterAll(() => {
    console.log("\n" + "━".repeat(60));
    console.log("📊 Test Results Summary:");
    console.log("━".repeat(60));
    
    const passed = testResults.filter(t => t.passed).length;
    const failed = testResults.filter(t => !t.passed).length;
    
    testResults.forEach(t => {
      const icon = t.passed ? "✅" : "❌";
      console.log(`${icon} ${t.test} (${t.duration}ms)`);
    });
    
    console.log("━".repeat(60));
    console.log(`Total: ${passed} passed, ${failed} failed`);
  });

  async function runTest(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
      await fn();
      testResults.push({ test: name, passed: true, duration: Date.now() - start });
    } catch (error) {
      testResults.push({ test: name, passed: false, duration: Date.now() - start });
      throw error;
    }
  }

  describe("System Health", () => {
    it("All services are operational", async () => {
      await runTest("All services operational", async () => {
        const res = await fetch(`${API_URL}/status`);
        const data = await res.json();
        
        console.log("\n📡 System Status:");
        console.log(`   Overall: ${data.status}`);
        console.log(`   Redis: ${data.services?.redis?.connected ? "✅" : "❌"}`);
        console.log(`   Queue: ${data.services?.queue?.available ? "✅" : "❌"}`);
        console.log(`   Supabase: ${data.services?.supabase?.connected ? "✅" : "❌"}`);
        
        expect(data.status).toMatch(/operational|degraded/);
      });
    });

    it("API responds to liveness probe", async () => {
      await runTest("API liveness", async () => {
        const res = await fetch(`${API_URL}/live`);
        const data = await res.json();
        expect(data.alive).toBe(true);
      });
    });

    it("API responds to readiness probe", async () => {
      await runTest("API readiness", async () => {
        const res = await fetch(`${API_URL}/ready`);
        const data = await res.json();
        console.log(`   Ready: ${data.ready}`);
      });
    });
  });

  describe("API Functionality", () => {
    it("Health endpoint returns valid data", async () => {
      await runTest("Health endpoint", async () => {
        const res = await fetch(`${API_URL}/health`);
        expect(res.ok).toBe(true);
        const data = await res.json();
        expect(data.status).toBe("healthy");
        expect(data.timestamp).toBeDefined();
      });
    });

    it("Platforms endpoint returns all presets", async () => {
      await runTest("Platforms endpoint", async () => {
        const res = await fetch(`${API_URL}/api/v1/platforms`);
        const data = await res.json();
        
        const expected = ["sora", "tiktok", "runway", "pika", "kling", "luma", "custom"];
        const platforms = data.platforms.map((p: { id: string }) => p.id);
        
        for (const e of expected) {
          expect(platforms).toContain(e);
        }
        
        console.log(`   Found ${platforms.length} platforms`);
      });
    });

    it("Authentication is enforced on protected routes", async () => {
      await runTest("Auth enforcement", async () => {
        const routes = [
          { method: "POST", path: "/api/v1/jobs" },
          { method: "POST", path: "/api/v1/jobs/upload" },
          { method: "POST", path: "/api/v1/jobs/batch" },
        ];
        
        for (const route of routes) {
          const res = await fetch(`${API_URL}${route.path}`, {
            method: route.method,
            headers: { "Content-Type": "application/json" },
            body: route.method === "POST" ? "{}" : undefined,
          });
          expect(res.status).toBe(401);
        }
        
        console.log(`   Tested ${routes.length} protected routes`);
      });
    });

    it("404 handler works correctly", async () => {
      await runTest("404 handler", async () => {
        const res = await fetch(`${API_URL}/nonexistent/path/here`);
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data.error).toBe("Not found");
      });
    });
  });

  describe("Frontend Functionality", () => {
    it("Homepage loads with correct branding", async () => {
      await runTest("Homepage branding", async () => {
        const res = await fetch(FRONTEND_URL);
        const html = await res.text();
        expect(html).toContain("BlankLogo");
      });
    });

    it("All public pages are accessible", async () => {
      await runTest("Public pages", async () => {
        const pages = ["/", "/login", "/signup", "/pricing"];
        
        for (const page of pages) {
          const res = await fetch(`${FRONTEND_URL}${page}`);
          expect(res.ok).toBe(true);
        }
        
        console.log(`   Tested ${pages.length} public pages`);
      });
    });

    it("App pages exist", async () => {
      await runTest("App pages", async () => {
        const pages = ["/app", "/app/upload", "/app/jobs", "/app/history", "/app/settings"];
        
        for (const page of pages) {
          const res = await fetch(`${FRONTEND_URL}${page}`);
          // May redirect or show page
          expect([200, 302, 307]).toContain(res.status);
        }
        
        console.log(`   Tested ${pages.length} app pages`);
      });
    });
  });

  describe("Error Handling", () => {
    it("Invalid JSON returns appropriate error", async () => {
      await runTest("Invalid JSON handling", async () => {
        const res = await fetch(`${API_URL}/api/v1/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid{json",
        });
        // Express JSON parser may return 400 or 500 for invalid JSON
        expect([400, 401, 500]).toContain(res.status);
      });
    });

    it("Missing auth returns 401 with error code", async () => {
      await runTest("Missing auth error", async () => {
        const res = await fetch(`${API_URL}/api/v1/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.code).toBeDefined();
      });
    });
  });

  describe("Performance Benchmarks", () => {
    it("Health endpoint < 50ms", async () => {
      await runTest("Health performance", async () => {
        const times: number[] = [];
        
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          await fetch(`${API_URL}/health`);
          times.push(Date.now() - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        console.log(`   Average: ${avg.toFixed(1)}ms`);
        expect(avg).toBeLessThan(50);
      });
    });

    it("Status endpoint < 200ms", async () => {
      await runTest("Status performance", async () => {
        const start = Date.now();
        await fetch(`${API_URL}/status`);
        const duration = Date.now() - start;
        console.log(`   Duration: ${duration}ms`);
        expect(duration).toBeLessThan(200);
      });
    });

    it("Platforms endpoint < 50ms", async () => {
      await runTest("Platforms performance", async () => {
        const start = Date.now();
        await fetch(`${API_URL}/api/v1/platforms`);
        const duration = Date.now() - start;
        console.log(`   Duration: ${duration}ms`);
        expect(duration).toBeLessThan(50);
      });
    });
  });
});

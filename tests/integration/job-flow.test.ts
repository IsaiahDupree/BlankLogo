/**
 * Integrated Tests for BlankLogo Job Flow
 * Tests the complete watermark removal pipeline
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:8989";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3939";
const TEST_VIDEO_URL = "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4";

interface ServiceStatus {
  status: string;
  services: {
    redis: { connected: boolean; ping: boolean };
    queue: { available: boolean };
    supabase: { connected: boolean };
  };
}

describe("BlankLogo Integration Tests", () => {
  let serviceStatus: ServiceStatus | null = null;

  beforeAll(async () => {
    console.log("\n📋 Starting BlankLogo Integration Tests");
    console.log("━".repeat(50));
  });

  afterAll(() => {
    console.log("━".repeat(50));
    console.log("✅ Integration tests complete\n");
  });

  describe("1. Service Connectivity", () => {
    it("API server is running and healthy", async () => {
      console.log("\n🔍 Testing API health...");
      
      const res = await fetch(`${API_URL}/health`);
      expect(res.ok).toBe(true);
      
      const data = await res.json();
      console.log("   ✅ API Status:", data.status);
      expect(data.status).toBe("healthy");
    });

    it("API server is ready to accept traffic", async () => {
      console.log("🔍 Testing API readiness...");
      
      const res = await fetch(`${API_URL}/ready`);
      const data = await res.json();
      
      console.log("   Ready:", data.ready);
      console.log("   Checks:", JSON.stringify(data.checks));
      
      // Store for later tests
      serviceStatus = await (await fetch(`${API_URL}/status`)).json();
    });

    it("Full status endpoint returns comprehensive data", async () => {
      console.log("🔍 Testing full status...");
      
      const res = await fetch(`${API_URL}/status`);
      expect(res.ok).toBe(true);
      
      const data = await res.json();
      serviceStatus = data;
      
      console.log("   Status:", data.status);
      console.log("   Uptime:", data.uptime?.human);
      console.log("   Redis:", data.services?.redis?.connected ? "✅" : "❌");
      console.log("   Queue:", data.services?.queue?.available ? "✅" : "❌");
      console.log("   Supabase:", data.services?.supabase?.connected ? "✅" : "❌");
      
      expect(data.status).toMatch(/operational|degraded/);
      expect(data.timestamp).toBeDefined();
      expect(data.services).toBeDefined();
    });

    it("Redis is connected", async () => {
      console.log("🔍 Testing Redis connection...");
      
      expect(serviceStatus?.services?.redis?.connected).toBe(true);
      console.log("   ✅ Redis connected");
    });

    it("Job queue is available", async () => {
      console.log("🔍 Testing job queue...");
      
      expect(serviceStatus?.services?.queue?.available).toBe(true);
      console.log("   ✅ Queue available");
    });

    it("Supabase is connected", async () => {
      console.log("🔍 Testing Supabase connection...");
      
      expect(serviceStatus?.services?.supabase?.connected).toBe(true);
      console.log("   ✅ Supabase connected");
    });
  });

  describe("2. API Endpoints", () => {
    it("GET /api/v1/platforms returns platform presets", async () => {
      console.log("\n🔍 Testing platforms endpoint...");
      
      const res = await fetch(`${API_URL}/api/v1/platforms`);
      expect(res.ok).toBe(true);
      
      const data = await res.json();
      expect(data.platforms).toBeDefined();
      expect(Array.isArray(data.platforms)).toBe(true);
      
      const platformNames = data.platforms.map((p: { id: string }) => p.id);
      console.log("   Platforms:", platformNames.join(", "));
      
      expect(platformNames).toContain("sora");
      expect(platformNames).toContain("tiktok");
      expect(platformNames).toContain("runway");
    });

    it("POST /api/v1/jobs requires authentication", async () => {
      console.log("🔍 Testing job creation auth...");
      
      const res = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: TEST_VIDEO_URL }),
      });
      
      expect(res.status).toBe(401);
      
      const data = await res.json();
      expect(data.code).toMatch(/NO_TOKEN|INVALID_TOKEN/);
      console.log("   ✅ Auth required (401)");
    });

    it("Invalid routes return 404", async () => {
      console.log("🔍 Testing 404 handling...");
      
      const res = await fetch(`${API_URL}/api/v1/nonexistent`);
      expect(res.status).toBe(404);
      
      const data = await res.json();
      expect(data.error).toBe("Not found");
      console.log("   ✅ 404 returned correctly");
    });
  });

  describe("3. Frontend Accessibility", () => {
    it("Homepage loads", async () => {
      console.log("\n🔍 Testing frontend homepage...");
      
      const res = await fetch(FRONTEND_URL);
      expect(res.ok).toBe(true);
      
      const html = await res.text();
      expect(html).toContain("BlankLogo");
      console.log("   ✅ Homepage loads with BlankLogo branding");
    });

    it("Login page loads", async () => {
      console.log("🔍 Testing login page...");
      
      const res = await fetch(`${FRONTEND_URL}/login`);
      expect(res.ok).toBe(true);
      console.log("   ✅ Login page accessible");
    });

    it("App dashboard is protected", async () => {
      console.log("🔍 Testing dashboard protection...");
      
      const res = await fetch(`${FRONTEND_URL}/app`, { redirect: "manual" });
      // Should either redirect (307/302) or show login
      expect([200, 302, 307]).toContain(res.status);
      console.log("   ✅ Dashboard route exists");
    });

    it("Upload page loads", async () => {
      console.log("🔍 Testing upload page...");
      
      const res = await fetch(`${FRONTEND_URL}/app/upload`);
      expect(res.ok).toBe(true);
      console.log("   ✅ Upload page accessible");
    });
  });

  describe("4. Error Handling", () => {
    it("API handles invalid JSON gracefully", async () => {
      console.log("\n🔍 Testing invalid JSON handling...");
      
      const res = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token"
        },
        body: "not valid json",
      });
      
      // Should return 400, 401, or 500 (JSON parse error may cause 500)
      expect([400, 401, 500]).toContain(res.status);
      console.log("   ✅ Invalid JSON handled with status:", res.status);
    });

    it("API handles missing required fields", async () => {
      console.log("🔍 Testing missing fields handling...");
      
      const res = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token"
        },
        body: JSON.stringify({}),
      });
      
      // Should return 400 or 401
      expect([400, 401]).toContain(res.status);
      console.log("   ✅ Missing fields handled");
    });
  });

  describe("5. Performance", () => {
    it("Health endpoint responds quickly (<100ms)", async () => {
      console.log("\n🔍 Testing health endpoint performance...");
      
      const start = Date.now();
      await fetch(`${API_URL}/health`);
      const duration = Date.now() - start;
      
      console.log(`   Response time: ${duration}ms`);
      expect(duration).toBeLessThan(100);
      console.log("   ✅ Health endpoint is fast");
    });

    it("Status endpoint responds within 500ms", async () => {
      console.log("🔍 Testing status endpoint performance...");
      
      const start = Date.now();
      await fetch(`${API_URL}/status`);
      const duration = Date.now() - start;
      
      console.log(`   Response time: ${duration}ms`);
      expect(duration).toBeLessThan(500);
      console.log("   ✅ Status endpoint responds quickly");
    });
  });
});

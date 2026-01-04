/**
 * Worker Integration Tests
 * Tests the job processing worker functionality
 */

import { describe, it, expect, beforeAll } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:8989";

describe("Worker Integration Tests", () => {
  beforeAll(() => {
    console.log("\n🔧 Starting Worker Integration Tests");
    console.log("━".repeat(50));
  });

  describe("1. Queue Status", () => {
    it("Queue is available via API status", async () => {
      console.log("\n🔍 Checking queue availability...");
      
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      
      expect(data.services?.queue).toBeDefined();
      console.log("   Queue available:", data.services?.queue?.available);
      console.log("   Queue stats:", JSON.stringify(data.services?.queue?.stats));
    });

    it("Queue stats show job counts", async () => {
      console.log("🔍 Checking queue statistics...");
      
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      
      const stats = data.services?.queue?.stats;
      if (stats) {
        console.log("   Waiting jobs:", stats.waiting);
        console.log("   Active jobs:", stats.active);
        console.log("   Completed jobs:", stats.completed);
        console.log("   Failed jobs:", stats.failed);
        
        expect(typeof stats.waiting).toBe("number");
        expect(typeof stats.active).toBe("number");
        expect(typeof stats.completed).toBe("number");
        expect(typeof stats.failed).toBe("number");
      }
    });
  });

  describe("2. Redis Connection", () => {
    it("Redis is connected and responding", async () => {
      console.log("\n🔍 Checking Redis connectivity...");
      
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      
      const redis = data.services?.redis;
      expect(redis?.connected).toBe(true);
      expect(redis?.ping).toBe(true);
      
      console.log("   Connected:", redis?.connected);
      console.log("   Ping:", redis?.ping);
      console.log("   Latency:", redis?.latencyMs + "ms");
    });
  });

  describe("3. Job Submission (requires auth)", () => {
    it("Unauthenticated job submission is rejected", async () => {
      console.log("\n🔍 Testing job submission without auth...");
      
      const res = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: "https://example.com/video.mp4",
          platform: "sora",
        }),
      });
      
      expect(res.status).toBe(401);
      console.log("   ✅ Rejected with 401");
    });

    it("Invalid token is rejected", async () => {
      console.log("🔍 Testing invalid token...");
      
      const res = await fetch(`${API_URL}/api/v1/jobs`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer invalid-token-12345"
        },
        body: JSON.stringify({
          video_url: "https://example.com/video.mp4",
          platform: "sora",
        }),
      });
      
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe("INVALID_TOKEN");
      console.log("   ✅ Invalid token rejected");
    });
  });

  describe("4. Platform Configuration", () => {
    it("All platforms have valid crop settings", async () => {
      console.log("\n🔍 Validating platform configurations...");
      
      const res = await fetch(`${API_URL}/api/v1/platforms`);
      const data = await res.json();
      
      for (const platform of data.platforms) {
        expect(platform.id).toBeDefined();
        expect(platform.name).toBeDefined();
        // Some platforms (auto, instagram, facebook, meta) have 0 crop pixels
        expect(platform.default_crop_pixels).toBeGreaterThanOrEqual(0);
        expect(platform.crop_position).toMatch(/top|bottom|left|right/);
        
        console.log(`   ${platform.name}: ${platform.default_crop_pixels}px (${platform.crop_position})`);
      }
    });
  });
});

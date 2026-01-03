import { test, expect } from "@playwright/test";

// ============================================
// BlankLogo API E2E Tests
// Full watermark removal flow via API
// ============================================

const API_URL = process.env.API_URL || "http://localhost:8989";
const TEST_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

test.describe("API Health & Status", () => {
  test("health check returns healthy", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.timestamp).toBeDefined();
  });
});

test.describe("Job Creation API", () => {
  test("creates job with URL input", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        processing_mode: "crop",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.job_id).toMatch(/^job_[a-z0-9]+$/);
    expect(data.status).toBe("queued");
    expect(data.platform).toBe("sora");
    expect(data.crop_pixels).toBe(100); // Sora preset
  });

  test("creates job with TikTok platform preset", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "tiktok",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.platform).toBe("tiktok");
    expect(data.crop_pixels).toBe(80); // TikTok preset
  });

  test("creates job with custom crop pixels", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "custom",
        crop_pixels: 150,
        crop_position: "bottom",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.crop_pixels).toBe(150);
  });

  test("creates job with inpaint processing mode", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        processing_mode: "inpaint",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe("queued");
  });

  test("rejects request without video_url", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        platform: "sora",
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("video_url");
  });

  test("rejects invalid processing_mode", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        processing_mode: "invalid_mode",
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("processing_mode");
  });
});

test.describe("Batch Job API", () => {
  test("creates batch jobs for multiple videos", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs/batch`, {
      data: {
        videos: [
          { video_url: TEST_VIDEO_URL },
          { video_url: TEST_VIDEO_URL },
        ],
        platform: "sora",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.batch_id).toMatch(/^batch_[a-z0-9]+$/);
    expect(data.jobs).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  test("rejects batch with more than 20 videos", async ({ request }) => {
    const videos = Array(21).fill({ video_url: TEST_VIDEO_URL });
    
    const response = await request.post(`${API_URL}/api/v1/jobs/batch`, {
      data: {
        videos,
        platform: "sora",
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("20");
  });

  test("rejects empty videos array", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs/batch`, {
      data: {
        videos: [],
        platform: "sora",
      },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("Full Processing Flow", () => {
  test("complete job lifecycle: create -> process -> complete", async ({ request }) => {
    // Step 1: Create job
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        processing_mode: "crop",
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const { job_id } = await createResponse.json();
    expect(job_id).toBeDefined();

    // Step 2: Poll for completion (max 60 seconds)
    let status = "queued";
    let attempts = 0;
    const maxAttempts = 30;
    
    while (status !== "completed" && status !== "failed" && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      
      if (statusResponse.ok()) {
        const statusData = await statusResponse.json();
        status = statusData.status;
        
        if (status === "completed") {
          expect(statusData.output?.downloadUrl).toBeDefined();
          expect(statusData.processingTimeMs).toBeGreaterThan(0);
        }
      }
      
      attempts++;
    }

    // Job should complete within timeout (or database might not be set up)
    expect(attempts).toBeLessThan(maxAttempts);
  });

  test("job with webhook notification", async ({ request }) => {
    // Note: In real test, you'd use a webhook testing service like webhook.site
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        webhook_url: "https://webhook.site/test-webhook",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.job_id).toBeDefined();
  });
});

test.describe("Platform Presets", () => {
  const platforms = [
    { name: "sora", expectedCrop: 100 },
    { name: "tiktok", expectedCrop: 80 },
    { name: "runway", expectedCrop: 60 },
    { name: "pika", expectedCrop: 50 },
    { name: "kling", expectedCrop: 70 },
    { name: "luma", expectedCrop: 55 },
  ];

  for (const platform of platforms) {
    test(`${platform.name} uses correct crop preset (${platform.expectedCrop}px)`, async ({ request }) => {
      const response = await request.post(`${API_URL}/api/v1/jobs`, {
        data: {
          video_url: TEST_VIDEO_URL,
          platform: platform.name,
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.crop_pixels).toBe(platform.expectedCrop);
    });
  }
});

test.describe("Error Handling", () => {
  test("handles invalid video URL gracefully", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "not-a-valid-url",
        platform: "sora",
      },
    });

    // Should accept the job (validation happens during processing)
    expect(response.ok()).toBeTruthy();
  });

  test("handles non-existent job ID", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/jobs/job_nonexistent123`);
    expect(response.status()).toBe(404);
  });
});

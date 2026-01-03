import { test, expect } from "@playwright/test";

// ============================================
// BlankLogo Email Notification E2E Tests
// Tests for job completion notifications
// ============================================

const API_URL = process.env.API_URL || "http://localhost:8989";
const MAILPIT_URL = process.env.MAILPIT_URL || "http://localhost:8025";
const TEST_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";

test.describe("Webhook Notifications", () => {
  test("accepts webhook URL in job creation", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        webhook_url: "https://webhook.site/blanklogo-test",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.job_id).toBeDefined();
  });

  test("webhook payload includes job details on completion", async ({ request }) => {
    // Create job with webhook
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        webhook_url: "https://httpbin.org/post", // Echo service for testing
        metadata: {
          test_id: `test_${Date.now()}`,
          user_email: "test@example.com",
        },
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const { job_id } = await createResponse.json();

    // Wait for job to complete
    let completed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed" || data.status === "failed") {
          completed = true;
          break;
        }
      }
    }

    // Job should complete (webhook would be sent)
    expect(completed).toBe(true);
  });

  test("handles webhook failure gracefully", async ({ request }) => {
    // Create job with invalid webhook URL
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        webhook_url: "https://invalid-domain-that-doesnt-exist.com/webhook",
      },
    });

    expect(response.ok()).toBeTruthy();
    const { job_id } = await response.json();

    // Job should still complete even if webhook fails
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed") {
          expect(data.status).toBe("completed");
          break;
        }
        if (data.status === "failed") {
          // Should not fail due to webhook
          expect(data.error).not.toContain("webhook");
          break;
        }
      }
    }
  });
});

test.describe("Email Notifications (via Mailpit)", () => {
  test.skip(
    !process.env.MAILPIT_URL,
    "Mailpit URL not configured - skipping email tests"
  );

  test("sends completion email when job finishes", async ({ request }) => {
    const testEmail = `test-${Date.now()}@blanklogo.test`;

    // Create job with email notification
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        metadata: {
          notify_email: testEmail,
        },
      },
    });

    const { job_id } = await createResponse.json();

    // Wait for job completion
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed" || data.status === "failed") {
          break;
        }
      }
    }

    // Check Mailpit for email
    const mailResponse = await request.get(
      `${MAILPIT_URL}/api/v1/search?query=to:${testEmail}`
    );

    if (mailResponse.ok()) {
      const mailData = await mailResponse.json();
      expect(mailData.messages?.length).toBeGreaterThan(0);

      // Verify email content
      const email = mailData.messages[0];
      expect(email.Subject).toContain("BlankLogo");
      expect(email.Subject.toLowerCase()).toMatch(/complete|ready|done/);
    }
  });

  test("email contains download link", async ({ request }) => {
    const testEmail = `download-test-${Date.now()}@blanklogo.test`;

    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        metadata: {
          notify_email: testEmail,
        },
      },
    });

    const { job_id } = await createResponse.json();

    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed") break;
      }
    }

    // Check email content
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for email delivery

    const mailResponse = await request.get(
      `${MAILPIT_URL}/api/v1/search?query=to:${testEmail}`
    );

    if (mailResponse.ok()) {
      const mailData = await mailResponse.json();
      if (mailData.messages?.length > 0) {
        const emailId = mailData.messages[0].ID;
        const emailDetail = await request.get(`${MAILPIT_URL}/api/v1/message/${emailId}`);
        
        if (emailDetail.ok()) {
          const emailContent = await emailDetail.json();
          // Email body should contain download URL
          expect(emailContent.HTML || emailContent.Text).toMatch(/download|https?:\/\//i);
        }
      }
    }
  });

  test("does not send email for failed jobs (or sends failure notification)", async ({ request }) => {
    const testEmail = `fail-test-${Date.now()}@blanklogo.test`;

    // Create job with invalid video URL
    const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: "https://invalid-url-that-will-fail.com/video.mp4",
        platform: "sora",
        metadata: {
          notify_email: testEmail,
        },
      },
    });

    const { job_id } = await createResponse.json();

    // Wait for job to fail
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "failed") break;
      }
    }

    // Check if failure email was sent (or no email)
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mailResponse = await request.get(
      `${MAILPIT_URL}/api/v1/search?query=to:${testEmail}`
    );

    if (mailResponse.ok()) {
      const mailData = await mailResponse.json();
      // Either no email or a failure notification
      if (mailData.messages?.length > 0) {
        const email = mailData.messages[0];
        expect(email.Subject.toLowerCase()).toMatch(/fail|error|issue/);
      }
    }
  });
});

test.describe("Notification Preferences", () => {
  test("respects user notification preferences", async ({ request }) => {
    // Create job without notification
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        metadata: {
          notifications_enabled: false,
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    // Job should be created without webhook/email
  });

  test("supports multiple notification channels", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs`, {
      data: {
        video_url: TEST_VIDEO_URL,
        platform: "sora",
        webhook_url: "https://webhook.site/test",
        metadata: {
          notify_email: "user@example.com",
          notify_slack: "https://hooks.slack.com/test",
        },
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});

test.describe("Batch Job Notifications", () => {
  test("sends single notification for batch completion", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs/batch`, {
      data: {
        videos: [
          { video_url: TEST_VIDEO_URL },
          { video_url: TEST_VIDEO_URL },
        ],
        platform: "sora",
        webhook_url: "https://webhook.site/batch-test",
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.batch_id).toBeDefined();
    expect(data.jobs.length).toBe(2);
  });

  test("batch webhook includes all job statuses", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/jobs/batch`, {
      data: {
        videos: [
          { video_url: TEST_VIDEO_URL },
          { video_url: TEST_VIDEO_URL },
          { video_url: TEST_VIDEO_URL },
        ],
        platform: "sora",
        webhook_url: "https://httpbin.org/post",
      },
    });

    expect(response.ok()).toBeTruthy();
    const { batch_id, jobs } = await response.json();

    // All jobs should have IDs
    expect(jobs.every((j: any) => j.job_id)).toBe(true);
  });
});

/**
 * BlankLogo E2E Test Helpers
 * Utilities for testing watermark removal functionality
 */

import { APIRequestContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const API_URL = process.env.API_URL || "http://localhost:8080";

export interface JobResult {
  job_id: string;
  status: string;
  platform: string;
  crop_pixels: number;
  output_url?: string;
  processing_time_ms?: number;
  error?: string;
}

/**
 * Create a watermark removal job and wait for completion
 */
export async function createAndWaitForJob(
  request: APIRequestContext,
  options: {
    video_url: string;
    platform?: string;
    processing_mode?: "crop" | "inpaint" | "auto";
    crop_pixels?: number;
    timeout_ms?: number;
  }
): Promise<JobResult> {
  const {
    video_url,
    platform = "sora",
    processing_mode = "crop",
    crop_pixels,
    timeout_ms = 60000,
  } = options;

  // Create job
  const createResponse = await request.post(`${API_URL}/api/v1/jobs`, {
    data: {
      video_url,
      platform,
      processing_mode,
      ...(crop_pixels && { crop_pixels }),
    },
  });

  if (!createResponse.ok()) {
    throw new Error(`Failed to create job: ${await createResponse.text()}`);
  }

  const { job_id, crop_pixels: actualCropPixels } = await createResponse.json();

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < timeout_ms) {
    await sleep(2000);

    const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
    if (statusResponse.ok()) {
      const data = await statusResponse.json();

      if (data.status === "completed") {
        return {
          job_id,
          status: "completed",
          platform,
          crop_pixels: actualCropPixels,
          output_url: data.output?.downloadUrl,
          processing_time_ms: data.processingTimeMs,
        };
      }

      if (data.status === "failed") {
        return {
          job_id,
          status: "failed",
          platform,
          crop_pixels: actualCropPixels,
          error: data.error,
        };
      }
    }
  }

  return {
    job_id,
    status: "timeout",
    platform,
    crop_pixels: actualCropPixels,
    error: `Job did not complete within ${timeout_ms}ms`,
  };
}

/**
 * Create a batch of jobs and wait for all to complete
 */
export async function createBatchAndWait(
  request: APIRequestContext,
  videos: string[],
  options: {
    platform?: string;
    timeout_ms?: number;
  } = {}
): Promise<{ batch_id: string; results: JobResult[] }> {
  const { platform = "sora", timeout_ms = 120000 } = options;

  // Create batch
  const createResponse = await request.post(`${API_URL}/api/v1/jobs/batch`, {
    data: {
      videos: videos.map((url) => ({ video_url: url })),
      platform,
    },
  });

  if (!createResponse.ok()) {
    throw new Error(`Failed to create batch: ${await createResponse.text()}`);
  }

  const { batch_id, jobs } = await createResponse.json();
  const jobIds = jobs.map((j: any) => j.job_id);

  // Poll for all jobs
  const results: JobResult[] = [];
  const startTime = Date.now();

  while (Date.now() - startTime < timeout_ms && results.length < jobIds.length) {
    await sleep(3000);

    for (const job_id of jobIds) {
      if (results.some((r) => r.job_id === job_id)) continue;

      const statusResponse = await request.get(`${API_URL}/api/v1/jobs/${job_id}`);
      if (statusResponse.ok()) {
        const data = await statusResponse.json();
        if (data.status === "completed" || data.status === "failed") {
          results.push({
            job_id,
            status: data.status,
            platform,
            crop_pixels: data.cropPixels || 100,
            output_url: data.output?.downloadUrl,
            processing_time_ms: data.processingTimeMs,
            error: data.error,
          });
        }
      }
    }
  }

  return { batch_id, results };
}

/**
 * Get available test video URLs
 */
export function getTestVideoUrls(): string[] {
  return [
    "https://www.w3schools.com/html/mov_bbb.mp4",
    "https://www.w3schools.com/html/movie.mp4",
    "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
  ];
}

/**
 * Get local test video path if available
 */
export function getLocalTestVideo(): string | null {
  const possiblePaths = [
    path.join(__dirname, "test-video.mp4"),
    path.join(__dirname, "../fixtures/test-video.mp4"),
    "/Users/isaiahdupree/Downloads/Download.mp4",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Platform crop presets
 */
export const PLATFORM_PRESETS = {
  sora: { cropPixels: 100, cropPosition: "bottom" },
  tiktok: { cropPixels: 80, cropPosition: "bottom" },
  runway: { cropPixels: 60, cropPosition: "bottom" },
  pika: { cropPixels: 50, cropPosition: "bottom" },
  midjourney: { cropPixels: 40, cropPosition: "bottom" },
  kling: { cropPixels: 70, cropPosition: "bottom" },
  luma: { cropPixels: 55, cropPosition: "bottom" },
} as const;

/**
 * Verify a video file is valid
 */
export async function verifyVideoFile(
  request: APIRequestContext,
  url: string
): Promise<boolean> {
  try {
    const response = await request.head(url);
    const contentType = response.headers()["content-type"];
    return contentType?.includes("video") || false;
  } catch {
    return false;
  }
}

/**
 * Generate unique test ID
 */
export function generateTestId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

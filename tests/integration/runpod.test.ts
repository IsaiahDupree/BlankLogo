/**
 * RunPod Integration Tests
 * 
 * Tests GPU-accelerated watermark removal via RunPod
 * Including health checks, auto-scaling, and processing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RunPodClient } from '../../apps/worker/src/runpod-client';
import * as fs from 'fs';
import * as path from 'path';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_POD_ID = process.env.RUNPOD_POD_ID;
const TEST_VIDEO_PATH = path.join(__dirname, '../../test-videos/sora-watermark-test.mp4');

// Skip tests if no RunPod credentials
const describeRunPod = RUNPOD_API_KEY ? describe : describe.skip;

describeRunPod('RunPod GPU Integration', () => {
  let client: RunPodClient;

  beforeAll(() => {
    client = new RunPodClient({
      apiKey: RUNPOD_API_KEY,
      podId: RUNPOD_POD_ID,
      idleTimeoutMs: 5 * 60 * 1000, // 5 minutes
    });
  });

  describe('Health & Status', () => {
    it('should get pod status', async () => {
      const status = await client.getPodStatus();
      
      console.log('Pod Status:', JSON.stringify(status, null, 2));
      
      if (status) {
        expect(status.id).toBeDefined();
        expect(status.name).toBeDefined();
        expect(['RUNNING', 'EXITED', 'STOPPED']).toContain(status.desiredStatus);
      }
    }, 30000);

    it('should get comprehensive health', async () => {
      const health = await client.getHealth();
      
      console.log('Health:', JSON.stringify(health, null, 2));
      
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy', 'stopped', 'unknown']).toContain(health.status);
      expect(health.lastCheck).toBeDefined();
      expect(health.gpu).toBeDefined();
    }, 30000);

    it('should get capabilities', async () => {
      const capabilities = await client.getCapabilities();
      
      console.log('Capabilities:', JSON.stringify(capabilities, null, 2));
      
      expect(capabilities).toHaveProperty('service');
      expect(capabilities).toHaveProperty('status');
      expect(capabilities).toHaveProperty('autoScaling');
      expect(capabilities).toHaveProperty('capabilities');
    }, 30000);
  });

  describe('Auto-Scaling', () => {
    it('should track activity time', () => {
      // Record activity
      client.recordActivity();
      
      // Should not scale down immediately
      expect(client.shouldScaleDown()).toBe(false);
    });

    it('should detect idle state for scale-down', async () => {
      // Create client with very short timeout for testing
      const testClient = new RunPodClient({
        apiKey: RUNPOD_API_KEY,
        podId: RUNPOD_POD_ID,
        idleTimeoutMs: 100, // 100ms for testing
      });

      // Wait for timeout
      await new Promise(r => setTimeout(r, 150));
      
      expect(testClient.shouldScaleDown()).toBe(true);
    });

    it('should include scale-down timing in capabilities', async () => {
      client.recordActivity();
      const capabilities = await client.getCapabilities() as any;
      
      expect(capabilities.autoScaling.enabled).toBe(true);
      expect(capabilities.autoScaling.idleTimeoutMs).toBeDefined();
      expect(capabilities.autoScaling.willScaleDownIn).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Pod Lifecycle', () => {
    it('should ensure pod is running', async () => {
      const health = await client.ensureRunning();
      
      console.log('After ensureRunning:', JSON.stringify(health, null, 2));
      
      expect(health.status).toBe('healthy');
    }, 180000); // 3 minute timeout for pod startup

    it('should have GPU available when running', async () => {
      const health = await client.getHealth();
      
      if (health.status === 'healthy') {
        expect(health.gpu.available).toBe(true);
        console.log(`GPU Utilization: ${health.gpu.utilization}%`);
        console.log(`GPU Memory: ${health.gpu.memoryUtilization}%`);
      }
    }, 30000);

    it('should have HTTP endpoint when running', async () => {
      const health = await client.getHealth();
      
      if (health.status === 'healthy') {
        expect(health.httpEndpoint).toBeTruthy();
        console.log(`HTTP Endpoint: ${health.httpEndpoint}`);
      }
    }, 30000);
  });
});

describeRunPod('RunPod Video Processing', () => {
  let client: RunPodClient;

  beforeAll(() => {
    client = new RunPodClient({
      apiKey: RUNPOD_API_KEY,
      podId: RUNPOD_POD_ID,
    });
  });

  it('should process video on GPU', async () => {
    // Skip if no test video
    if (!fs.existsSync(TEST_VIDEO_PATH)) {
      console.log('Test video not found, skipping...');
      return;
    }

    // Ensure pod is running
    await client.ensureRunning();

    // Read test video
    const videoBuffer = fs.readFileSync(TEST_VIDEO_PATH);
    console.log(`Input video size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Process on GPU
    const startTime = Date.now();
    const result = await client.processVideo(videoBuffer, {
      mode: 'inpaint',
      platform: 'sora',
    });
    const totalTime = (Date.now() - startTime) / 1000;

    console.log('Processing Result:');
    console.log(`  Mode: ${result.stats.mode}`);
    console.log(`  Frames: ${result.stats.framesProcessed}`);
    console.log(`  Watermarks: ${result.stats.watermarksDetected}`);
    console.log(`  Processing Time: ${result.stats.processingTimeS}s`);
    console.log(`  Total Time: ${totalTime.toFixed(2)}s`);

    expect(result.videoBase64).toBeTruthy();
    expect(result.stats.framesProcessed).toBeGreaterThan(0);
  }, 300000); // 5 minute timeout
});

describe('RunPod Client (No Credentials)', () => {
  it('should handle missing API key gracefully', () => {
    const client = new RunPodClient({
      apiKey: '',
      podId: undefined,
    });

    expect(client).toBeDefined();
  });

  it('should return null for pod status without credentials', async () => {
    const client = new RunPodClient({
      apiKey: '',
      podId: undefined,
    });

    const status = await client.getPodStatus();
    expect(status).toBeNull();
  });
});

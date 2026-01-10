/**
 * RunPod Client for BlankLogo
 * 
 * Handles GPU-accelerated watermark removal via RunPod with:
 * - Auto-scaling (scale to zero when idle)
 * - Health monitoring
 * - Automatic wake-up on request
 */

import { logger } from './logger';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_POD_ID = process.env.RUNPOD_POD_ID;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;

interface PodStatus {
  id: string;
  name: string;
  desiredStatus: 'RUNNING' | 'EXITED' | 'STOPPED';
  runtime: {
    uptimeInSeconds: number;
    ports: Array<{
      ip: string;
      privatePort: number;
      publicPort: number;
      type: string;
    }>;
    gpus: Array<{
      id: string;
      gpuUtilPercent: number;
      memoryUtilPercent: number;
    }>;
  } | null;
  lastStatusChange: string;
}

interface RunPodHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'stopped' | 'unknown';
  pod: PodStatus | null;
  uptime: number;
  gpu: {
    available: boolean;
    utilization: number;
    memoryUtilization: number;
  };
  httpEndpoint: string | null;
  sshEndpoint: string | null;
  lastCheck: string;
}

interface ProcessingResult {
  videoBase64: string;
  stats: {
    mode: string;
    framesProcessed: number;
    watermarksDetected: number;
    processingTimeS: number;
    totalTimeS: number;
  };
}

export class RunPodClient {
  private apiKey: string;
  private podId: string | null;
  private endpointId: string | null;
  private baseUrl = 'https://api.runpod.io/graphql';
  private lastActivityTime: number = Date.now();
  private idleTimeoutMs: number = 5 * 60 * 1000; // 5 minutes default

  constructor(options?: {
    apiKey?: string;
    podId?: string;
    endpointId?: string;
    idleTimeoutMs?: number;
  }) {
    this.apiKey = options?.apiKey || RUNPOD_API_KEY || '';
    this.podId = options?.podId || RUNPOD_POD_ID || null;
    this.endpointId = options?.endpointId || RUNPOD_ENDPOINT_ID || null;
    this.idleTimeoutMs = options?.idleTimeoutMs || this.idleTimeoutMs;

    if (!this.apiKey) {
      logger.warn('[RunPod] No API key configured - GPU processing unavailable');
    }
  }

  /**
   * Execute GraphQL query against RunPod API
   */
  private async graphql<T>(query: string): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`RunPod API error: ${JSON.stringify(result.errors)}`);
    }

    return result.data as T;
  }

  /**
   * Get current pod status
   */
  async getPodStatus(): Promise<PodStatus | null> {
    if (!this.podId) return null;

    const query = `
      query {
        pod(input: { podId: "${this.podId}" }) {
          id
          name
          desiredStatus
          lastStatusChange
          runtime {
            uptimeInSeconds
            ports { ip privatePort publicPort type }
            gpus { id gpuUtilPercent memoryUtilPercent }
          }
        }
      }
    `;

    const data = await this.graphql<{ pod: PodStatus }>(query);
    return data.pod;
  }

  /**
   * Get comprehensive health status
   */
  async getHealth(): Promise<RunPodHealth> {
    const health: RunPodHealth = {
      status: 'unknown',
      pod: null,
      uptime: 0,
      gpu: {
        available: false,
        utilization: 0,
        memoryUtilization: 0,
      },
      httpEndpoint: null,
      sshEndpoint: null,
      lastCheck: new Date().toISOString(),
    };

    try {
      const pod = await this.getPodStatus();
      health.pod = pod;

      if (!pod) {
        health.status = 'unknown';
        return health;
      }

      if (pod.desiredStatus === 'EXITED' || pod.desiredStatus === 'STOPPED') {
        health.status = 'stopped';
        return health;
      }

      if (!pod.runtime) {
        health.status = 'degraded';
        return health;
      }

      health.uptime = pod.runtime.uptimeInSeconds;
      health.status = 'healthy';

      // Extract GPU info
      if (pod.runtime.gpus && pod.runtime.gpus.length > 0) {
        const gpu = pod.runtime.gpus[0];
        health.gpu = {
          available: true,
          utilization: gpu.gpuUtilPercent || 0,
          memoryUtilization: gpu.memoryUtilPercent || 0,
        };
      }

      // Extract endpoints
      for (const port of pod.runtime.ports) {
        if (port.type === 'http' && port.privatePort === 8081) {
          health.httpEndpoint = `http://${port.ip}:${port.publicPort}`;
        }
        if (port.type === 'tcp' && port.privatePort === 22) {
          health.sshEndpoint = `${port.ip}:${port.publicPort}`;
        }
      }

    } catch (error) {
      logger.error('[RunPod] Health check failed:', error);
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Start the pod if it's stopped
   */
  async startPod(): Promise<boolean> {
    if (!this.podId) {
      logger.error('[RunPod] No pod ID configured');
      return false;
    }

    logger.info(`[RunPod] Starting pod ${this.podId}...`);

    const query = `
      mutation {
        podResume(input: { podId: "${this.podId}", gpuCount: 1 }) {
          id
          desiredStatus
        }
      }
    `;

    try {
      await this.graphql(query);
      logger.info('[RunPod] Pod start requested');
      return true;
    } catch (error) {
      logger.error('[RunPod] Failed to start pod:', error);
      return false;
    }
  }

  /**
   * Stop the pod (scale to zero)
   */
  async stopPod(): Promise<boolean> {
    if (!this.podId) {
      logger.error('[RunPod] No pod ID configured');
      return false;
    }

    logger.info(`[RunPod] Stopping pod ${this.podId} (scale to zero)...`);

    const query = `
      mutation {
        podStop(input: { podId: "${this.podId}" }) {
          id
          desiredStatus
        }
      }
    `;

    try {
      await this.graphql(query);
      logger.info('[RunPod] Pod stop requested');
      return true;
    } catch (error) {
      logger.error('[RunPod] Failed to stop pod:', error);
      return false;
    }
  }

  /**
   * Wait for pod to be ready
   */
  async waitForReady(timeoutMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 5000;

    logger.info('[RunPod] Waiting for pod to be ready...');

    while (Date.now() - startTime < timeoutMs) {
      const health = await this.getHealth();
      
      if (health.status === 'healthy' && health.httpEndpoint) {
        logger.info(`[RunPod] Pod ready! Endpoint: ${health.httpEndpoint}`);
        return true;
      }

      logger.info(`[RunPod] Pod status: ${health.status}, waiting...`);
      await new Promise(r => setTimeout(r, pollInterval));
    }

    logger.error('[RunPod] Timeout waiting for pod to be ready');
    return false;
  }

  /**
   * Ensure pod is running, start if needed
   */
  async ensureRunning(): Promise<RunPodHealth> {
    const health = await this.getHealth();

    if (health.status === 'healthy') {
      this.lastActivityTime = Date.now();
      return health;
    }

    if (health.status === 'stopped') {
      logger.info('[RunPod] Pod is stopped, starting...');
      await this.startPod();
      await this.waitForReady();
      return this.getHealth();
    }

    if (health.status === 'degraded') {
      logger.info('[RunPod] Pod is starting up, waiting...');
      await this.waitForReady();
      return this.getHealth();
    }

    throw new Error(`Pod in unexpected state: ${health.status}`);
  }

  /**
   * Process video with GPU acceleration
   */
  async processVideo(
    videoBuffer: Buffer,
    options: {
      mode?: 'crop' | 'inpaint' | 'auto';
      platform?: string;
      cropPixels?: number;
      cropPosition?: string;
    } = {}
  ): Promise<ProcessingResult> {
    logger.info('[RunPod] Processing video on GPU...');
    
    // Ensure pod is running
    const health = await this.ensureRunning();
    
    if (!health.httpEndpoint) {
      throw new Error('No HTTP endpoint available');
    }

    this.lastActivityTime = Date.now();

    // Prepare request
    const videoBase64 = videoBuffer.toString('base64');
    const payload = {
      video_base64: videoBase64,
      mode: options.mode || 'inpaint',
      platform: options.platform || 'sora',
      crop_pixels: options.cropPixels || 100,
      crop_position: options.cropPosition || 'bottom',
    };

    // Send to GPU server
    const response = await fetch(`${health.httpEndpoint}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`GPU processing failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    logger.info(`[RunPod] Processing complete: ${result.stats?.processing_time_s}s`);

    return {
      videoBase64: result.video_base64,
      stats: {
        mode: result.stats?.mode || options.mode || 'inpaint',
        framesProcessed: result.stats?.frames_processed || 0,
        watermarksDetected: result.stats?.watermarks_detected || 0,
        processingTimeS: result.stats?.processing_time_s || 0,
        totalTimeS: result.stats?.total_time_s || 0,
      },
    };
  }

  /**
   * Check if pod should be scaled down due to inactivity
   */
  shouldScaleDown(): boolean {
    const idleTime = Date.now() - this.lastActivityTime;
    return idleTime > this.idleTimeoutMs;
  }

  /**
   * Auto-scale check - call periodically to manage costs
   */
  async checkAutoScale(): Promise<void> {
    if (!this.shouldScaleDown()) {
      return;
    }

    const health = await this.getHealth();
    
    if (health.status === 'healthy') {
      logger.info(`[RunPod] Pod idle for ${Math.round((Date.now() - this.lastActivityTime) / 1000)}s, scaling down...`);
      await this.stopPod();
    }
  }

  /**
   * Get capabilities of the GPU service
   */
  async getCapabilities(): Promise<object> {
    const health = await this.getHealth();

    return {
      service: 'blanklogo-runpod-gpu',
      available: health.status === 'healthy',
      status: health.status,
      uptime: health.uptime,
      gpu: health.gpu,
      endpoint: health.httpEndpoint,
      autoScaling: {
        enabled: true,
        idleTimeoutMs: this.idleTimeoutMs,
        lastActivity: new Date(this.lastActivityTime).toISOString(),
        willScaleDownIn: Math.max(0, this.idleTimeoutMs - (Date.now() - this.lastActivityTime)),
      },
      capabilities: {
        modes: ['crop', 'inpaint', 'auto'],
        gpuAcceleration: true,
        expectedSpeedup: '5-10x vs CPU',
      },
    };
  }

  /**
   * Record activity to prevent scale-down
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }
}

// Singleton instance
let runpodClient: RunPodClient | null = null;

export function getRunPodClient(): RunPodClient {
  if (!runpodClient) {
    runpodClient = new RunPodClient();
  }
  return runpodClient;
}

// Auto-scale interval (check every minute)
let autoScaleInterval: NodeJS.Timeout | null = null;

export function startAutoScaling(intervalMs: number = 60000): void {
  if (autoScaleInterval) return;
  
  logger.info('[RunPod] Starting auto-scale monitoring...');
  
  autoScaleInterval = setInterval(async () => {
    try {
      await getRunPodClient().checkAutoScale();
    } catch (error) {
      logger.error('[RunPod] Auto-scale check failed:', error);
    }
  }, intervalMs);
}

export function stopAutoScaling(): void {
  if (autoScaleInterval) {
    clearInterval(autoScaleInterval);
    autoScaleInterval = null;
    logger.info('[RunPod] Auto-scale monitoring stopped');
  }
}

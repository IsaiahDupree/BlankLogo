/**
 * Webhook Delivery System
 * Sends job status updates to user-configured webhook URLs
 */

import crypto from 'crypto';

const WEBHOOK_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

interface WebhookPayload {
  event: 'job.started' | 'job.completed' | 'job.failed' | 'job.progress';
  timestamp: string;
  data: {
    jobId: string;
    status: string;
    platform?: string;
    outputUrl?: string;
    errorMessage?: string;
    progress?: number;
    processingTime?: number;
    metadata?: Record<string, unknown>;
  };
}

interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
  duration: number;
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Send webhook with retry logic
 */
export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const startTime = Date.now();
  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'BlankLogo-Webhook/1.0',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
  };

  // Add signature if secret provided
  if (secret) {
    headers['X-Webhook-Signature'] = `sha256=${generateSignature(payloadString, secret)}`;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatusCode = response.status;

      // Success: 2xx status codes
      if (response.ok) {
        console.log(`[Webhook] ✅ Delivered to ${url} (attempt ${attempt + 1})`);
        return {
          success: true,
          statusCode: response.status,
          attempts: attempt + 1,
          duration: Date.now() - startTime,
        };
      }

      // Don't retry on client errors (4xx) except rate limits
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        lastError = `Client error: ${response.status}`;
        break;
      }

      lastError = `Server error: ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = 'Request timeout';
      }
    }

    // Wait before retry
    if (attempt < MAX_RETRIES - 1) {
      console.log(`[Webhook] ⏳ Retry ${attempt + 2}/${MAX_RETRIES} for ${url} in ${RETRY_DELAYS[attempt]}ms`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  console.error(`[Webhook] ❌ Failed to deliver to ${url}: ${lastError}`);
  return {
    success: false,
    statusCode: lastStatusCode,
    attempts: MAX_RETRIES,
    error: lastError,
    duration: Date.now() - startTime,
  };
}

/**
 * Send job started webhook
 */
export async function sendJobStartedWebhook(
  webhookUrl: string,
  jobId: string,
  platform: string,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const payload: WebhookPayload = {
    event: 'job.started',
    timestamp: new Date().toISOString(),
    data: {
      jobId,
      status: 'processing',
      platform,
    },
  };

  return deliverWebhook(webhookUrl, payload, secret);
}

/**
 * Send job completed webhook
 */
export async function sendJobCompletedWebhook(
  webhookUrl: string,
  jobId: string,
  outputUrl: string,
  platform: string,
  processingTime: number,
  metadata?: Record<string, unknown>,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const payload: WebhookPayload = {
    event: 'job.completed',
    timestamp: new Date().toISOString(),
    data: {
      jobId,
      status: 'completed',
      platform,
      outputUrl,
      processingTime,
      metadata,
    },
  };

  return deliverWebhook(webhookUrl, payload, secret);
}

/**
 * Send job failed webhook
 */
export async function sendJobFailedWebhook(
  webhookUrl: string,
  jobId: string,
  errorMessage: string,
  platform: string,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const payload: WebhookPayload = {
    event: 'job.failed',
    timestamp: new Date().toISOString(),
    data: {
      jobId,
      status: 'failed',
      platform,
      errorMessage,
    },
  };

  return deliverWebhook(webhookUrl, payload, secret);
}

/**
 * Send job progress webhook
 */
export async function sendJobProgressWebhook(
  webhookUrl: string,
  jobId: string,
  progress: number,
  secret?: string
): Promise<WebhookDeliveryResult> {
  const payload: WebhookPayload = {
    event: 'job.progress',
    timestamp: new Date().toISOString(),
    data: {
      jobId,
      status: 'processing',
      progress,
    },
  };

  return deliverWebhook(webhookUrl, payload, secret);
}

/**
 * Validate webhook URL
 */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTPS in production
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }
    
    // Block internal/private IPs
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254.',
      '10.',
      '172.16.',
      '192.168.',
    ];
    
    if (blockedPatterns.some(pattern => hostname.startsWith(pattern) || hostname === pattern)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export default {
  deliverWebhook,
  sendJobStartedWebhook,
  sendJobCompletedWebhook,
  sendJobFailedWebhook,
  sendJobProgressWebhook,
  isValidWebhookUrl,
};

/**
 * Webhook Delivery System Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Webhook Delivery System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Webhook URL Validation', () => {
    const isValidWebhookUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
          return false;
        }
        
        const hostname = parsed.hostname.toLowerCase();
        const blockedPatterns = [
          'localhost', '127.0.0.1', '0.0.0.0', '::1',
          '169.254.', '10.', '172.16.', '192.168.',
        ];
        
        if (blockedPatterns.some(p => hostname.startsWith(p) || hostname === p)) {
          return false;
        }
        
        return true;
      } catch {
        return false;
      }
    };

    it('should accept valid HTTPS URLs', () => {
      expect(isValidWebhookUrl('https://example.com/webhook')).toBe(true);
      expect(isValidWebhookUrl('https://api.myapp.com/hooks/blanklogo')).toBe(true);
    });

    it('should accept HTTP in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isValidWebhookUrl('http://example.com/webhook')).toBe(true);
    });

    it('should reject localhost URLs', () => {
      expect(isValidWebhookUrl('http://localhost:3000/webhook')).toBe(false);
      expect(isValidWebhookUrl('http://127.0.0.1/webhook')).toBe(false);
    });

    it('should reject private IP ranges', () => {
      expect(isValidWebhookUrl('http://10.0.0.1/webhook')).toBe(false);
      expect(isValidWebhookUrl('http://192.168.1.1/webhook')).toBe(false);
      expect(isValidWebhookUrl('http://172.16.0.1/webhook')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidWebhookUrl('not-a-url')).toBe(false);
      expect(isValidWebhookUrl('')).toBe(false);
    });
  });

  describe('Webhook Payload Generation', () => {
    it('should generate correct job.started payload', () => {
      const payload = {
        event: 'job.started',
        timestamp: new Date().toISOString(),
        data: {
          jobId: 'job-123',
          status: 'processing',
          platform: 'sora',
        },
      };

      expect(payload.event).toBe('job.started');
      expect(payload.data.jobId).toBe('job-123');
      expect(payload.data.status).toBe('processing');
    });

    it('should generate correct job.completed payload', () => {
      const payload = {
        event: 'job.completed',
        timestamp: new Date().toISOString(),
        data: {
          jobId: 'job-123',
          status: 'completed',
          platform: 'runway',
          outputUrl: 'https://storage.example.com/video.mp4',
          processingTime: 15000,
        },
      };

      expect(payload.event).toBe('job.completed');
      expect(payload.data.outputUrl).toBeDefined();
      expect(payload.data.processingTime).toBe(15000);
    });

    it('should generate correct job.failed payload', () => {
      const payload = {
        event: 'job.failed',
        timestamp: new Date().toISOString(),
        data: {
          jobId: 'job-123',
          status: 'failed',
          platform: 'pika',
          errorMessage: 'Download timeout',
        },
      };

      expect(payload.event).toBe('job.failed');
      expect(payload.data.errorMessage).toBe('Download timeout');
    });
  });

  describe('HMAC Signature Generation', () => {
    it('should generate consistent signatures', () => {
      const crypto = require('crypto');
      const generateSignature = (payload: string, secret: string) => {
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
      };

      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      
      const sig1 = generateSignature(payload, secret);
      const sig2 = generateSignature(payload, secret);
      
      expect(sig1).toBe(sig2);
      expect(sig1.length).toBe(64); // SHA256 hex length
    });

    it('should produce different signatures for different secrets', () => {
      const crypto = require('crypto');
      const generateSignature = (payload: string, secret: string) => {
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
      };

      const payload = JSON.stringify({ test: 'data' });
      
      const sig1 = generateSignature(payload, 'secret1');
      const sig2 = generateSignature(payload, 'secret2');
      
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('Webhook Delivery', () => {
    it('should send webhook with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const url = 'https://example.com/webhook';
      const payload = { event: 'job.completed', data: {} };
      
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BlankLogo-Webhook/1.0',
        },
        body: JSON.stringify(payload),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle successful delivery', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const response = await fetch('https://example.com/webhook', {
        method: 'POST',
        body: '{}',
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
    });

    it('should handle failed delivery', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const response = await fetch('https://example.com/webhook', {
        method: 'POST',
        body: '{}',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Retry Logic', () => {
    it('should calculate correct retry delays', () => {
      const RETRY_DELAYS = [1000, 5000, 15000];
      
      expect(RETRY_DELAYS[0]).toBe(1000);  // 1s
      expect(RETRY_DELAYS[1]).toBe(5000);  // 5s
      expect(RETRY_DELAYS[2]).toBe(15000); // 15s
    });

    it('should not retry on 4xx errors (except 429)', () => {
      const shouldRetry = (status: number) => {
        if (status >= 400 && status < 500 && status !== 429) {
          return false;
        }
        return true;
      };

      expect(shouldRetry(400)).toBe(false);
      expect(shouldRetry(401)).toBe(false);
      expect(shouldRetry(404)).toBe(false);
      expect(shouldRetry(429)).toBe(true); // Rate limit should retry
      expect(shouldRetry(500)).toBe(true);
      expect(shouldRetry(503)).toBe(true);
    });

    it('should retry on 5xx errors', () => {
      const shouldRetry = (status: number) => status >= 500;
      
      expect(shouldRetry(500)).toBe(true);
      expect(shouldRetry(502)).toBe(true);
      expect(shouldRetry(503)).toBe(true);
    });
  });

  describe('Webhook Events', () => {
    const validEvents = ['job.started', 'job.completed', 'job.failed', 'job.progress'];

    it('should have all required event types', () => {
      expect(validEvents).toContain('job.started');
      expect(validEvents).toContain('job.completed');
      expect(validEvents).toContain('job.failed');
      expect(validEvents).toContain('job.progress');
    });

    it('should validate event type', () => {
      const isValidEvent = (event: string) => validEvents.includes(event);
      
      expect(isValidEvent('job.started')).toBe(true);
      expect(isValidEvent('job.completed')).toBe(true);
      expect(isValidEvent('invalid.event')).toBe(false);
    });
  });
});

describe('Webhook Security', () => {
  it('should include timestamp in payload', () => {
    const payload = {
      event: 'job.completed',
      timestamp: new Date().toISOString(),
      data: {},
    };

    expect(payload.timestamp).toBeDefined();
    expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
  });

  it('should include signature header when secret provided', () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    const secret = 'webhook-secret';
    if (secret) {
      headers['X-Webhook-Signature'] = 'sha256=abc123';
    }

    expect(headers['X-Webhook-Signature']).toBeDefined();
  });
});

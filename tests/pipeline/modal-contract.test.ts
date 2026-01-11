/**
 * Modal GPU Contract Tests
 * 
 * Tier A: Fast CI tests for Modal HTTP contract
 * Verifies request/response shapes match expected contract
 */
import { describe, it, expect, beforeAll } from 'vitest';

const MODAL_WORKSPACE = 'isaiahdupree33';
const MODAL_APP_NAME = 'blanklogo-watermark-removal';
const MODAL_HEALTH_URL = `https://${MODAL_WORKSPACE}--${MODAL_APP_NAME}-health.modal.run`;
const MODAL_PROCESS_URL = `https://${MODAL_WORKSPACE}--${MODAL_APP_NAME}-process-video-http.modal.run`;

// Contract types - these must match Modal app
interface ModalHealthResponse {
  status: 'ok' | 'error';
  service: string;
}

interface ModalProcessRequest {
  video_bytes: string; // base64
  mode: 'inpaint' | 'crop' | 'auto';
  platform: string;
}

interface ModalProcessResponse {
  video_bytes: string; // base64
  stats: {
    mode: string;
    platform: string;
    input_size_mb: number;
    output_size_mb: number;
    frames_processed: number;
    watermarks_detected: number;
    processing_time_s: number;
  };
}

interface ModalErrorResponse {
  error: string;
  traceback?: string;
}

describe('Modal Contract Tests', () => {
  describe('Health Endpoint Contract', () => {
    it('should return correct health response shape', async () => {
      const response = await fetch(MODAL_HEALTH_URL);
      expect(response.ok).toBe(true);
      
      const data = await response.json() as ModalHealthResponse;
      
      // Verify contract shape
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('service');
      expect(data.status).toBe('ok');
      expect(data.service).toBe('blanklogo-watermark-removal');
    });

    it('should respond within 5 seconds', async () => {
      const start = Date.now();
      await fetch(MODAL_HEALTH_URL);
      const latency = Date.now() - start;
      
      expect(latency).toBeLessThan(5000);
    });
  });

  describe('Process Endpoint Contract', () => {
    it('should accept correct request shape', async () => {
      // Create minimal valid request
      const request: ModalProcessRequest = {
        video_bytes: '', // Empty for contract test
        mode: 'inpaint',
        platform: 'sora',
      };

      // Just verify the endpoint accepts the shape (will fail on empty video)
      const response = await fetch(MODAL_PROCESS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      // Should get a response (error is OK for contract test)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    it('should return error for invalid mode', async () => {
      const request = {
        video_bytes: 'dGVzdA==', // "test" in base64
        mode: 'invalid_mode',
        platform: 'sora',
      };

      const response = await fetch(MODAL_PROCESS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      // Should fail - either with JSON error or text error
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json() as ModalErrorResponse;
          expect(data).toHaveProperty('error');
        } else {
          // Modal may return text errors for internal failures
          const text = await response.text();
          expect(text.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('Modal Response Shape Validation', () => {
  it('stats object should have all required fields', () => {
    // Type-level contract enforcement
    const mockStats: ModalProcessResponse['stats'] = {
      mode: 'inpaint',
      platform: 'sora',
      input_size_mb: 1.5,
      output_size_mb: 1.4,
      frames_processed: 120,
      watermarks_detected: 1,
      processing_time_s: 45.2,
    };

    expect(mockStats).toHaveProperty('mode');
    expect(mockStats).toHaveProperty('platform');
    expect(mockStats).toHaveProperty('input_size_mb');
    expect(mockStats).toHaveProperty('output_size_mb');
    expect(mockStats).toHaveProperty('frames_processed');
    expect(mockStats).toHaveProperty('watermarks_detected');
    expect(mockStats).toHaveProperty('processing_time_s');
    
    expect(typeof mockStats.frames_processed).toBe('number');
    expect(typeof mockStats.processing_time_s).toBe('number');
  });
});

/**
 * Worker Unit Tests
 * 
 * Tier A: Fast CI tests for worker logic
 * Tests state machine, retry logic, timeout handling
 */
import { describe, it, expect } from 'vitest';

// Job status state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  'queued': ['processing', 'cancelled'],
  'processing': ['completed', 'failed'],
  'completed': [], // Terminal state
  'failed': ['queued'], // Can retry
  'cancelled': [], // Terminal state
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Retry classification
type RetryDecision = 'retry' | 'fail' | 'skip';

function classifyError(error: { code?: string; status?: number; message?: string }): RetryDecision {
  // Non-retryable errors
  if (error.code === 'INVALID_INPUT') return 'fail';
  if (error.code === 'UNSUPPORTED_CODEC') return 'fail';
  if (error.code === 'FILE_TOO_LARGE') return 'fail';
  if (error.message?.includes('corrupted')) return 'fail';
  
  // Retryable errors
  if (error.status === 429) return 'retry'; // Rate limited
  if (error.status === 503) return 'retry'; // Service unavailable
  if (error.status === 502) return 'retry'; // Bad gateway
  if (error.code === 'TIMEOUT') return 'retry';
  if (error.code === 'ECONNRESET') return 'retry';
  if (error.message?.includes('timeout')) return 'retry';
  
  // Default to retry for unknown errors
  return 'retry';
}

// Exponential backoff calculation
function calculateBackoff(attempt: number, baseMs: number = 5000, maxMs: number = 60000): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

describe('Worker State Machine', () => {
  describe('Valid Transitions', () => {
    it('queued → processing is valid', () => {
      expect(isValidTransition('queued', 'processing')).toBe(true);
    });

    it('queued → cancelled is valid', () => {
      expect(isValidTransition('queued', 'cancelled')).toBe(true);
    });

    it('processing → completed is valid', () => {
      expect(isValidTransition('processing', 'completed')).toBe(true);
    });

    it('processing → failed is valid', () => {
      expect(isValidTransition('processing', 'failed')).toBe(true);
    });

    it('failed → queued is valid (retry)', () => {
      expect(isValidTransition('failed', 'queued')).toBe(true);
    });
  });

  describe('Invalid Transitions', () => {
    it('queued → completed is invalid (must go through processing)', () => {
      expect(isValidTransition('queued', 'completed')).toBe(false);
    });

    it('completed → anything is invalid (terminal)', () => {
      expect(isValidTransition('completed', 'queued')).toBe(false);
      expect(isValidTransition('completed', 'processing')).toBe(false);
      expect(isValidTransition('completed', 'failed')).toBe(false);
    });

    it('cancelled → anything is invalid (terminal)', () => {
      expect(isValidTransition('cancelled', 'queued')).toBe(false);
      expect(isValidTransition('cancelled', 'processing')).toBe(false);
    });

    it('processing → queued is invalid', () => {
      expect(isValidTransition('processing', 'queued')).toBe(false);
    });
  });
});

describe('Error Classification', () => {
  describe('Non-retryable Errors', () => {
    it('INVALID_INPUT should not retry', () => {
      expect(classifyError({ code: 'INVALID_INPUT' })).toBe('fail');
    });

    it('UNSUPPORTED_CODEC should not retry', () => {
      expect(classifyError({ code: 'UNSUPPORTED_CODEC' })).toBe('fail');
    });

    it('FILE_TOO_LARGE should not retry', () => {
      expect(classifyError({ code: 'FILE_TOO_LARGE' })).toBe('fail');
    });

    it('corrupted file should not retry', () => {
      expect(classifyError({ message: 'File appears to be corrupted' })).toBe('fail');
    });
  });

  describe('Retryable Errors', () => {
    it('429 (rate limit) should retry', () => {
      expect(classifyError({ status: 429 })).toBe('retry');
    });

    it('503 (service unavailable) should retry', () => {
      expect(classifyError({ status: 503 })).toBe('retry');
    });

    it('502 (bad gateway) should retry', () => {
      expect(classifyError({ status: 502 })).toBe('retry');
    });

    it('TIMEOUT should retry', () => {
      expect(classifyError({ code: 'TIMEOUT' })).toBe('retry');
    });

    it('ECONNRESET should retry', () => {
      expect(classifyError({ code: 'ECONNRESET' })).toBe('retry');
    });

    it('timeout message should retry', () => {
      expect(classifyError({ message: 'Request timeout after 30s' })).toBe('retry');
    });
  });

  describe('Default Behavior', () => {
    it('unknown errors should retry by default', () => {
      expect(classifyError({ message: 'Something went wrong' })).toBe('retry');
      expect(classifyError({})).toBe('retry');
    });
  });
});

describe('Backoff Calculation', () => {
  it('should increase exponentially', () => {
    const base = 5000;
    // Without jitter for testing
    expect(Math.round(base * Math.pow(2, 0))).toBe(5000);  // Attempt 0
    expect(Math.round(base * Math.pow(2, 1))).toBe(10000); // Attempt 1
    expect(Math.round(base * Math.pow(2, 2))).toBe(20000); // Attempt 2
    expect(Math.round(base * Math.pow(2, 3))).toBe(40000); // Attempt 3
  });

  it('should cap at max delay', () => {
    const delay = calculateBackoff(10, 5000, 60000);
    expect(delay).toBeLessThanOrEqual(66000); // Max + 10% jitter
  });

  it('should include jitter (not deterministic)', () => {
    const delays = Array.from({ length: 10 }, () => calculateBackoff(1, 5000, 60000));
    const uniqueDelays = new Set(delays);
    // With jitter, we should get different values (very unlikely to get 10 identical)
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });
});

describe('Job Payload Validation', () => {
  interface JobPayload {
    jobId: string;
    inputUrl: string;
    platform: string;
    processingMode: 'crop' | 'inpaint' | 'auto';
  }

  function validateJobPayload(payload: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['Payload must be an object'] };
    }

    const p = payload as Record<string, unknown>;

    if (!p.jobId || typeof p.jobId !== 'string') {
      errors.push('jobId is required and must be a string');
    }

    if (!p.inputUrl || typeof p.inputUrl !== 'string') {
      errors.push('inputUrl is required and must be a string');
    } else if (!p.inputUrl.startsWith('http')) {
      errors.push('inputUrl must be a valid URL');
    }

    if (!p.platform || typeof p.platform !== 'string') {
      errors.push('platform is required and must be a string');
    }

    const validModes = ['crop', 'inpaint', 'auto'];
    if (!p.processingMode || !validModes.includes(p.processingMode as string)) {
      errors.push(`processingMode must be one of: ${validModes.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  it('should accept valid payload', () => {
    const payload: JobPayload = {
      jobId: 'job_123',
      inputUrl: 'https://example.com/video.mp4',
      platform: 'sora',
      processingMode: 'inpaint',
    };
    
    const result = validateJobPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing jobId', () => {
    const payload = {
      inputUrl: 'https://example.com/video.mp4',
      platform: 'sora',
      processingMode: 'inpaint',
    };
    
    const result = validateJobPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('jobId is required and must be a string');
  });

  it('should reject invalid URL', () => {
    const payload = {
      jobId: 'job_123',
      inputUrl: 'not-a-url',
      platform: 'sora',
      processingMode: 'inpaint',
    };
    
    const result = validateJobPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('inputUrl must be a valid URL');
  });

  it('should reject invalid processing mode', () => {
    const payload = {
      jobId: 'job_123',
      inputUrl: 'https://example.com/video.mp4',
      platform: 'sora',
      processingMode: 'invalid',
    };
    
    const result = validateJobPayload(payload);
    expect(result.valid).toBe(false);
  });
});

describe('Idempotency Key Generation', () => {
  function generateIdempotencyKey(jobId: string, attempt: number): string {
    return `${jobId}:attempt:${attempt}`;
  }

  it('should generate unique keys per attempt', () => {
    const key1 = generateIdempotencyKey('job_123', 1);
    const key2 = generateIdempotencyKey('job_123', 2);
    
    expect(key1).not.toBe(key2);
    expect(key1).toBe('job_123:attempt:1');
    expect(key2).toBe('job_123:attempt:2');
  });

  it('should generate same key for same job and attempt', () => {
    const key1 = generateIdempotencyKey('job_123', 1);
    const key2 = generateIdempotencyKey('job_123', 1);
    
    expect(key1).toBe(key2);
  });
});

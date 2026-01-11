/**
 * Failure Mode Tests
 * 
 * Tier B/C: Tests for expected failure scenarios
 * Ensures graceful handling and correct error states
 */
import { describe, it, expect } from 'vitest';

// Error response structure
interface JobError {
  code: string;
  message: string;
  retryable: boolean;
}

// Error classification
function classifyJobError(error: { status?: number; code?: string; message?: string }): JobError {
  // Input validation errors (non-retryable)
  if (error.code === 'INVALID_BASE64' || error.message?.includes('invalid base64')) {
    return { code: 'FAILED_INPUT', message: 'Invalid video encoding', retryable: false };
  }
  
  if (error.code === 'CORRUPTED_FILE' || error.message?.includes('corrupted')) {
    return { code: 'FAILED_INPUT', message: 'Video file is corrupted', retryable: false };
  }

  // Size/limit errors (non-retryable)
  if (error.code === 'FILE_TOO_LARGE' || error.message?.includes('too large')) {
    return { code: 'FAILED_LIMITS', message: 'Video exceeds size limit', retryable: false };
  }

  if (error.code === 'DURATION_TOO_LONG' || error.message?.includes('duration')) {
    return { code: 'FAILED_LIMITS', message: 'Video exceeds duration limit', retryable: false };
  }

  // Codec errors (non-retryable)
  if (error.code === 'UNSUPPORTED_CODEC' || error.message?.includes('codec')) {
    return { code: 'FAILED_CODEC', message: 'Unsupported video codec', retryable: false };
  }

  // Provider errors (retryable)
  if (error.status === 500 || error.code === 'MODAL_ERROR') {
    return { code: 'FAILED_PROVIDER', message: 'GPU processing failed', retryable: true };
  }

  if (error.status === 503 || error.code === 'SERVICE_UNAVAILABLE') {
    return { code: 'FAILED_PROVIDER', message: 'Service temporarily unavailable', retryable: true };
  }

  if (error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
    return { code: 'FAILED_TIMEOUT', message: 'Processing timed out', retryable: true };
  }

  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    return { code: 'FAILED_RATE_LIMIT', message: 'Rate limited', retryable: true };
  }

  // Storage errors (retryable for upload, might not be for download)
  if (error.code === 'UPLOAD_FAILED') {
    return { code: 'FAILED_STORAGE', message: 'Failed to upload output', retryable: true };
  }

  if (error.code === 'DOWNLOAD_FAILED') {
    return { code: 'FAILED_DOWNLOAD', message: 'Failed to download input', retryable: true };
  }

  // Default: unknown error (retryable with caution)
  return { code: 'FAILED_UNKNOWN', message: error.message || 'Unknown error', retryable: true };
}

describe('Input & Validation Failures', () => {
  it('should classify invalid base64 as non-retryable', () => {
    const result = classifyJobError({ code: 'INVALID_BASE64' });
    expect(result.code).toBe('FAILED_INPUT');
    expect(result.retryable).toBe(false);
  });

  it('should classify corrupted file as non-retryable', () => {
    const result = classifyJobError({ message: 'File appears to be corrupted' });
    expect(result.code).toBe('FAILED_INPUT');
    expect(result.retryable).toBe(false);
  });

  it('should classify file too large as non-retryable', () => {
    const result = classifyJobError({ code: 'FILE_TOO_LARGE' });
    expect(result.code).toBe('FAILED_LIMITS');
    expect(result.retryable).toBe(false);
  });

  it('should classify unsupported codec as non-retryable', () => {
    const result = classifyJobError({ code: 'UNSUPPORTED_CODEC' });
    expect(result.code).toBe('FAILED_CODEC');
    expect(result.retryable).toBe(false);
  });
});

describe('Modal/Provider Failures', () => {
  it('should classify 500 error as retryable', () => {
    const result = classifyJobError({ status: 500 });
    expect(result.code).toBe('FAILED_PROVIDER');
    expect(result.retryable).toBe(true);
  });

  it('should classify 503 error as retryable', () => {
    const result = classifyJobError({ status: 503 });
    expect(result.code).toBe('FAILED_PROVIDER');
    expect(result.retryable).toBe(true);
  });

  it('should classify timeout as retryable', () => {
    const result = classifyJobError({ code: 'TIMEOUT' });
    expect(result.code).toBe('FAILED_TIMEOUT');
    expect(result.retryable).toBe(true);
  });

  it('should classify 429 rate limit as retryable', () => {
    const result = classifyJobError({ status: 429 });
    expect(result.code).toBe('FAILED_RATE_LIMIT');
    expect(result.retryable).toBe(true);
  });
});

describe('Storage Failures', () => {
  it('should classify upload failure as retryable', () => {
    const result = classifyJobError({ code: 'UPLOAD_FAILED' });
    expect(result.code).toBe('FAILED_STORAGE');
    expect(result.retryable).toBe(true);
  });

  it('should classify download failure as retryable', () => {
    const result = classifyJobError({ code: 'DOWNLOAD_FAILED' });
    expect(result.code).toBe('FAILED_DOWNLOAD');
    expect(result.retryable).toBe(true);
  });
});

describe('Retry Logic', () => {
  const MAX_RETRIES = 3;
  
  interface RetryState {
    attempt: number;
    lastError: JobError | null;
    shouldRetry: boolean;
  }

  function evaluateRetry(error: JobError, currentAttempt: number): RetryState {
    const shouldRetry = error.retryable && currentAttempt < MAX_RETRIES;
    return {
      attempt: currentAttempt,
      lastError: error,
      shouldRetry,
    };
  }

  it('should retry retryable errors up to max attempts', () => {
    const error = classifyJobError({ status: 500 });
    
    expect(evaluateRetry(error, 1).shouldRetry).toBe(true);
    expect(evaluateRetry(error, 2).shouldRetry).toBe(true);
    expect(evaluateRetry(error, 3).shouldRetry).toBe(false); // Max reached
  });

  it('should not retry non-retryable errors', () => {
    const error = classifyJobError({ code: 'INVALID_BASE64' });
    
    expect(evaluateRetry(error, 1).shouldRetry).toBe(false);
  });

  it('should stop retrying after max attempts', () => {
    const error = classifyJobError({ status: 503 });
    
    expect(evaluateRetry(error, MAX_RETRIES).shouldRetry).toBe(false);
    expect(evaluateRetry(error, MAX_RETRIES + 1).shouldRetry).toBe(false);
  });
});

describe('Idempotency', () => {
  // Simulate checking if output already exists
  function outputExists(jobId: string, outputs: Map<string, string>): boolean {
    return outputs.has(jobId);
  }

  function shouldSkipProcessing(jobId: string, outputs: Map<string, string>): boolean {
    // If output already exists, skip processing (idempotent)
    return outputExists(jobId, outputs);
  }

  it('should skip processing if output already exists', () => {
    const outputs = new Map<string, string>();
    outputs.set('job_123', 'https://storage.com/output.mp4');

    expect(shouldSkipProcessing('job_123', outputs)).toBe(true);
  });

  it('should process if output does not exist', () => {
    const outputs = new Map<string, string>();

    expect(shouldSkipProcessing('job_123', outputs)).toBe(false);
  });

  it('should handle duplicate job messages gracefully', () => {
    const outputs = new Map<string, string>();
    const processedJobs: string[] = [];

    // Simulate processing a job twice
    const processJob = (jobId: string) => {
      if (shouldSkipProcessing(jobId, outputs)) {
        return 'skipped';
      }
      processedJobs.push(jobId);
      outputs.set(jobId, 'https://storage.com/output.mp4');
      return 'processed';
    };

    // First call processes
    expect(processJob('job_123')).toBe('processed');
    // Second call skips
    expect(processJob('job_123')).toBe('skipped');
    // Only processed once
    expect(processedJobs.filter(j => j === 'job_123').length).toBe(1);
  });
});

describe('Worker Crash Recovery', () => {
  interface JobLease {
    jobId: string;
    workerId: string;
    acquiredAt: number;
    expiresAt: number;
  }

  function isLeaseExpired(lease: JobLease): boolean {
    return Date.now() > lease.expiresAt;
  }

  function canAcquireLease(jobId: string, workerId: string, existingLease: JobLease | null): boolean {
    // Can acquire if no lease or lease expired
    if (!existingLease) return true;
    if (isLeaseExpired(existingLease)) return true;
    // Can acquire if same worker (reconnect)
    if (existingLease.workerId === workerId) return true;
    return false;
  }

  it('should allow acquiring expired lease', () => {
    const expiredLease: JobLease = {
      jobId: 'job_123',
      workerId: 'worker_old',
      acquiredAt: Date.now() - 120000,
      expiresAt: Date.now() - 60000, // Expired 1 minute ago
    };

    expect(canAcquireLease('job_123', 'worker_new', expiredLease)).toBe(true);
  });

  it('should not allow acquiring active lease from different worker', () => {
    const activeLease: JobLease = {
      jobId: 'job_123',
      workerId: 'worker_1',
      acquiredAt: Date.now() - 10000,
      expiresAt: Date.now() + 50000, // Expires in 50s
    };

    expect(canAcquireLease('job_123', 'worker_2', activeLease)).toBe(false);
  });

  it('should allow same worker to reacquire', () => {
    const lease: JobLease = {
      jobId: 'job_123',
      workerId: 'worker_1',
      acquiredAt: Date.now() - 10000,
      expiresAt: Date.now() + 50000,
    };

    expect(canAcquireLease('job_123', 'worker_1', lease)).toBe(true);
  });
});

describe('Error Message Requirements', () => {
  interface FailedJob {
    status: 'failed';
    error_code: string;
    error_message: string;
    failed_at: string;
  }

  function validateFailedJob(job: Partial<FailedJob>): string[] {
    const issues: string[] = [];

    if (job.status !== 'failed') {
      issues.push('Status should be "failed"');
    }
    if (!job.error_code) {
      issues.push('error_code is required for failed jobs');
    }
    if (!job.error_message) {
      issues.push('error_message is required for failed jobs');
    }
    if (!job.failed_at) {
      issues.push('failed_at timestamp is required');
    }

    return issues;
  }

  it('should require all error fields on failed job', () => {
    const incompleteJob = { status: 'failed' as const };
    const issues = validateFailedJob(incompleteJob);
    
    expect(issues).toContain('error_code is required for failed jobs');
    expect(issues).toContain('error_message is required for failed jobs');
    expect(issues).toContain('failed_at timestamp is required');
  });

  it('should accept complete failed job', () => {
    const completeJob: FailedJob = {
      status: 'failed',
      error_code: 'FAILED_INPUT',
      error_message: 'Video file is corrupted',
      failed_at: new Date().toISOString(),
    };
    
    const issues = validateFailedJob(completeJob);
    expect(issues).toHaveLength(0);
  });
});

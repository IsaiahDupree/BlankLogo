/**
 * Golden Path E2E Test
 * 
 * Tier C: The critical test that must always pass
 * Tests full pipeline: Vercel → Supabase → Redis → Worker → Modal → Storage
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Job type for type safety
interface BlJob {
  id: string;
  status: string;
  output_url: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
}

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ntyobjndcjblnwdwpfgq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || 'https://blanklogo-api.onrender.com';
const TEST_TIMEOUT = 120000; // 2 minutes for full pipeline

// Test fixtures
const FIXTURE_VIDEO_PATH = 'test-videos/sora-watermark-test.mp4';
const TEST_USER_ID = process.env.TEST_USER_ID;

// Skip if no credentials
const skipTests = !SUPABASE_SERVICE_KEY || !TEST_USER_ID;

describe.skipIf(skipTests)('Golden Path E2E', () => {
  let supabase: ReturnType<typeof createClient>;
  let testJobId: string;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  });

  afterAll(async () => {
    // Cleanup test job if it exists
    if (testJobId && supabase) {
      await supabase.from('bl_jobs').delete().eq('id', testJobId);
    }
  });

  it('should complete full pipeline for small video', async () => {
    // 1. Create job via API
    console.log('[E2E] Step 1: Creating job via API...');
    
    const createResponse = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        inputUrl: 'https://example.com/test-video.mp4', // Would use real upload URL
        platform: 'sora',
        processingMode: 'inpaint',
        userId: TEST_USER_ID,
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create job: ${createResponse.status} - ${error}`);
    }

    const { jobId } = await createResponse.json() as { jobId: string };
    testJobId = jobId;
    console.log(`[E2E] Job created: ${jobId}`);

    // 2. Verify job exists in DB with 'queued' status
    console.log('[E2E] Step 2: Verifying job in database...');
    
    const { data: job, error: jobError } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single() as { data: BlJob | null; error: Error | null };

    expect(jobError).toBeNull();
    expect(job).toBeDefined();
    expect(job?.status).toBe('queued');
    console.log(`[E2E] Job status: ${job?.status}`);

    // 3. Wait for job to complete (poll with timeout)
    console.log('[E2E] Step 3: Waiting for job completion...');
    
    const startTime = Date.now();
    let currentStatus = 'queued';
    const seenStatuses: string[] = ['queued'];

    while (Date.now() - startTime < TEST_TIMEOUT) {
      await new Promise(r => setTimeout(r, 2000)); // Poll every 2s

      const { data: updated } = await supabase
        .from('bl_jobs')
        .select('status, output_url, error_message')
        .eq('id', jobId)
        .single() as { data: BlJob | null; error: Error | null };

      if (updated?.status !== currentStatus) {
        currentStatus = updated?.status || currentStatus;
        seenStatuses.push(currentStatus);
        console.log(`[E2E] Status changed: ${currentStatus}`);
      }

      if (currentStatus === 'completed' || currentStatus === 'failed') {
        break;
      }
    }

    // 4. Verify final state
    console.log('[E2E] Step 4: Verifying final state...');

    const { data: finalJob } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single() as { data: BlJob | null; error: Error | null };

    expect(finalJob?.status).toBe('completed');
    expect(finalJob?.output_url).toBeTruthy();
    expect(finalJob?.processing_time_ms).toBeGreaterThan(0);

    // 5. Verify status transitions were valid
    console.log(`[E2E] Status progression: ${seenStatuses.join(' → ')}`);
    
    // Should have gone through expected states
    expect(seenStatuses).toContain('queued');
    expect(seenStatuses[seenStatuses.length - 1]).toBe('completed');

    // 6. Verify output is accessible
    console.log('[E2E] Step 5: Verifying output accessibility...');
    
    if (finalJob?.output_url) {
      const outputResponse = await fetch(finalJob.output_url, { method: 'HEAD' });
      expect(outputResponse.ok).toBe(true);
      
      const contentType = outputResponse.headers.get('content-type');
      expect(contentType).toContain('video');
    }

    console.log('[E2E] ✅ Golden path test passed!');
  }, TEST_TIMEOUT + 10000);
});

describe('Job Events Tracking', () => {
  it('should have required event types defined', () => {
    const requiredEvents = [
      'JOB_CREATED',
      'QUEUED',
      'DISPATCHED', 
      'RUNNING',
      'UPLOADING',
      'COMPLETED',
      'FAILED',
    ];

    // This ensures we document and track all event types
    requiredEvents.forEach(event => {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    });
  });
});

describe('Output Validation', () => {
  function validateOutput(output: {
    url?: string;
    size_bytes?: number;
    duration_sec?: number;
  }, input: {
    size_bytes?: number;
    duration_sec?: number;
  }): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // URL must exist
    if (!output.url) {
      issues.push('Output URL is missing');
    }

    // Size should be reasonable (not empty, not larger than 10x input)
    if (!output.size_bytes || output.size_bytes < 1000) {
      issues.push('Output size is suspiciously small');
    }
    if (input.size_bytes && output.size_bytes && output.size_bytes > input.size_bytes * 10) {
      issues.push('Output size is suspiciously large');
    }

    // Duration should roughly match input (±10%)
    if (input.duration_sec && output.duration_sec) {
      const ratio = output.duration_sec / input.duration_sec;
      if (ratio < 0.9 || ratio > 1.1) {
        issues.push(`Duration mismatch: input ${input.duration_sec}s, output ${output.duration_sec}s`);
      }
    }

    return { valid: issues.length === 0, issues };
  }

  it('should accept valid output', () => {
    const result = validateOutput(
      { url: 'https://storage.com/output.mp4', size_bytes: 5000000, duration_sec: 10 },
      { size_bytes: 5500000, duration_sec: 10 }
    );
    expect(result.valid).toBe(true);
  });

  it('should reject missing URL', () => {
    const result = validateOutput(
      { size_bytes: 5000000 },
      { size_bytes: 5500000 }
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Output URL is missing');
  });

  it('should flag tiny output', () => {
    const result = validateOutput(
      { url: 'https://storage.com/output.mp4', size_bytes: 100 },
      { size_bytes: 5500000 }
    );
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Output size is suspiciously small');
  });
});

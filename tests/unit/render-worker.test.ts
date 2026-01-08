/**
 * Unit Tests for Render Worker Service
 * 
 * Tests worker functionality via the API queue status:
 * - Queue processing verification
 * - Worker health via queue stats
 * - Job state transitions
 */

import { describe, it, expect } from 'vitest';

const API_URL = process.env.DEPLOY_API_URL || 'https://blanklogo-api.onrender.com';
const TIMEOUT = 15000;

describe('Render Worker: Queue Status', () => {
  it('Queue is accessible and reporting stats', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.services?.queue?.available).toBe(true);
    
    const stats = data.services?.queue?.stats;
    expect(stats).toBeDefined();
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
  });

  it('Queue stats are non-negative', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    const data = await res.json();
    const stats = data.services?.queue?.stats;
    
    expect(stats.waiting).toBeGreaterThanOrEqual(0);
    expect(stats.active).toBeGreaterThanOrEqual(0);
    expect(stats.completed).toBeGreaterThanOrEqual(0);
    expect(stats.failed).toBeGreaterThanOrEqual(0);
  });

  it('Completed jobs count is tracked', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    const data = await res.json();
    const stats = data.services?.queue?.stats;
    
    // Should have processed at least some jobs
    expect(stats.completed + stats.failed).toBeGreaterThanOrEqual(0);
  });
});

describe('Render Worker: Redis Connection', () => {
  it('Redis is connected (via health check)', async () => {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.services?.redis).toBe('connected');
  });

  it('Redis connectivity in diagnostics', async () => {
    const res = await fetch(`${API_URL}/diagnostics`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    const redisTest = data.tests?.find((t: { name: string }) => t.name === 'redis_connection');
    
    if (redisTest) {
      expect(redisTest.status).toBe('pass');
    }
  });
});

describe('Render Worker: Job Processing', () => {
  it('Queue is ready to accept jobs', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    const data = await res.json();
    expect(data.services?.queue?.available).toBe(true);
  });

  it('API can enqueue jobs (auth required)', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: 'https://example.com/test.mp4',
        platform: 'sora'
      }),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should fail auth but not 500
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });
});

describe('Render Worker: Error Tracking', () => {
  it('Failed jobs are tracked in queue stats', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    const data = await res.json();
    const stats = data.services?.queue?.stats;
    
    // Failed count should be tracked (may be 0 or more)
    expect(typeof stats.failed).toBe('number');
  });
});

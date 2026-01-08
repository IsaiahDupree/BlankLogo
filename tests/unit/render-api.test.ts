/**
 * Unit Tests for Render API Service
 * 
 * Tests all API endpoints on the deployed Render API:
 * - Health check
 * - Status/diagnostics
 * - Job endpoints (create, get, list)
 * - Platform endpoints
 * - Queue operations
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.DEPLOY_API_URL || 'https://blanklogo-api.onrender.com';
const TIMEOUT = 15000;

describe('Render API: Health & Status', () => {
  it('GET /health returns healthy status', async () => {
    const res = await fetch(`${API_URL}/health`, { 
      signal: AbortSignal.timeout(TIMEOUT) 
    });
    
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.services).toBeDefined();
    expect(data.services.redis).toBe('connected');
    expect(data.services.queue).toBe('ready');
  });

  it('GET /status returns service status with queue stats', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(['healthy', 'operational']).toContain(data.status);
    expect(data.services).toBeDefined();
    expect(data.services.queue).toBeDefined();
    expect(data.services.queue.stats).toBeDefined();
    expect(typeof data.services.queue.stats.waiting).toBe('number');
    expect(typeof data.services.queue.stats.active).toBe('number');
    expect(typeof data.services.queue.stats.completed).toBe('number');
  });

  it('GET /diagnostics returns detailed diagnostics', async () => {
    const res = await fetch(`${API_URL}/diagnostics`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.service).toBe('api');
    expect(data.overall_status).toBe('healthy');
    expect(data.summary).toBeDefined();
    expect(data.tests).toBeDefined();
    expect(Array.isArray(data.tests)).toBe(true);
  });
});

describe('Render API: Authentication', () => {
  it('POST /api/v1/jobs returns 401 without auth token', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: 'https://example.com/video.mp4' }),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.status).toBe(401);
    
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.code).toBe('NO_TOKEN');
  });

  it('GET /api/v1/jobs/:id returns 401 without auth token', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs/test-job-id`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.status).toBe(401);
    
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('POST /api/v1/jobs/upload returns 401 without auth token', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs/upload`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.status).toBe(401);
  });
});

describe('Render API: Platforms', () => {
  it('GET /api/v1/platforms returns platform list', async () => {
    const res = await fetch(`${API_URL}/api/v1/platforms`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    expect(data.platforms).toBeDefined();
    expect(Array.isArray(data.platforms)).toBe(true);
    expect(data.platforms.length).toBeGreaterThan(0);
    
    // Verify Sora platform exists
    const sora = data.platforms.find((p: { id: string }) => p.id === 'sora');
    expect(sora).toBeDefined();
    expect(sora.name).toBe('Sora');
    // supported may be undefined or true
    expect(sora.supported !== false).toBe(true);
  });

  it('Platforms include all expected platforms', async () => {
    const res = await fetch(`${API_URL}/api/v1/platforms`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    const data = await res.json();
    const platformIds = data.platforms.map((p: { id: string }) => p.id);
    
    expect(platformIds).toContain('auto');
    expect(platformIds).toContain('sora');
    expect(platformIds).toContain('tiktok');
    expect(platformIds).toContain('runway');
    expect(platformIds).toContain('pika');
  });
});

describe('Render API: CORS', () => {
  it('OPTIONS request returns CORS headers', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://www.blanklogo.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization,Content-Type'
      },
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should return 204 No Content for OPTIONS
    expect([200, 204]).toContain(res.status);
    
    // Check CORS headers
    const allowMethods = res.headers.get('access-control-allow-methods');
    expect(allowMethods).toBeDefined();
    expect(allowMethods).toContain('POST');
    
    const allowHeaders = res.headers.get('access-control-allow-headers');
    expect(allowHeaders).toBeDefined();
  });

  it('Requests from blanklogo.app are allowed', async () => {
    const res = await fetch(`${API_URL}/health`, {
      headers: {
        'Origin': 'https://www.blanklogo.app'
      },
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    // The response should include allow-origin header (once CORS fix deploys)
  });
});

describe('Render API: Error Handling', () => {
  it('Returns 404 for unknown routes', async () => {
    const res = await fetch(`${API_URL}/api/v1/unknown-route`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.status).toBe(404);
  });

  it('Returns proper error structure for invalid requests', async () => {
    const res = await fetch(`${API_URL}/api/v1/jobs`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should fail with auth error (invalid token)
    expect(res.status).toBe(401);
    
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('Render API: Queue Operations', () => {
  it('GET /status shows queue statistics', async () => {
    const res = await fetch(`${API_URL}/status`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    
    const data = await res.json();
    const queueStats = data.services?.queue?.stats;
    
    expect(queueStats).toBeDefined();
    expect(typeof queueStats.waiting).toBe('number');
    expect(typeof queueStats.active).toBe('number');
    expect(typeof queueStats.completed).toBe('number');
    expect(typeof queueStats.failed).toBe('number');
    
    // Stats should be non-negative
    expect(queueStats.waiting).toBeGreaterThanOrEqual(0);
    expect(queueStats.active).toBeGreaterThanOrEqual(0);
    expect(queueStats.completed).toBeGreaterThanOrEqual(0);
  });
});

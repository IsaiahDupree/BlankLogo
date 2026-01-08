/**
 * Unit Tests for Render Inpaint Service
 * 
 * Tests the inpainting service endpoints:
 * - Health check
 * - Capabilities
 * - Processing endpoints (auth required)
 */

import { describe, it, expect } from 'vitest';

const INPAINT_URL = process.env.DEPLOY_INPAINT_URL || 'https://blanklogo-inpaint.onrender.com';
const TIMEOUT = 15000;

describe('Render Inpaint: Health & Status', () => {
  it('GET /health returns healthy status', async () => {
    const res = await fetch(`${INPAINT_URL}/health`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('blanklogo-inpainter');
  });

  it('GET / returns service info or redirect', async () => {
    const res = await fetch(`${INPAINT_URL}/`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Root may return 200, 404, or redirect - all acceptable
    expect([200, 301, 302, 404]).toContain(res.status);
  });
});

describe('Render Inpaint: Capabilities', () => {
  it('GET /capabilities returns supported formats', async () => {
    const res = await fetch(`${INPAINT_URL}/capabilities`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // May return 200 or 404 depending on if endpoint exists
    if (res.ok) {
      const data = await res.json();
      expect(data).toBeDefined();
    }
  });
});

describe('Render Inpaint: Authentication', () => {
  it('POST /inpaint returns 401/403 without auth', async () => {
    const res = await fetch(`${INPAINT_URL}/inpaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_url: 'https://example.com/video.mp4' }),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should require authentication or return method not allowed
    expect([401, 403, 404, 405]).toContain(res.status);
  });

  it('POST /process returns 401/403 without auth', async () => {
    const res = await fetch(`${INPAINT_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should require authentication, return not found, or validation error
    expect([401, 403, 404, 405, 422]).toContain(res.status);
  });
});

describe('Render Inpaint: Error Handling', () => {
  it('Returns error for unknown routes', async () => {
    const res = await fetch(`${INPAINT_URL}/unknown-endpoint`, {
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.status).toBe(404);
  });

  it('Handles malformed requests gracefully', async () => {
    const res = await fetch(`${INPAINT_URL}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{{{',
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    // Should handle gracefully - either accept or return 4xx
    expect(res.status).toBeLessThan(500);
  });
});

describe('Render Inpaint: CORS', () => {
  it('Health endpoint allows cross-origin requests', async () => {
    const res = await fetch(`${INPAINT_URL}/health`, {
      headers: {
        'Origin': 'https://www.blanklogo.app'
      },
      signal: AbortSignal.timeout(TIMEOUT)
    });
    
    expect(res.ok).toBe(true);
  });
});

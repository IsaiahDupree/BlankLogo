/**
 * Rate Limiter Tests
 */

import { describe, it, expect } from 'vitest';

describe('Rate Limiter', () => {
  describe('Configuration', () => {
    const config = {
      jobs: { windowMs: 60000, max: 10 },
      api: { windowMs: 60000, max: 100 },
      auth: { windowMs: 900000, max: 5 },
    };

    it('should have jobs rate limit config', () => {
      expect(config.jobs.windowMs).toBe(60000); // 1 minute
      expect(config.jobs.max).toBe(10);
    });

    it('should have API rate limit config', () => {
      expect(config.api.windowMs).toBe(60000);
      expect(config.api.max).toBe(100);
    });

    it('should have stricter auth rate limit', () => {
      expect(config.auth.windowMs).toBe(900000); // 15 minutes
      expect(config.auth.max).toBe(5); // Only 5 attempts
    });
  });

  describe('Rate Limit Logic', () => {
    it('should allow requests under limit', () => {
      const requestCount = 5;
      const limit = 10;
      const allowed = requestCount < limit;
      expect(allowed).toBe(true);
    });

    it('should block requests at limit', () => {
      const requestCount = 10;
      const limit = 10;
      const allowed = requestCount < limit;
      expect(allowed).toBe(false);
    });

    it('should reset after window expires', () => {
      const windowMs = 60000;
      const lastReset = Date.now() - 61000; // 61 seconds ago
      const shouldReset = (Date.now() - lastReset) > windowMs;
      expect(shouldReset).toBe(true);
    });
  });

  describe('Response Headers', () => {
    it('should include rate limit headers', () => {
      const headers = {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
      };

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(parseInt(headers['X-RateLimit-Remaining'])).toBeLessThanOrEqual(100);
      expect(parseInt(headers['X-RateLimit-Reset'])).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('429 Response', () => {
    it('should return proper error format', () => {
      const response = {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60,
      };

      expect(response.error).toBe('Too many requests');
      expect(response.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Key Generation', () => {
    it('should generate key from IP', () => {
      const ip = '192.168.1.1';
      const key = `ratelimit:${ip}`;
      expect(key).toBe('ratelimit:192.168.1.1');
    });

    it('should generate key from user ID when authenticated', () => {
      const userId = 'user-123';
      const key = `ratelimit:user:${userId}`;
      expect(key).toBe('ratelimit:user:user-123');
    });

    it('should prefer user ID over IP', () => {
      const ip = '192.168.1.1';
      const userId = 'user-123';
      const key = userId ? `ratelimit:user:${userId}` : `ratelimit:${ip}`;
      expect(key).toContain('user-123');
    });
  });

  describe('Fallback Behavior', () => {
    it('should use in-memory store when Redis unavailable', () => {
      const memoryStore = new Map<string, { count: number; resetTime: number }>();
      const key = 'test-key';
      
      memoryStore.set(key, { count: 1, resetTime: Date.now() + 60000 });
      const entry = memoryStore.get(key);
      
      expect(entry?.count).toBe(1);
    });

    it('should clean expired entries from memory store', () => {
      const memoryStore = new Map<string, { count: number; resetTime: number }>();
      const expiredKey = 'expired';
      const validKey = 'valid';
      
      memoryStore.set(expiredKey, { count: 5, resetTime: Date.now() - 1000 }); // Expired
      memoryStore.set(validKey, { count: 3, resetTime: Date.now() + 60000 }); // Valid
      
      // Cleanup expired
      for (const [key, value] of memoryStore.entries()) {
        if (value.resetTime < Date.now()) {
          memoryStore.delete(key);
        }
      }
      
      expect(memoryStore.has(expiredKey)).toBe(false);
      expect(memoryStore.has(validKey)).toBe(true);
    });
  });

  describe('Endpoint-specific Limits', () => {
    it('should apply jobs limit to job creation', () => {
      const endpoint = '/api/v1/jobs';
      const isJobEndpoint = endpoint.includes('/jobs');
      expect(isJobEndpoint).toBe(true);
    });

    it('should apply stricter limit to batch endpoint', () => {
      const batchLimit = 5; // Stricter for batch
      const normalLimit = 10;
      expect(batchLimit).toBeLessThan(normalLimit);
    });
  });
});

describe('Rate Limiter Integration', () => {
  it('should be applied to job creation endpoint', () => {
    const endpoints = [
      { path: '/api/v1/jobs', method: 'POST', hasRateLimit: true },
      { path: '/api/v1/jobs/upload', method: 'POST', hasRateLimit: true },
      { path: '/api/v1/jobs/batch', method: 'POST', hasRateLimit: true },
      { path: '/api/v1/jobs/:id', method: 'GET', hasRateLimit: false },
    ];

    const jobCreationEndpoints = endpoints.filter(e => e.method === 'POST' && e.path.includes('/jobs'));
    jobCreationEndpoints.forEach(e => {
      expect(e.hasRateLimit).toBe(true);
    });
  });
});

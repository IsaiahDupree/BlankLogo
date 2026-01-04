/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse and brute force attacks
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.on('error', () => {}); // Silently handle Redis errors
} catch {
  console.log('[RateLimiter] Redis not available, using in-memory fallback');
}

// In-memory fallback for rate limiting
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  max: number;           // Max requests per window
  message?: string;      // Custom error message
  keyPrefix?: string;    // Redis key prefix
}

// Preset configurations
export const rateLimitPresets = {
  // Strict rate limit for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                    // 5 attempts per 15 min
    message: 'Too many login attempts. Please try again in 15 minutes.',
    keyPrefix: 'rl:auth',
  },
  
  // Standard API rate limit
  api: {
    windowMs: 60 * 1000,      // 1 minute
    max: 60,                   // 60 requests per minute
    message: 'Too many requests. Please slow down.',
    keyPrefix: 'rl:api',
  },
  
  // Strict limit for job creation
  jobs: {
    windowMs: 60 * 1000,      // 1 minute
    max: 10,                   // 10 jobs per minute
    message: 'Too many job requests. Please wait before submitting more.',
    keyPrefix: 'rl:jobs',
  },
  
  // Very strict for password reset
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,                    // 3 attempts per hour
    message: 'Too many password reset attempts. Please try again later.',
    keyPrefix: 'rl:pwreset',
  },
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: Request): string {
  // Use user ID if authenticated, otherwise use IP
  const userId = (req as any).user?.id;
  if (userId) return `user:${userId}`;
  
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.ip || req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check rate limit using Redis or in-memory store
 */
async function checkRateLimit(
  key: string, 
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  if (redis) {
    try {
      // Use Redis sorted set for sliding window
      const multi = redis.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, Math.ceil(config.windowMs / 1000));
      
      const results = await multi.exec();
      const count = results?.[2]?.[1] as number || 0;
      
      return {
        allowed: count <= config.max,
        remaining: Math.max(0, config.max - count),
        resetAt: now + config.windowMs,
      };
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const entry = inMemoryStore.get(key);
  
  if (!entry || entry.resetAt < now) {
    inMemoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }
  
  entry.count++;
  return {
    allowed: entry.count <= config.max,
    remaining: Math.max(0, config.max - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientId(req);
    const key = `${config.keyPrefix || 'rl'}:${clientId}`;
    
    const { allowed, remaining, resetAt } = await checkRateLimit(key, config);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
    
    if (!allowed) {
      console.log(`[RateLimiter] Rate limit exceeded for ${clientId} on ${req.path}`);
      return res.status(429).json({
        error: config.message || 'Too many requests',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      });
    }
    
    next();
  };
}

// Pre-configured middleware
export const authRateLimiter = createRateLimiter(rateLimitPresets.auth);
export const apiRateLimiter = createRateLimiter(rateLimitPresets.api);
export const jobsRateLimiter = createRateLimiter(rateLimitPresets.jobs);
export const passwordResetRateLimiter = createRateLimiter(rateLimitPresets.passwordReset);

export default createRateLimiter;

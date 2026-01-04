/**
 * Usage Limits and Quotas Middleware
 * Enforces daily/monthly limits based on user plan
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    dailyJobs: 3,
    monthlyJobs: 30,
    maxFileSizeMB: 100,
    maxVideoDurationSec: 60,
    concurrentJobs: 1,
    features: ['crop'],
  },
  starter: {
    dailyJobs: 20,
    monthlyJobs: 200,
    maxFileSizeMB: 250,
    maxVideoDurationSec: 180,
    concurrentJobs: 3,
    features: ['crop', 'inpaint'],
  },
  pro: {
    dailyJobs: 100,
    monthlyJobs: 1000,
    maxFileSizeMB: 500,
    maxVideoDurationSec: 600,
    concurrentJobs: 10,
    features: ['crop', 'inpaint', 'auto', 'batch', 'api'],
  },
  enterprise: {
    dailyJobs: -1, // unlimited
    monthlyJobs: -1,
    maxFileSizeMB: 1000,
    maxVideoDurationSec: -1,
    concurrentJobs: -1,
    features: ['crop', 'inpaint', 'auto', 'batch', 'api', 'webhook', 'priority'],
  },
};

type PlanType = keyof typeof PLAN_LIMITS;

interface UsageData {
  dailyCount: number;
  monthlyCount: number;
  concurrentCount: number;
  lastReset: string;
}

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; plan?: PlanType };
  usageLimits?: {
    plan: PlanType;
    limits: typeof PLAN_LIMITS.free;
    usage: UsageData;
    remaining: {
      daily: number;
      monthly: number;
      concurrent: number;
    };
  };
}

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.on('error', () => {});
} catch {
  console.log('[UsageLimits] Redis not available');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get user's current plan
 */
async function getUserPlan(userId: string): Promise<PlanType> {
  try {
    const { data } = await supabase
      .from('bl_profiles')
      .select('plan')
      .eq('id', userId)
      .single();
    
    return (data?.plan as PlanType) || 'free';
  } catch {
    return 'free';
  }
}

/**
 * Get usage data from Redis or database
 */
async function getUsageData(userId: string): Promise<UsageData> {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);
  
  const defaultUsage: UsageData = {
    dailyCount: 0,
    monthlyCount: 0,
    concurrentCount: 0,
    lastReset: today,
  };

  if (redis) {
    try {
      const [daily, monthly, concurrent] = await Promise.all([
        redis.get(`usage:daily:${userId}:${today}`),
        redis.get(`usage:monthly:${userId}:${month}`),
        redis.get(`usage:concurrent:${userId}`),
      ]);

      return {
        dailyCount: parseInt(daily || '0', 10),
        monthlyCount: parseInt(monthly || '0', 10),
        concurrentCount: parseInt(concurrent || '0', 10),
        lastReset: today,
      };
    } catch {
      // Fall through to database
    }
  }

  // Fallback: count from database
  try {
    const startOfDay = new Date(today).toISOString();
    const startOfMonth = new Date(`${month}-01`).toISOString();

    const [{ count: dailyCount }, { count: monthlyCount }, { count: concurrentCount }] = await Promise.all([
      supabase
        .from('bl_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDay),
      supabase
        .from('bl_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth),
      supabase
        .from('bl_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['queued', 'processing']),
    ]);

    return {
      dailyCount: dailyCount || 0,
      monthlyCount: monthlyCount || 0,
      concurrentCount: concurrentCount || 0,
      lastReset: today,
    };
  } catch {
    return defaultUsage;
  }
}

/**
 * Increment usage counters
 */
export async function incrementUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);

  if (redis) {
    try {
      const dailyKey = `usage:daily:${userId}:${today}`;
      const monthlyKey = `usage:monthly:${userId}:${month}`;
      const concurrentKey = `usage:concurrent:${userId}`;

      await Promise.all([
        redis.incr(dailyKey),
        redis.expire(dailyKey, 86400), // 24 hours
        redis.incr(monthlyKey),
        redis.expire(monthlyKey, 2678400), // 31 days
        redis.incr(concurrentKey),
      ]);
    } catch (err) {
      console.error('[UsageLimits] Failed to increment usage:', err);
    }
  }
}

/**
 * Decrement concurrent job counter
 */
export async function decrementConcurrent(userId: string): Promise<void> {
  if (redis) {
    try {
      const key = `usage:concurrent:${userId}`;
      await redis.decr(key);
    } catch (err) {
      console.error('[UsageLimits] Failed to decrement concurrent:', err);
    }
  }
}

/**
 * Middleware to check and enforce usage limits
 */
export function checkUsageLimits() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const plan = await getUserPlan(userId);
      const limits = PLAN_LIMITS[plan];
      const usage = await getUsageData(userId);

      // Check daily limit
      if (limits.dailyJobs !== -1 && usage.dailyCount >= limits.dailyJobs) {
        return res.status(429).json({
          error: 'Daily limit reached',
          message: `You've reached your daily limit of ${limits.dailyJobs} jobs. Upgrade your plan for more.`,
          limit: limits.dailyJobs,
          used: usage.dailyCount,
          resetsAt: getNextDayReset(),
        });
      }

      // Check monthly limit
      if (limits.monthlyJobs !== -1 && usage.monthlyCount >= limits.monthlyJobs) {
        return res.status(429).json({
          error: 'Monthly limit reached',
          message: `You've reached your monthly limit of ${limits.monthlyJobs} jobs. Upgrade your plan for more.`,
          limit: limits.monthlyJobs,
          used: usage.monthlyCount,
          resetsAt: getNextMonthReset(),
        });
      }

      // Check concurrent limit
      if (limits.concurrentJobs !== -1 && usage.concurrentCount >= limits.concurrentJobs) {
        return res.status(429).json({
          error: 'Concurrent limit reached',
          message: `You have ${limits.concurrentJobs} jobs currently processing. Please wait for them to complete.`,
          limit: limits.concurrentJobs,
          current: usage.concurrentCount,
        });
      }

      // Attach limits info to request
      req.usageLimits = {
        plan,
        limits,
        usage,
        remaining: {
          daily: limits.dailyJobs === -1 ? -1 : limits.dailyJobs - usage.dailyCount,
          monthly: limits.monthlyJobs === -1 ? -1 : limits.monthlyJobs - usage.monthlyCount,
          concurrent: limits.concurrentJobs === -1 ? -1 : limits.concurrentJobs - usage.concurrentCount,
        },
      };

      next();
    } catch (err) {
      console.error('[UsageLimits] Error checking limits:', err);
      // Allow request to proceed on error (fail open)
      next();
    }
  };
}

/**
 * Middleware to check feature access
 */
export function requireFeature(feature: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plan = await getUserPlan(userId);
    const limits = PLAN_LIMITS[plan];

    if (!limits.features.includes(feature)) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `The "${feature}" feature requires a higher plan.`,
        currentPlan: plan,
        requiredFeature: feature,
      });
    }

    next();
  };
}

function getNextDayReset(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function getNextMonthReset(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.toISOString();
}

export default checkUsageLimits;

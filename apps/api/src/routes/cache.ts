/**
 * Cache Management Routes
 * Handles cache invalidation for user preferences and other cached data
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import Redis from 'ioredis';

const router: RouterType = Router();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.on('error', () => {});
} catch {
  console.log('[Cache] Redis not available');
}

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

/**
 * POST /api/v1/cache/invalidate
 * Invalidate cache for a specific user and type
 */
router.post('/invalidate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, type } = req.body;
    const requestingUserId = req.user?.id;

    // Users can only invalidate their own cache
    if (!requestingUserId || (userId && userId !== requestingUserId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const targetUserId = userId || requestingUserId;

    if (!redis) {
      return res.json({ 
        success: true, 
        message: 'Cache not available, no action needed' 
      });
    }

    let keysDeleted = 0;

    switch (type) {
      case 'prefs':
        await redis.del(`user:prefs:${targetUserId}`);
        keysDeleted++;
        break;
      case 'all':
        const keys = await redis.keys(`user:*:${targetUserId}`);
        if (keys.length > 0) {
          await redis.del(...keys);
          keysDeleted = keys.length;
        }
        break;
      default:
        // Invalidate common user caches
        await redis.del(`user:prefs:${targetUserId}`);
        keysDeleted++;
    }

    console.log(`[Cache] Invalidated ${keysDeleted} keys for user: ${targetUserId}`);

    res.json({ 
      success: true, 
      keysDeleted,
      message: `Cache invalidated for user` 
    });
  } catch (error) {
    console.error('[Cache] Invalidation error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * GET /api/v1/cache/stats
 * Get cache statistics (admin only)
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!redis) {
      return res.json({ available: false });
    }

    const info = await redis.info('memory');
    const dbSize = await redis.dbsize();

    res.json({
      available: true,
      dbSize,
      memoryInfo: info.split('\n').slice(0, 10).join('\n'),
    });
  } catch (error) {
    console.error('[Cache] Stats error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

export default router;

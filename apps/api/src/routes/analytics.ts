/**
 * Analytics API Routes
 * Provides job statistics, usage metrics, and monitoring data
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { createClient } from '@supabase/supabase-js';

const router: RouterType = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

/**
 * GET /api/v1/analytics/overview
 * Get user's job statistics overview
 */
router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get job counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('bl_jobs')
      .select('status')
      .eq('user_id', userId);

    if (statusError) {
      console.error('[Analytics] Status count error:', statusError);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    const stats = {
      total: statusCounts?.length || 0,
      completed: statusCounts?.filter(j => j.status === 'completed').length || 0,
      failed: statusCounts?.filter(j => j.status === 'failed').length || 0,
      processing: statusCounts?.filter(j => j.status === 'processing').length || 0,
      queued: statusCounts?.filter(j => j.status === 'queued').length || 0,
    };

    // Get credit balance
    const { data: balance } = await supabase.rpc('bl_get_credit_balance', {
      p_user_id: userId,
    });

    // Get total credits used (from completed jobs)
    const { data: creditUsage } = await supabase
      .from('bl_jobs')
      .select('credits_charged')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const totalCreditsUsed = creditUsage?.reduce((sum, j) => sum + (j.credits_charged || 0), 0) || 0;

    res.json({
      jobs: stats,
      credits: {
        balance: balance || 0,
        totalUsed: totalCreditsUsed,
      },
      successRate: stats.total > 0 
        ? Math.round((stats.completed / stats.total) * 100) 
        : 0,
    });
  } catch (error) {
    console.error('[Analytics] Overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/analytics/jobs
 * Get paginated job history with filtering
 */
router.get('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      status, 
      platform, 
      limit = '20', 
      offset = '0',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    let query = supabase
      .from('bl_jobs')
      .select('id, status, platform, input_url, output_url, created_at, completed_at, error_message, credits_charged, processing_mode')
      .eq('user_id', userId)
      .order(sortBy as string, { ascending: sortOrder === 'asc' })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('[Analytics] Jobs fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch jobs' });
    }

    // Get total count
    const { count: totalCount } = await supabase
      .from('bl_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.json({
      jobs: jobs || [],
      pagination: {
        total: totalCount || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: (parseInt(offset as string) + (jobs?.length || 0)) < (totalCount || 0),
      },
    });
  } catch (error) {
    console.error('[Analytics] Jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/analytics/usage
 * Get usage statistics over time
 */
router.get('/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { period = '30d' } = req.query;
    
    // Calculate date range
    const days = parseInt(period as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: jobs, error } = await supabase
      .from('bl_jobs')
      .select('created_at, status, credits_charged, platform')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('[Analytics] Usage fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch usage data' });
    }

    // Group by day
    const dailyStats: Record<string, { jobs: number; credits: number; completed: number; failed: number }> = {};
    
    jobs?.forEach(job => {
      const date = new Date(job.created_at).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { jobs: 0, credits: 0, completed: 0, failed: 0 };
      }
      dailyStats[date].jobs++;
      dailyStats[date].credits += job.credits_charged || 0;
      if (job.status === 'completed') dailyStats[date].completed++;
      if (job.status === 'failed') dailyStats[date].failed++;
    });

    // Platform breakdown
    const platformBreakdown: Record<string, number> = {};
    jobs?.forEach(job => {
      const platform = job.platform || 'unknown';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });

    res.json({
      period: `${days}d`,
      daily: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      platforms: platformBreakdown,
      totals: {
        jobs: jobs?.length || 0,
        credits: jobs?.reduce((sum, j) => sum + (j.credits_charged || 0), 0) || 0,
        completed: jobs?.filter(j => j.status === 'completed').length || 0,
        failed: jobs?.filter(j => j.status === 'failed').length || 0,
      },
    });
  } catch (error) {
    console.error('[Analytics] Usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/analytics/platforms
 * Get platform-specific statistics
 */
router.get('/platforms', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: jobs, error } = await supabase
      .from('bl_jobs')
      .select('platform, status, credits_charged, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('[Analytics] Platforms fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch platform data' });
    }

    // Group by platform
    const platformStats: Record<string, {
      total: number;
      completed: number;
      failed: number;
      credits: number;
      lastUsed: string | null;
    }> = {};

    jobs?.forEach(job => {
      const platform = job.platform || 'unknown';
      if (!platformStats[platform]) {
        platformStats[platform] = {
          total: 0,
          completed: 0,
          failed: 0,
          credits: 0,
          lastUsed: null,
        };
      }
      
      platformStats[platform].total++;
      platformStats[platform].credits += job.credits_charged || 0;
      
      if (job.status === 'completed') platformStats[platform].completed++;
      if (job.status === 'failed') platformStats[platform].failed++;
      
      if (!platformStats[platform].lastUsed || job.created_at > platformStats[platform].lastUsed!) {
        platformStats[platform].lastUsed = job.created_at;
      }
    });

    res.json({
      platforms: Object.entries(platformStats).map(([name, stats]) => ({
        name,
        ...stats,
        successRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error('[Analytics] Platforms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

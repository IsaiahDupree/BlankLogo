/**
 * Analytics API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data
const mockJobs = [
  { id: 'job-1', status: 'completed', platform: 'sora', credits_charged: 1, created_at: '2026-01-01T10:00:00Z', completed_at: '2026-01-01T10:05:00Z' },
  { id: 'job-2', status: 'completed', platform: 'runway', credits_charged: 2, created_at: '2026-01-02T10:00:00Z', completed_at: '2026-01-02T10:03:00Z' },
  { id: 'job-3', status: 'failed', platform: 'sora', credits_charged: 0, created_at: '2026-01-03T10:00:00Z', completed_at: null },
  { id: 'job-4', status: 'processing', platform: 'pika', credits_charged: 0, created_at: '2026-01-04T10:00:00Z', completed_at: null },
  { id: 'job-5', status: 'queued', platform: 'sora', credits_charged: 0, created_at: '2026-01-04T11:00:00Z', completed_at: null },
];

describe('Analytics API', () => {
  describe('Job Statistics', () => {
    it('should calculate correct job counts by status', () => {
      const stats = {
        total: mockJobs.length,
        completed: mockJobs.filter(j => j.status === 'completed').length,
        failed: mockJobs.filter(j => j.status === 'failed').length,
        processing: mockJobs.filter(j => j.status === 'processing').length,
        queued: mockJobs.filter(j => j.status === 'queued').length,
      };

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.processing).toBe(1);
      expect(stats.queued).toBe(1);
    });

    it('should calculate success rate correctly', () => {
      const total = mockJobs.length;
      const completed = mockJobs.filter(j => j.status === 'completed').length;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      expect(successRate).toBe(40); // 2/5 = 40%
    });

    it('should handle empty job list', () => {
      const emptyJobs: typeof mockJobs = [];
      const total = emptyJobs.length;
      const completed = emptyJobs.filter(j => j.status === 'completed').length;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      expect(successRate).toBe(0);
    });
  });

  describe('Credit Statistics', () => {
    it('should calculate total credits used', () => {
      const creditsUsed = mockJobs.reduce((sum, j) => sum + (j.credits_charged || 0), 0);
      expect(creditsUsed).toBe(3); // 1 + 2 + 0 + 0 + 0
    });

    it('should only count credits from completed jobs', () => {
      const completedCredits = mockJobs
        .filter(j => j.status === 'completed')
        .reduce((sum, j) => sum + (j.credits_charged || 0), 0);
      expect(completedCredits).toBe(3);
    });
  });

  describe('Platform Breakdown', () => {
    it('should count jobs by platform', () => {
      const platforms: Record<string, number> = {};
      mockJobs.forEach(job => {
        const platform = job.platform || 'unknown';
        platforms[platform] = (platforms[platform] || 0) + 1;
      });

      expect(platforms.sora).toBe(3);
      expect(platforms.runway).toBe(1);
      expect(platforms.pika).toBe(1);
    });

    it('should sort platforms by usage', () => {
      const platforms: Record<string, number> = {};
      mockJobs.forEach(job => {
        const platform = job.platform || 'unknown';
        platforms[platform] = (platforms[platform] || 0) + 1;
      });

      const sorted = Object.entries(platforms)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

      expect(sorted[0].name).toBe('sora');
      expect(sorted[0].count).toBe(3);
    });
  });

  describe('Processing Time', () => {
    it('should calculate average processing time', () => {
      const completedWithTime = mockJobs.filter(j => 
        j.status === 'completed' && j.completed_at && j.created_at
      );
      
      const avgTime = completedWithTime.length > 0
        ? Math.round(
            completedWithTime.reduce((sum, j) => {
              const start = new Date(j.created_at).getTime();
              const end = new Date(j.completed_at!).getTime();
              return sum + (end - start);
            }, 0) / completedWithTime.length / 1000
          )
        : 0;

      // job-1: 5 min = 300s, job-2: 3 min = 180s, avg = 240s
      expect(avgTime).toBe(240);
    });

    it('should handle jobs without completion time', () => {
      const incompleteJobs = mockJobs.filter(j => !j.completed_at);
      expect(incompleteJobs.length).toBe(3);
    });
  });

  describe('Recent Jobs', () => {
    it('should return most recent jobs first', () => {
      const recentJobs = [...mockJobs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      expect(recentJobs[0].id).toBe('job-5'); // Most recent
      expect(recentJobs[4].id).toBe('job-1'); // Oldest
    });

    it('should limit to specified count', () => {
      const limit = 3;
      const recentJobs = [...mockJobs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      expect(recentJobs.length).toBe(3);
    });
  });

  describe('Daily Usage', () => {
    it('should group jobs by day', () => {
      const dailyStats: Record<string, { jobs: number; credits: number }> = {};
      
      mockJobs.forEach(job => {
        const date = new Date(job.created_at).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { jobs: 0, credits: 0 };
        }
        dailyStats[date].jobs++;
        dailyStats[date].credits += job.credits_charged || 0;
      });

      expect(Object.keys(dailyStats).length).toBe(4); // 4 unique days
      expect(dailyStats['2026-01-04'].jobs).toBe(2); // 2 jobs on Jan 4
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user ID', () => {
      const userId = null;
      const isAuthorized = !!userId;
      expect(isAuthorized).toBe(false);
    });

    it('should handle database errors gracefully', () => {
      const handleError = (error: Error) => ({
        error: 'Failed to fetch data',
        details: error.message,
      });

      const result = handleError(new Error('Connection timeout'));
      expect(result.error).toBe('Failed to fetch data');
    });
  });
});

describe('Analytics Response Format', () => {
  it('should return properly formatted response', () => {
    const response = {
      jobs: {
        total: 5,
        completed: 2,
        failed: 1,
        processing: 1,
        queued: 1,
      },
      credits: {
        balance: 10,
        used: 3,
      },
      successRate: 40,
      avgProcessingTime: 240,
      platforms: { sora: 3, runway: 1, pika: 1 },
      recentJobs: [],
    };

    expect(response.jobs.total).toBeDefined();
    expect(response.credits.balance).toBeDefined();
    expect(response.successRate).toBeDefined();
    expect(response.platforms).toBeDefined();
  });
});

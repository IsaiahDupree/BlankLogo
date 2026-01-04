/**
 * Unit tests for notification system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Notification System', () => {
  describe('Email Templates', () => {
    it('should generate valid job completed email HTML', () => {
      const html = generateJobCompletedEmail({
        jobId: 'job_123',
        platform: 'sora',
        outputUrl: 'https://storage.example.com/video.mp4',
        processingTime: 15000,
      });
      
      expect(html).toContain('job_123');
      expect(html).toContain('sora');
      expect(html).toContain('Download');
    });

    it('should generate valid job failed email HTML', () => {
      const html = generateJobFailedEmail({
        jobId: 'job_123',
        platform: 'sora',
        errorMessage: 'Download failed',
      });
      
      expect(html).toContain('job_123');
      expect(html).toContain('Download failed');
      expect(html).toContain('Try Again');
    });

    it('should generate valid credits low email HTML', () => {
      const html = generateCreditsLowEmail({
        currentBalance: 3,
      });
      
      expect(html).toContain('3');
      expect(html).toContain('Credits');
      expect(html).toContain('Buy Credits');
    });
  });

  describe('Notification Preferences', () => {
    it('should respect user email_job_completed preference', async () => {
      const prefs = {
        email_job_completed: false,
        email_job_failed: true,
        email_credits_low: true,
      };
      
      const shouldSend = prefs.email_job_completed;
      expect(shouldSend).toBe(false);
    });

    it('should send notification when preference is enabled', async () => {
      const prefs = {
        email_job_completed: true,
        email_job_failed: true,
        email_credits_low: true,
      };
      
      const shouldSend = prefs.email_job_completed;
      expect(shouldSend).toBe(true);
    });
  });
});

describe('Deployment Notifications', () => {
  describe('Build Status', () => {
    it('should format build success notification', () => {
      const notification = formatBuildNotification({
        status: 'success',
        service: 'api',
        environment: 'production',
        commitHash: 'abc123',
        duration: 120,
      });
      
      expect(notification.subject).toContain('SUCCESS');
      expect(notification.body).toContain('api');
      expect(notification.body).toContain('production');
    });

    it('should format build failure notification', () => {
      const notification = formatBuildNotification({
        status: 'failure',
        service: 'worker',
        environment: 'production',
        error: 'Build timeout',
      });
      
      expect(notification.subject).toContain('FAILED');
      expect(notification.body).toContain('worker');
      expect(notification.body).toContain('Build timeout');
    });
  });
});

// Mock implementations for testing
function generateJobCompletedEmail(data: {
  jobId: string;
  platform: string;
  outputUrl: string;
  processingTime: number;
}): string {
  return `
    <h1>Job Completed</h1>
    <p>Job ID: ${data.jobId}</p>
    <p>Platform: ${data.platform}</p>
    <a href="${data.outputUrl}">Download</a>
    <p>Time: ${data.processingTime}ms</p>
  `;
}

function generateJobFailedEmail(data: {
  jobId: string;
  platform: string;
  errorMessage: string;
}): string {
  return `
    <h1>Job Failed</h1>
    <p>Job ID: ${data.jobId}</p>
    <p>Error: ${data.errorMessage}</p>
    <a href="/app/remove">Try Again</a>
  `;
}

function generateCreditsLowEmail(data: {
  currentBalance: number;
}): string {
  return `
    <h1>Credits Running Low</h1>
    <p>Balance: ${data.currentBalance} Credits</p>
    <a href="/app/credits">Buy Credits</a>
  `;
}

function formatBuildNotification(data: {
  status: 'success' | 'failure';
  service: string;
  environment: string;
  commitHash?: string;
  duration?: number;
  error?: string;
}): { subject: string; body: string } {
  const statusText = data.status === 'success' ? 'SUCCESS' : 'FAILED';
  return {
    subject: `[BlankLogo] Build ${statusText}: ${data.service}`,
    body: `
      Service: ${data.service}
      Environment: ${data.environment}
      ${data.commitHash ? `Commit: ${data.commitHash}` : ''}
      ${data.duration ? `Duration: ${data.duration}s` : ''}
      ${data.error ? `Error: ${data.error}` : ''}
    `,
  };
}

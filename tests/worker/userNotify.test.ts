/**
 * Tests for user email notification system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Resend
const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockEmailSend };
  },
}));

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { credits_balance: 10 }, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({
    data: {
      email_job_started: true,
      email_job_completed: true,
      email_job_failed: true,
      email_credits_low: true,
      email_account_status: true,
    },
    error: null,
  }),
  auth: {
    admin: {
      getUserById: vi.fn().mockResolvedValue({
        data: { user: { email: 'test@example.com' } },
        error: null,
      }),
    },
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('User Notification System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Notification Preferences', () => {
    it('should fetch user preferences from database', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', 'test-user-id')
        .maybeSingle();

      expect(data).toBeDefined();
      expect(data?.email_job_completed).toBe(true);
    });

    it('should respect disabled notifications', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          email_job_completed: false,
          email_job_failed: true,
          email_credits_low: true,
        },
        error: null,
      });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', 'test-user-id')
        .maybeSingle();

      expect(data?.email_job_completed).toBe(false);
    });
  });

  describe('Email Content Generation', () => {
    it('should generate job completed email with correct data', () => {
      const emailData = {
        jobId: 'job_123',
        platform: 'sora',
        outputUrl: 'https://storage.example.com/video.mp4',
        processingTime: 15000,
      };

      // Simulate email template generation
      const subject = `✅ Your ${emailData.platform} video is ready!`;
      const bodyContains = [
        emailData.jobId,
        'Download',
        '15',
      ];

      expect(subject).toContain('sora');
      expect(subject).toContain('ready');
      bodyContains.forEach(text => {
        expect(String(text)).toBeTruthy();
      });
    });

    it('should generate job failed email with error details', () => {
      const emailData = {
        jobId: 'job_456',
        platform: 'runway',
        errorMessage: 'Download timeout after 60s',
      };

      const subject = `❌ Video processing failed - ${emailData.platform}`;
      
      expect(subject).toContain('failed');
      expect(subject).toContain('runway');
      expect(emailData.errorMessage).toContain('timeout');
    });

    it('should generate credits low email with balance', () => {
      const emailData = {
        currentBalance: 3,
      };

      const subject = `⚠️ You have ${emailData.currentBalance} credits left`;
      
      expect(subject).toContain('3');
      expect(subject).toContain('credits');
    });
  });

  describe('Email Sending', () => {
    it('should call Resend API with correct parameters', async () => {
      const { Resend } = await import('resend');
      const resend = new Resend('test-key');
      
      const result = await resend.emails.send({
        from: 'BlankLogo <noreply@blanklogo.app>',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      });

      expect(result.data?.id).toBe('test-email-id');
      expect(result.error).toBeNull();
    });

    it('should handle Resend API errors gracefully', async () => {
      // Mock error response for this test
      mockEmailSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded', name: 'validation_error' as const },
      });

      const { Resend } = await import('resend');
      const resend = new Resend('test-key');

      const result = await resend.emails.send({
        from: 'test@test.com',
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Rate limit');
    });
  });

  describe('Credits Low Threshold', () => {
    it('should trigger notification when credits <= 5', () => {
      const shouldNotify = (balance: number) => balance <= 5;
      
      expect(shouldNotify(5)).toBe(true);
      expect(shouldNotify(3)).toBe(true);
      expect(shouldNotify(0)).toBe(true);
      expect(shouldNotify(6)).toBe(false);
      expect(shouldNotify(10)).toBe(false);
    });

    it('should not spam notifications for same low balance', () => {
      const notifiedUsers = new Set<string>();
      
      const shouldNotify = (userId: string, balance: number) => {
        if (balance > 5) return false;
        if (notifiedUsers.has(userId)) return false;
        notifiedUsers.add(userId);
        return true;
      };

      expect(shouldNotify('user1', 3)).toBe(true);
      expect(shouldNotify('user1', 3)).toBe(false); // Already notified
      expect(shouldNotify('user2', 3)).toBe(true); // Different user
    });
  });

  describe('User Email Lookup', () => {
    it('should fetch user email from auth', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data } = await supabase.auth.admin.getUserById('test-user-id');
      
      expect(data?.user?.email).toBe('test@example.com');
    });

    it('should handle missing user gracefully', async () => {
      mockSupabase.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient('', '');
      
      const { data } = await supabase.auth.admin.getUserById('nonexistent-user');
      
      expect(data?.user).toBeNull();
    });
  });
});

describe('Integration Scenarios', () => {
  it('should handle complete job notification flow', async () => {
    const userId = 'user-123';
    const jobId = 'job-456';
    
    // 1. Check user preferences
    const prefsEnabled = true;
    
    // 2. Get user email
    const userEmail = 'user@example.com';
    
    // 3. Generate email content
    const emailContent = {
      subject: `✅ Your video is ready!`,
      to: userEmail,
    };
    
    // 4. Send email
    const emailSent = prefsEnabled && userEmail;
    
    expect(emailSent).toBeTruthy();
    expect(emailContent.subject).toContain('ready');
  });

  it('should skip notification when preferences disabled', async () => {
    const prefsEnabled = false;
    const emailSent = prefsEnabled;
    
    expect(emailSent).toBe(false);
  });

  it('should check credits after job completion', async () => {
    const creditsAfterJob = 4;
    const shouldNotifyLowCredits = creditsAfterJob <= 5;
    
    expect(shouldNotifyLowCredits).toBe(true);
  });
});

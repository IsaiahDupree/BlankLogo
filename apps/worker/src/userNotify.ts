/**
 * User Email Notification Module
 * Sends emails to users based on their notification preferences
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'BlankLogo <noreply@blanklogo.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3939';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PREFS_CACHE_TTL = 300; // 5 minutes

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Redis client for caching
let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.on('error', (err) => console.log('[UserNotify] Redis cache error:', err.message));
} catch {
  console.log('[UserNotify] Redis cache not available, using DB directly');
}

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('[UserNotify] Resend configured for user notifications');
} else {
  console.log('[UserNotify] RESEND_API_KEY not set - user notifications disabled');
}

interface NotificationPrefs {
  email_job_started: boolean;
  email_job_completed: boolean;
  email_job_failed: boolean;
  email_credits_low: boolean;
  email_account_status: boolean;
}

async function getUserPrefs(userId: string): Promise<NotificationPrefs | null> {
  const cacheKey = `user:prefs:${userId}`;
  
  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[UserNotify] Cache hit for user prefs: ${userId}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      console.log('[UserNotify] Cache read error:', err instanceof Error ? err.message : err);
    }
  }
  
  // Fetch from database
  const { data } = await supabase
    .from('user_notification_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  // Cache the result
  if (data && redis) {
    try {
      await redis.setex(cacheKey, PREFS_CACHE_TTL, JSON.stringify(data));
      console.log(`[UserNotify] Cached user prefs for ${userId} (TTL: ${PREFS_CACHE_TTL}s)`);
    } catch (err) {
      console.log('[UserNotify] Cache write error:', err instanceof Error ? err.message : err);
    }
  }
  
  return data;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

// Email Templates
const emailStyles = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #fff; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); }
    .logo { font-size: 24px; font-weight: bold; color: #818cf8; margin-bottom: 24px; }
    .title { font-size: 28px; font-weight: bold; margin-bottom: 8px; }
    .subtitle { color: #9ca3af; margin-bottom: 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .button-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); color: #6b7280; font-size: 12px; }
    .stat { background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
    .stat-label { color: #9ca3af; font-size: 12px; }
    .stat-value { font-size: 18px; font-weight: 600; }
  </style>
`;

/**
 * Send Job Started notification
 */
export async function notifyJobStarted(userId: string, jobId: string, platform: string): Promise<boolean> {
  if (!resend) return false;

  try {
    const prefs = await getUserPrefs(userId);
    if (!prefs?.email_job_started) {
      console.log(`[UserNotify] Job started notification disabled for user ${userId}`);
      return false;
    }

    const email = await getUserEmail(userId);
    if (!email) return false;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>${emailStyles}</head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">✨ BlankLogo</div>
            <div class="title">Your video is processing!</div>
            <div class="subtitle">We've started removing the watermark from your ${platform} video.</div>
            
            <div class="stat">
              <div class="stat-label">Job ID</div>
              <div class="stat-value">${jobId}</div>
            </div>
            
            <p style="color: #9ca3af;">This usually takes 15-60 seconds. We'll email you when it's ready!</p>
            
            <a href="${APP_URL}/app/jobs" class="button">View Progress →</a>
            
            <div class="footer">
              <p>You received this because you enabled "Job Started" notifications.</p>
              <p><a href="${APP_URL}/app/settings" style="color: #818cf8;">Manage preferences</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🎬 Processing started - ${platform} video`,
      html,
    });

    console.log(`[UserNotify] Job started email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[UserNotify] Failed to send job started email:', error);
    return false;
  }
}

/**
 * Send Job Completed notification
 */
export async function notifyJobCompleted(
  userId: string,
  jobId: string,
  outputUrl: string,
  processingTime: number,
  platform: string
): Promise<boolean> {
  if (!resend) return false;

  try {
    const prefs = await getUserPrefs(userId);
    if (!prefs?.email_job_completed) {
      console.log(`[UserNotify] Job completed notification disabled for user ${userId}`);
      return false;
    }

    const email = await getUserEmail(userId);
    if (!email) return false;

    const timeStr = processingTime > 1000 
      ? `${(processingTime / 1000).toFixed(1)} seconds`
      : `${processingTime}ms`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>${emailStyles}</head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">✨ BlankLogo</div>
            <div class="title" style="color: #10b981;">✅ Watermark Removed!</div>
            <div class="subtitle">Your ${platform} video is ready to download.</div>
            
            <div class="stat">
              <div class="stat-label">Processing Time</div>
              <div class="stat-value">${timeStr}</div>
            </div>
            
            <a href="${outputUrl}" class="button button-green">⬇️ Download Video</a>
            <a href="${APP_URL}/app/jobs" class="button">View All Jobs →</a>
            
            <p style="color: #9ca3af; font-size: 14px; margin-top: 16px;">
              Your video will be available for 7 days. Download it before it expires!
            </p>
            
            <div class="footer">
              <p>You received this because you enabled "Job Completed" notifications.</p>
              <p><a href="${APP_URL}/app/settings" style="color: #818cf8;">Manage preferences</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `✅ Your ${platform} video is ready!`,
      html,
    });

    console.log(`[UserNotify] Job completed email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[UserNotify] Failed to send job completed email:', error);
    return false;
  }
}

/**
 * Send Job Failed notification
 */
export async function notifyJobFailed(
  userId: string,
  jobId: string,
  errorMessage: string,
  platform: string
): Promise<boolean> {
  if (!resend) return false;

  try {
    const prefs = await getUserPrefs(userId);
    if (!prefs?.email_job_failed) {
      console.log(`[UserNotify] Job failed notification disabled for user ${userId}`);
      return false;
    }

    const email = await getUserEmail(userId);
    if (!email) return false;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>${emailStyles}</head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">✨ BlankLogo</div>
            <div class="title" style="color: #ef4444;">❌ Processing Failed</div>
            <div class="subtitle">We couldn't process your ${platform} video.</div>
            
            <div class="stat" style="border-left: 3px solid #ef4444;">
              <div class="stat-label">Error</div>
              <div class="stat-value" style="font-size: 14px; color: #fca5a5;">${errorMessage}</div>
            </div>
            
            <p style="color: #9ca3af;">Don't worry - your credits have been refunded. Here are some tips:</p>
            <ul style="color: #9ca3af; font-size: 14px;">
              <li>Try using a direct video URL instead of a page URL</li>
              <li>Upload the video file directly if URL doesn't work</li>
              <li>Make sure the video is publicly accessible</li>
            </ul>
            
            <a href="${APP_URL}/app/remove" class="button">Try Again →</a>
            
            <div class="footer">
              <p>You received this because you enabled "Job Failed" notifications.</p>
              <p><a href="${APP_URL}/app/settings" style="color: #818cf8;">Manage preferences</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `❌ Video processing failed - ${platform}`,
      html,
    });

    console.log(`[UserNotify] Job failed email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[UserNotify] Failed to send job failed email:', error);
    return false;
  }
}

/**
 * Send Credits Low notification
 */
export async function notifyCreditsLow(userId: string, currentBalance: number): Promise<boolean> {
  if (!resend) return false;

  try {
    const prefs = await getUserPrefs(userId);
    if (!prefs?.email_credits_low) {
      console.log(`[UserNotify] Credits low notification disabled for user ${userId}`);
      return false;
    }

    const email = await getUserEmail(userId);
    if (!email) return false;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>${emailStyles}</head>
      <body>
        <div class="container">
          <div class="card">
            <div class="logo">✨ BlankLogo</div>
            <div class="title" style="color: #f59e0b;">⚠️ Credits Running Low</div>
            <div class="subtitle">You have ${currentBalance} credits remaining.</div>
            
            <div class="stat" style="border-left: 3px solid #f59e0b;">
              <div class="stat-label">Current Balance</div>
              <div class="stat-value">${currentBalance} credits</div>
            </div>
            
            <p style="color: #9ca3af;">Top up now to keep removing watermarks without interruption!</p>
            
            <a href="${APP_URL}/app/credits" class="button">Buy Credits →</a>
            
            <div class="footer">
              <p>You received this because you enabled "Credits Low" notifications.</p>
              <p><a href="${APP_URL}/app/settings" style="color: #818cf8;">Manage preferences</a></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `⚠️ You have ${currentBalance} credits left`,
      html,
    });

    console.log(`[UserNotify] Credits low email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[UserNotify] Failed to send credits low email:', error);
    return false;
  }
}

/**
 * Check if user notifications are enabled
 */
export function isUserNotifyEnabled(): boolean {
  return !!resend;
}

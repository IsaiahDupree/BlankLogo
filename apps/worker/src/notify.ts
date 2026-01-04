/**
 * Developer Notification Module
 * Sends alerts via Resend when critical failures occur
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEV_EMAIL = process.env.DEV_NOTIFICATION_EMAIL || 'dev@blanklogo.app';
const FROM_EMAIL = process.env.FROM_EMAIL || 'alerts@blanklogo.app';

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('[Notify] Resend configured for developer notifications');
} else {
  console.log('[Notify] RESEND_API_KEY not set - notifications disabled');
}

interface NotificationPayload {
  type: 'download_failure' | 'job_failure' | 'worker_error';
  jobId?: string;
  url?: string;
  error: string;
  method?: string;
  environment?: string;
}

/**
 * Send a developer notification
 */
export async function notifyDeveloper(payload: NotificationPayload): Promise<boolean> {
  console.log(`[Notify] Alert: ${payload.type} - ${payload.error}`);
  
  if (!resend) {
    console.log('[Notify] Resend not configured, skipping email notification');
    return false;
  }
  
  try {
    const subject = `[BlankLogo] ${payload.type.replace('_', ' ').toUpperCase()}: ${payload.error.substring(0, 50)}`;
    
    const html = `
      <h2>BlankLogo Worker Alert</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Type</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${payload.type}</td>
        </tr>
        ${payload.jobId ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Job ID</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${payload.jobId}</td>
        </tr>
        ` : ''}
        ${payload.url ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>URL</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${payload.url}</td>
        </tr>
        ` : ''}
        ${payload.method ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Method</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${payload.method}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Environment</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${payload.environment || process.env.NODE_ENV || 'development'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Error</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd; color: red;">${payload.error}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td>
        </tr>
      </table>
    `;
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: DEV_EMAIL,
      subject,
      html,
    });
    
    if (error) {
      console.error('[Notify] Failed to send email:', error);
      return false;
    }
    
    console.log(`[Notify] Email sent: ${data?.id}`);
    return true;
  } catch (error) {
    console.error('[Notify] Error sending notification:', error);
    return false;
  }
}

/**
 * Notify on download failure
 */
export async function notifyDownloadFailure(
  url: string,
  error: string,
  jobId?: string,
  methodsTried?: string[]
): Promise<void> {
  await notifyDeveloper({
    type: 'download_failure',
    jobId,
    url,
    error,
    method: methodsTried?.join(', ') || 'all methods',
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL ? 'cloud' : 'local',
  });
}

/**
 * Check if notifications are enabled
 */
export function isNotifyEnabled(): boolean {
  return !!resend;
}

#!/usr/bin/env npx tsx
/**
 * Deployment Notification Script
 * Sends email notifications for build/deployment status
 * 
 * Usage:
 *   npx tsx scripts/deploy-notify.ts --status=success --service=api --env=production
 *   npx tsx scripts/deploy-notify.ts --status=failure --service=worker --error="Build failed"
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = process.env.DEV_NOTIFICATION_EMAIL || 'dev@blanklogo.app';
const FROM_EMAIL = process.env.FROM_EMAIL || 'BlankLogo Deploy <deploy@blanklogo.app>';

interface DeploymentInfo {
  status: 'success' | 'failure' | 'started' | 'rollback';
  service: string;
  environment: string;
  commitHash?: string;
  commitMessage?: string;
  duration?: number;
  error?: string;
  url?: string;
}

async function sendDeploymentNotification(info: DeploymentInfo): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[Deploy] RESEND_API_KEY not set, logging to console only');
    console.log('[Deploy] Notification:', JSON.stringify(info, null, 2));
    return false;
  }

  const resend = new Resend(RESEND_API_KEY);
  
  const statusEmoji = {
    success: '✅',
    failure: '❌',
    started: '🚀',
    rollback: '⚠️',
  }[info.status];

  const statusColor = {
    success: '#10b981',
    failure: '#ef4444',
    started: '#3b82f6',
    rollback: '#f59e0b',
  }[info.status];

  const subject = `${statusEmoji} [BlankLogo] ${info.service} ${info.status.toUpperCase()} - ${info.environment}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #fff; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background: #16213e; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.1); }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; font-size: 14px; background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .info-label { color: #9ca3af; }
        .info-value { font-weight: 600; }
        .error-box { background: #ef444420; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin-top: 16px; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1 style="margin: 0 0 24px 0;">Deployment ${info.status === 'success' ? 'Successful' : info.status === 'failure' ? 'Failed' : info.status === 'started' ? 'Started' : 'Rolled Back'}</h1>
          
          <div class="status-badge">${statusEmoji} ${info.status.toUpperCase()}</div>
          
          <div style="margin-top: 24px;">
            <div class="info-row">
              <span class="info-label">Service</span>
              <span class="info-value">${info.service}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Environment</span>
              <span class="info-value">${info.environment}</span>
            </div>
            ${info.commitHash ? `
            <div class="info-row">
              <span class="info-label">Commit</span>
              <span class="info-value"><code>${info.commitHash.substring(0, 7)}</code></span>
            </div>
            ` : ''}
            ${info.commitMessage ? `
            <div class="info-row">
              <span class="info-label">Message</span>
              <span class="info-value">${info.commitMessage}</span>
            </div>
            ` : ''}
            ${info.duration ? `
            <div class="info-row">
              <span class="info-label">Duration</span>
              <span class="info-value">${info.duration}s</span>
            </div>
            ` : ''}
            <div class="info-row" style="border: none;">
              <span class="info-label">Timestamp</span>
              <span class="info-value">${new Date().toISOString()}</span>
            </div>
          </div>
          
          ${info.error ? `
          <div class="error-box">
            <strong style="color: #ef4444;">Error Details:</strong>
            <pre style="margin: 8px 0 0 0; white-space: pre-wrap; color: #fca5a5;">${info.error}</pre>
          </div>
          ` : ''}
          
          ${info.url ? `
          <a href="${info.url}" class="button">View Deployment →</a>
          ` : ''}
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject,
      html,
    });

    if (error) {
      console.error('[Deploy] Failed to send notification:', error);
      return false;
    }

    console.log(`[Deploy] Notification sent: ${data?.id}`);
    return true;
  } catch (error) {
    console.error('[Deploy] Error:', error);
    return false;
  }
}

// Parse CLI arguments
function parseArgs(): DeploymentInfo {
  const args = process.argv.slice(2);
  const info: DeploymentInfo = {
    status: 'success',
    service: 'unknown',
    environment: 'production',
  };

  for (const arg of args) {
    const [key, value] = arg.replace('--', '').split('=');
    switch (key) {
      case 'status':
        info.status = value as DeploymentInfo['status'];
        break;
      case 'service':
        info.service = value;
        break;
      case 'env':
      case 'environment':
        info.environment = value;
        break;
      case 'commit':
        info.commitHash = value;
        break;
      case 'message':
        info.commitMessage = value;
        break;
      case 'duration':
        info.duration = parseInt(value);
        break;
      case 'error':
        info.error = value;
        break;
      case 'url':
        info.url = value;
        break;
    }
  }

  // Get git info if not provided
  if (!info.commitHash) {
    try {
      const { execSync } = require('child_process');
      info.commitHash = execSync('git rev-parse HEAD').toString().trim();
      info.commitMessage = execSync('git log -1 --pretty=%B').toString().trim().split('\n')[0];
    } catch {
      // Git info not available
    }
  }

  return info;
}

// Main
const info = parseArgs();
console.log('[Deploy] Sending notification:', info);
sendDeploymentNotification(info).then((sent) => {
  process.exit(sent ? 0 : 1);
});

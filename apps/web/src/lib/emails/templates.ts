/**
 * BlankLogo Email Templates
 * Used for transactional and marketing emails
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function getWelcomeEmail(userName?: string): EmailTemplate {
  const name = userName || "there";
  
  return {
    subject: "Welcome to BlankLogo! 🎉 Your 10 free credits are ready",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 24px;">Welcome to BlankLogo!</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${name}! 👋
      </p>
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Thanks for signing up! You now have <strong style="color: #22c55e;">10 free credits</strong> to remove watermarks from your AI-generated videos.
      </p>
      
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #22c55e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">YOUR FREE CREDITS</p>
        <p style="color: white; font-size: 32px; font-weight: bold; margin: 0;">10 Videos</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0 0;">No credit card required • Never expires</p>
      </div>
      
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Here's what you can do:
      </p>
      
      <ul style="color: #e2e8f0; font-size: 15px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
        <li>Remove Sora watermarks</li>
        <li>Remove Runway Gen-2 watermarks</li>
        <li>Remove Pika, Kling, Luma watermarks</li>
        <li>Remove TikTok logos</li>
      </ul>
      
      <a href="https://blanklogo.com/app" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        Start Removing Watermarks →
      </a>
    </div>
    
    <!-- Quick Links -->
    <div style="text-align: center; margin-bottom: 32px;">
      <p style="color: #64748b; font-size: 14px; margin: 0 0 12px 0;">Quick links:</p>
      <a href="https://blanklogo.com/pricing" style="color: #3b82f6; text-decoration: none; margin: 0 12px;">Pricing</a>
      <a href="https://blanklogo.com/app" style="color: #3b82f6; text-decoration: none; margin: 0 12px;">Dashboard</a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
      <p style="margin: 0;">Questions? Reply to this email - we read every message!</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Welcome to BlankLogo! 🎉

Hey ${name}!

Thanks for signing up! You now have 10 FREE CREDITS to remove watermarks from your AI-generated videos.

No credit card required. Credits never expire.

Here's what you can do:
- Remove Sora watermarks
- Remove Runway Gen-2 watermarks
- Remove Pika, Kling, Luma watermarks
- Remove TikTok logos

Start removing watermarks: https://blanklogo.com/app

Questions? Reply to this email - we read every message!

© 2026 BlankLogo
    `.trim(),
  };
}

export function getDay3EducationEmail(userName?: string): EmailTemplate {
  const name = userName || "there";
  
  return {
    subject: "Pro tips: Get the best watermark removal results 🎯",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${name}! 👋
      </p>
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Quick tips to get the best results from BlankLogo:
      </p>
      
      <div style="margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 12px;">
        <h3 style="color: #3b82f6; font-size: 14px; margin: 0 0 8px 0;">💡 TIP 1: Choose the Right Mode</h3>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">
          <strong style="color: #e2e8f0;">Crop mode</strong> is fastest (5-15 sec) and works great for edge watermarks.<br>
          <strong style="color: #e2e8f0;">Inpaint mode</strong> uses AI to remove watermarks anywhere in the video.
        </p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 12px;">
        <h3 style="color: #22c55e; font-size: 14px; margin: 0 0 8px 0;">💡 TIP 2: Select Your Platform</h3>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">
          Each AI platform (Sora, Runway, Pika) has different watermark positions. Selecting the right platform gives better results!
        </p>
      </div>
      
      <div style="margin-bottom: 24px; padding: 16px; background: rgba(168, 85, 247, 0.1); border-radius: 12px;">
        <h3 style="color: #a855f7; font-size: 14px; margin: 0 0 8px 0;">💡 TIP 3: Batch Processing</h3>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">
          Have multiple videos? Upload them all at once - they process in parallel for faster results.
        </p>
      </div>
      
      <a href="https://blanklogo.com/app" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        Try It Now →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Pro tips: Get the best watermark removal results 🎯

Hey ${name}!

Quick tips to get the best results from BlankLogo:

💡 TIP 1: Choose the Right Mode
- Crop mode is fastest (5-15 sec) and works great for edge watermarks
- Inpaint mode uses AI to remove watermarks anywhere in the video

💡 TIP 2: Select Your Platform
Each AI platform (Sora, Runway, Pika) has different watermark positions. Selecting the right platform gives better results!

💡 TIP 3: Batch Processing
Have multiple videos? Upload them all at once - they process in parallel for faster results.

Try it now: https://blanklogo.com/app

© 2026 BlankLogo
    `.trim(),
  };
}

export function getDay7SocialProofEmail(userName?: string): EmailTemplate {
  const name = userName || "there";
  
  return {
    subject: "See what creators are making with BlankLogo ✨",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${name}! 👋
      </p>
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        Here's what other creators are saying about BlankLogo:
      </p>
      
      <!-- Testimonials -->
      <div style="margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.03); border-left: 3px solid #3b82f6; border-radius: 0 12px 12px 0;">
        <p style="color: #e2e8f0; font-size: 15px; font-style: italic; margin: 0 0 12px 0;">
          "Finally! A tool that actually removes Sora watermarks cleanly. Saved me hours of manual editing."
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 0;">— Alex T., Video Editor</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.03); border-left: 3px solid #22c55e; border-radius: 0 12px 12px 0;">
        <p style="color: #e2e8f0; font-size: 15px; font-style: italic; margin: 0 0 12px 0;">
          "The $5 starter pack is perfect - I only need watermarks removed occasionally, no point paying monthly subscriptions."
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 0;">— Maria S., Freelance Designer</p>
      </div>
      
      <div style="margin-bottom: 24px; padding: 20px; background: rgba(255,255,255,0.03); border-left: 3px solid #a855f7; border-radius: 0 12px 12px 0;">
        <p style="color: #e2e8f0; font-size: 15px; font-style: italic; margin: 0 0 12px 0;">
          "Processing is super fast. I remove watermarks from Runway videos in about 10 seconds."
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 0;">— James K., Content Creator</p>
      </div>
      
      <a href="https://blanklogo.com/app" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        Use Your Free Credits →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
See what creators are making with BlankLogo ✨

Hey ${name}!

Here's what other creators are saying about BlankLogo:

"Finally! A tool that actually removes Sora watermarks cleanly. Saved me hours of manual editing."
— Alex T., Video Editor

"The $5 starter pack is perfect - I only need watermarks removed occasionally, no point paying monthly subscriptions."
— Maria S., Freelance Designer

"Processing is super fast. I remove watermarks from Runway videos in about 10 seconds."
— James K., Content Creator

Use your free credits: https://blanklogo.com/app

© 2026 BlankLogo
    `.trim(),
  };
}

export function getReengagementEmail(userName?: string, creditsRemaining?: number): EmailTemplate {
  const name = userName || "there";
  const credits = creditsRemaining ?? 0;
  
  return {
    subject: credits > 0 
      ? `Your ${credits} credits are waiting! 🎁`
      : "We miss you! Here's 3 bonus credits 🎁",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${name}! 👋
      </p>
      
      ${credits > 0 ? `
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          You still have <strong style="color: #22c55e;">${credits} credits</strong> waiting to be used!
        </p>
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          Don't let them go to waste. Remove some watermarks today!
        </p>
      ` : `
        <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          It's been a while since we've seen you. Here's a little gift:
        </p>
        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <p style="color: #22c55e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">BONUS CREDITS</p>
          <p style="color: white; font-size: 32px; font-weight: bold; margin: 0;">3 Free</p>
          <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0 0;">On your next purchase of any pack</p>
        </div>
      `}
      
      <a href="https://blanklogo.com/app" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        ${credits > 0 ? "Use Your Credits →" : "Claim Bonus Credits →"}
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: credits > 0 
      ? `
Hey ${name}!

You still have ${credits} credits waiting to be used!

Don't let them go to waste. Remove some watermarks today!

Use your credits: https://blanklogo.com/app

© 2026 BlankLogo
      `.trim()
      : `
Hey ${name}!

It's been a while since we've seen you. Here's a little gift:

BONUS: 3 FREE CREDITS on your next purchase of any pack

Claim your bonus: https://blanklogo.com/app

© 2026 BlankLogo
      `.trim(),
  };
}

export function getLowCreditsEmail(userName?: string, creditsRemaining?: number): EmailTemplate {
  const name = userName || "there";
  const credits = creditsRemaining ?? 2;
  
  return {
    subject: `Only ${credits} credits left - time for a refill? 🔋`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Hey ${name}! 👋
      </p>
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
        You've been busy! You're down to your last <strong style="color: #f59e0b;">${credits} credits</strong>.
      </p>
      
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Top up before you run out:
      </p>
      
      <div style="display: grid; gap: 12px; margin-bottom: 24px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="color: #e2e8f0; font-weight: 600; margin: 0;">Starter</p>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">15 credits</p>
          </div>
          <p style="color: #22c55e; font-weight: bold; font-size: 18px; margin: 0;">$5</p>
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); border: 2px solid #3b82f6; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="color: #e2e8f0; font-weight: 600; margin: 0;">Pro <span style="background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">POPULAR</span></p>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">60 credits</p>
          </div>
          <p style="color: #3b82f6; font-weight: bold; font-size: 18px; margin: 0;">$19</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <p style="color: #e2e8f0; font-weight: 600; margin: 0;">Business</p>
            <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">200 credits</p>
          </div>
          <p style="color: #22c55e; font-weight: bold; font-size: 18px; margin: 0;">$49</p>
        </div>
      </div>
      
      <a href="https://blanklogo.com/pricing" style="display: block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        Get More Credits →
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Only ${credits} credits left - time for a refill? 🔋

Hey ${name}!

You've been busy! You're down to your last ${credits} credits.

Top up before you run out:

Starter - 15 credits - $5
Pro - 60 credits - $19 (POPULAR)
Business - 200 credits - $49

Get more credits: https://blanklogo.com/pricing

© 2026 BlankLogo
    `.trim(),
  };
}

export function getJobCompletedEmail(
  userName?: string, 
  jobId?: string,
  platform?: string,
  downloadUrl?: string
): EmailTemplate {
  const name = userName || "there";
  
  return {
    subject: `Your ${platform || "video"} is ready! ✅`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 12px; line-height: 48px; color: white; font-weight: bold; font-size: 24px;">B</div>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 64px; height: 64px; background: rgba(34, 197, 94, 0.2); border-radius: 50%; line-height: 64px; font-size: 32px;">✅</div>
      </div>
      
      <h2 style="color: #e2e8f0; font-size: 24px; text-align: center; margin: 0 0 16px 0;">
        Your video is ready!
      </h2>
      
      <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
        Hey ${name}, your ${platform || "video"} watermark has been successfully removed.
      </p>
      
      ${downloadUrl ? `
        <a href="${downloadUrl}" style="display: block; background: #22c55e; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 16px;">
          Download Video →
        </a>
      ` : ""}
      
      <a href="https://blanklogo.com/app" style="display: block; background: rgba(255,255,255,0.1); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
        View in Dashboard
      </a>
      
      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
        Job ID: ${jobId || "N/A"}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Your ${platform || "video"} is ready! ✅

Hey ${name}, your ${platform || "video"} watermark has been successfully removed.

${downloadUrl ? `Download your video: ${downloadUrl}` : ""}

View in dashboard: https://blanklogo.com/app

Job ID: ${jobId || "N/A"}

© 2026 BlankLogo
    `.trim(),
  };
}

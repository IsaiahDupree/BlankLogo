# Supabase Auth Email Templates (On-Brand)

These templates should be copied into **Supabase Dashboard → Authentication → Email Templates**.

---

## 1. Confirm Signup Email

**Subject:**
```
Confirm your BlankLogo account - 20 free credits waiting! 🎉
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 28px;">Welcome to BlankLogo!</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
        You're one click away from removing AI watermarks!
      </p>
      
      <!-- Credits Banner -->
      <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.15)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <p style="color: #22c55e; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">YOUR FREE CREDITS</p>
        <p style="color: white; font-size: 48px; font-weight: bold; margin: 0;">20</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0 0;">That's 20 watermark removals - completely free!</p>
      </div>
      
      <!-- Steps -->
      <div style="margin-bottom: 24px;">
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="width: 28px; height: 28px; background: #6366f1; border-radius: 50%; color: white; font-weight: bold; font-size: 14px; text-align: center; line-height: 28px; margin-right: 12px;">1</div>
          <span style="color: #22c55e; font-weight: 600;">Click the button below ✓</span>
        </div>
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <div style="width: 28px; height: 28px; background: #6366f1; border-radius: 50%; color: white; font-weight: bold; font-size: 14px; text-align: center; line-height: 28px; margin-right: 12px;">2</div>
          <span style="color: #e2e8f0;">Sign in to your new account</span>
        </div>
        <div style="display: flex; align-items: center;">
          <div style="width: 28px; height: 28px; background: #6366f1; border-radius: 50%; color: white; font-weight: bold; font-size: 14px; text-align: center; line-height: 28px; margin-right: 12px;">3</div>
          <span style="color: #e2e8f0;">Start removing watermarks!</span>
        </div>
      </div>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 18px 32px; border-radius: 12px; font-weight: 600; font-size: 18px; text-align: center; margin-bottom: 16px;">
        Confirm My Email & Get 20 Credits →
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
        Button not working? Copy this link: {{ .ConfirmationURL }}
      </p>
    </div>
    
    <!-- Supported Platforms -->
    <div style="text-align: center; margin-bottom: 24px;">
      <p style="color: #64748b; font-size: 13px; margin: 0 0 8px 0;">Works with:</p>
      <p style="color: #94a3b8; font-size: 14px; margin: 0;">Sora • Runway • Pika • Kling • TikTok • Luma • Instagram</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">Questions? Reply to this email - we read every message!</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Password Reset Email

**Subject:**
```
Reset your BlankLogo password
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 24px;">Reset Your Password</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to reset your password. Click the button below to create a new password:
      </p>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 20px;">
        Reset My Password
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0 0 20px 0;">
        Button not working? Copy this link: {{ .ConfirmationURL }}
      </p>
      
      <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #fbbf24; font-size: 13px; margin: 0;">
          ⚠️ If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">Need help? Contact support@blanklogo.app</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Magic Link Email

**Subject:**
```
Your BlankLogo sign-in link
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 24px;">Sign In to BlankLogo</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
        Click the button below to sign in to your account:
      </p>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 20px;">
        Sign In to BlankLogo →
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
        This link expires in 24 hours.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">If you didn't request this, you can ignore this email.</p>
    </div>
  </div>
</body>
</html>
```

---

## How to Apply These Templates

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Authentication** → **Email Templates**
3. For each template type (Confirm signup, Reset password, Magic link):
   - Paste the **Subject** line
   - Paste the **HTML Body**
4. Click **Save**

### Important Variables

- `{{ .ConfirmationURL }}` - The confirmation/action link
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - The token (if needed for custom flows)

---

## Resend Domain Setup

To send emails from `@blanklogo.app`:

1. Go to **Resend Dashboard** → **Domains** → **Add Domain**
2. Enter: `blanklogo.app`
3. Add these DNS records to your registrar:

| Type | Name | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `resend._domainkey` | *(provided by Resend)* |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

4. Click **Verify** in Resend
5. Update `FROM_EMAIL` in your environment variables

---

## Google OAuth Setup

To enable "Sign in with Google":

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URIs:
   - `https://cwnayaqzslaukjlwkzlo.supabase.co/auth/v1/callback`
   - `https://www.blanklogo.app/auth/callback` (for local testing: `http://localhost:3939/auth/callback`)
7. Copy the **Client ID** and **Client Secret**

### 2. Configure Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Enable **Google**
3. Paste your **Client ID** and **Client Secret**
4. Save

### 3. Test

Visit `/login` or `/signup` and click "Continue with Google"

---

## 4. Invite User Email

**Subject:**
```
You've been invited to join BlankLogo!
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 28px;">You're Invited!</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0; text-align: center;">
        You've been invited to join BlankLogo - the fastest way to remove AI watermarks from your videos.
      </p>
      
      <!-- Benefits -->
      <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="color: #a5b4fc; font-size: 14px; margin: 0 0 12px 0;">What you'll get:</p>
        <ul style="color: #e2e8f0; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>10 free credits to remove watermarks</li>
          <li>Support for Sora, Runway, Pika, Kling & more</li>
          <li>AI-powered inpainting for seamless results</li>
        </ul>
      </div>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 18px 32px; border-radius: 12px; font-weight: 600; font-size: 18px; text-align: center; margin-bottom: 16px;">
        Accept Invitation →
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0;">
        This invitation expires in 24 hours.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">Questions? Contact support@blanklogo.app</p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Change Email Address Email

**Subject:**
```
Confirm your new email address for BlankLogo
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 24px;">Confirm Your New Email</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        You requested to change your email address for your BlankLogo account. Click the button below to confirm this change:
      </p>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 20px;">
        Confirm New Email Address
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0 0 20px 0;">
        Button not working? Copy this link: {{ .ConfirmationURL }}
      </p>
      
      <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #fbbf24; font-size: 13px; margin: 0;">
          ⚠️ If you didn't request this change, please ignore this email and your email will remain unchanged.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">Need help? Contact support@blanklogo.app</p>
    </div>
  </div>
</body>
</html>
```

---

## 6. Reauthentication Email

**Subject:**
```
Confirm your identity for BlankLogo
```

**Body (HTML):**
```html
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
      <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; line-height: 56px; color: white; font-weight: bold; font-size: 28px;">B</div>
      <h1 style="color: white; margin: 16px 0 0 0; font-size: 24px;">Confirm Your Identity</h1>
    </div>
    
    <!-- Content -->
    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        We need to verify your identity before you can complete a sensitive action on your BlankLogo account.
      </p>
      
      <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        Click the button below to confirm it's you:
      </p>
      
      <a href="{{ .ConfirmationURL }}" style="display: block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center; margin-bottom: 20px;">
        Verify My Identity
      </a>
      
      <p style="color: #64748b; font-size: 13px; text-align: center; margin: 0 0 20px 0;">
        This link expires in 10 minutes.
      </p>
      
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; text-align: center;">
        <p style="color: #f87171; font-size: 13px; margin: 0;">
          🔒 If you didn't initiate this action, someone may be trying to access your account. Please change your password immediately.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #64748b; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">© 2026 BlankLogo by Dupree Ops LLC</p>
      <p style="margin: 0;">Security concerns? Contact support@blanklogo.app</p>
    </div>
  </div>
</body>
</html>
```

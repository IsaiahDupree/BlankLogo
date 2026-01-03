# BlankLogo Supabase & Authentication Guide

## Complete Documentation for Local Development & Production

**Last Updated:** January 2026  
**Based on:** Lessons learned from development and debugging sessions

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Supabase Architecture](#2-supabase-architecture)
3. [Local Development Setup](#3-local-development-setup)
4. [Authentication Configuration](#4-authentication-configuration)
5. [Email Delivery Setup](#5-email-delivery-setup)
6. [Database Schema](#6-database-schema)
7. [Auth Triggers & Functions](#7-auth-triggers--functions)
8. [API Keys & Environment Variables](#8-api-keys--environment-variables)
9. [Testing Auth Flows](#9-testing-auth-flows)
10. [Troubleshooting Guide](#10-troubleshooting-guide)
11. [Production Deployment](#11-production-deployment)

---

## 1. Quick Start

### Start Local Supabase
```bash
# From project root
supabase start

# Output includes:
#   API URL: http://127.0.0.1:54351
#   Studio URL: http://127.0.0.1:54353
#   Mailpit URL: http://127.0.0.1:54354
#   Publishable key: sb_publishable_xxx
#   Secret key: sb_secret_xxx
```

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Supabase API** | http://127.0.0.1:54351 | REST/GraphQL endpoints |
| **Supabase Studio** | http://127.0.0.1:54353 | Database GUI |
| **Mailpit** | http://127.0.0.1:54354 | Email testing inbox |
| **PostgreSQL** | postgresql://postgres:postgres@127.0.0.1:54352/postgres | Direct DB access |

### Test Auth Quickly
```bash
# Signup
curl -X POST http://127.0.0.1:54351/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST "http://127.0.0.1:54351/auth/v1/token?grant_type=password" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 2. Supabase Architecture

### Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Stack                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Kong      │  │   GoTrue    │  │  PostgREST  │        │
│  │   (API GW)  │  │   (Auth)    │  │  (REST API) │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          │                                 │
│                   ┌──────┴──────┐                         │
│                   │  PostgreSQL │                         │
│                   │  (Database) │                         │
│                   └─────────────┘                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Storage   │  │   Realtime  │  │   Mailpit   │        │
│  │   (S3-like) │  │ (WebSocket) │  │   (Email)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Docker Containers (Local)

| Container | Purpose |
|-----------|---------|
| `supabase_db_BlankLogo` | PostgreSQL database |
| `supabase_auth_BlankLogo` | GoTrue auth service |
| `supabase_rest_BlankLogo` | PostgREST API |
| `supabase_storage_BlankLogo` | File storage |
| `supabase_inbucket_BlankLogo` | Email testing (Mailpit) |
| `supabase_studio_BlankLogo` | Admin dashboard |
| `supabase_kong_BlankLogo` | API gateway |

---

## 3. Local Development Setup

### Prerequisites
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

### Initialize Project
```bash
# If starting fresh
supabase init

# This creates:
# supabase/
#   ├── config.toml      # Main configuration
#   ├── migrations/      # Database migrations
#   └── seed.sql         # Seed data (optional)
```

### Configuration File: `supabase/config.toml`

Key sections to understand:

```toml
[api]
enabled = true
port = 54351                    # API port

[db]
port = 54352                    # PostgreSQL port

[studio]
enabled = true
port = 54353                    # Studio GUI port

[inbucket]
enabled = true
port = 54354                    # Email testing UI port

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"  # Your frontend URL

[auth.email]
enable_signup = true
enable_confirmations = false    # Set true for production
double_confirm_changes = true

[auth.email.smtp]
enabled = true                  # REQUIRED for email delivery
host = "inbucket"               # Docker container name
port = 1025                     # SMTP port (not web UI port!)
user = "inbucket"               # Any value works for Inbucket
pass = "inbucket"               # Any value works for Inbucket
admin_email = "admin@blanklogo.com"
sender_name = "BlankLogo"
```

### Start/Stop Commands
```bash
# Start all services
supabase start

# Stop all services
supabase stop

# Reset database (destructive!)
supabase db reset

# View logs
docker logs supabase_auth_BlankLogo
docker logs supabase_db_BlankLogo
```

---

## 4. Authentication Configuration

### Auth Settings in `config.toml`

```toml
[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600                          # 1 hour
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false
minimum_password_length = 6

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false               # For local dev
max_frequency = "1s"                       # Min time between emails
otp_length = 6
otp_expiry = 3600

[auth.rate_limit]
email_sent = 2                             # Emails per hour (per user)
sign_in_sign_ups = 30                      # Signups per 5 min (per IP)
token_verifications = 30                   # OTP verifications per 5 min
```

### Frontend Supabase Client Setup

**File: `apps/web/src/lib/supabase/client.ts`**
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Using Auth in Components

```typescript
"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  async function handleLogin(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login failed:", error.message);
      return;
    }

    // Redirect on success
    window.location.href = "/dashboard";
  }
}
```

### Auth Operations Reference

```typescript
// Signup
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password123",
  options: {
    data: { full_name: "John Doe" }, // Custom user metadata
  },
});

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});

// Logout
const { error } = await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Password reset request
const { error } = await supabase.auth.resetPasswordForEmail(
  "user@example.com",
  { redirectTo: "http://localhost:3000/reset-password" }
);

// Update password (after clicking reset link)
const { error } = await supabase.auth.updateUser({
  password: "newPassword123",
});

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);
  console.log("Session:", session);
});
```

---

## 5. Email Delivery Setup

### Why SMTP Must Be Enabled

**CRITICAL:** Email delivery requires `[auth.email.smtp]` to be enabled in `config.toml`. Without this, auth will process requests but **NO EMAILS WILL BE SENT**.

### Local Development (Mailpit/Inbucket)

```toml
# supabase/config.toml

[auth.email.smtp]
enabled = true
host = "inbucket"           # Docker container name (NOT localhost)
port = 1025                  # SMTP port inside container
user = "inbucket"            # Required but any value works
pass = "inbucket"            # Required but any value works
admin_email = "admin@blanklogo.com"
sender_name = "BlankLogo"
```

### Viewing Emails

1. Open Mailpit UI: http://localhost:54354
2. All emails sent by Supabase Auth appear here
3. Click on email to see content and reset links

### Email API (for testing)

```bash
# List all emails
curl http://localhost:54354/api/v1/messages

# Get specific email
curl http://localhost:54354/api/v1/message/{id}

# Delete all emails
curl -X DELETE http://localhost:54354/api/v1/messages
```

### Production SMTP Setup

For production, use a real SMTP provider:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"      # Use environment variable
admin_email = "noreply@blanklogo.com"
sender_name = "BlankLogo"
```

**Recommended providers:**
- SendGrid (free tier: 100 emails/day)
- Resend (free tier: 3,000 emails/month)
- Postmark (free tier: 100 emails/month)
- AWS SES (cheapest at scale)

---

## 6. Database Schema

### Core Tables

#### `auth.users` (Managed by Supabase)
Built-in table for user authentication. **Do not modify directly.**

#### `bl_profiles` (User Profile Extension)
```sql
CREATE TABLE IF NOT EXISTS bl_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Subscription & Credits
  subscription_tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  credits_balance INTEGER DEFAULT 10,
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_suspended BOOLEAN DEFAULT false,
  suspended_reason TEXT,
  suspended_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `bl_jobs` (Watermark Removal Jobs)
```sql
CREATE TABLE IF NOT EXISTS bl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Job details
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  platform TEXT NOT NULL,
  video_url TEXT NOT NULL,
  output_url TEXT,
  
  -- Metadata
  processing_mode TEXT DEFAULT 'crop',
  credits_used INTEGER DEFAULT 1,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Row Level Security (RLS)

**Always enable RLS on public tables:**

```sql
-- Enable RLS
ALTER TABLE bl_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
  ON bl_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON bl_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can only see their own jobs
CREATE POLICY "Users can view own jobs"
  ON bl_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create jobs for themselves
CREATE POLICY "Users can create own jobs"
  ON bl_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 7. Auth Triggers & Functions

### Auto-Create Profile on Signup

**IMPORTANT:** This is where many issues occur. The trigger function name and table name must match exactly.

```sql
-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bl_profiles (id, full_name, credits_balance, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    10,  -- Starting credits
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Common Trigger Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| Table name mismatch | `relation "xxx" does not exist` | Ensure trigger references correct table name |
| Missing table | 500 error on signup | Create the table first |
| Wrong permissions | Trigger fails silently | Use `SECURITY DEFINER` |
| Cached statements | Error persists after fix | Restart auth container |

### Fixing Broken Triggers

```bash
# 1. Check existing triggers
docker exec supabase_db_BlankLogo psql -U postgres -c "
  SELECT tgname, proname 
  FROM pg_trigger t 
  JOIN pg_proc p ON t.tgfoid = p.oid 
  WHERE tgrelid = 'auth.users'::regclass 
  AND tgname NOT LIKE 'RI_%';
"

# 2. Check function definition
docker exec supabase_db_BlankLogo psql -U postgres -c "
  SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
"

# 3. Drop and recreate if needed
docker exec supabase_db_BlankLogo psql -U postgres -c "
  DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
"

# 4. Restart auth to clear cache
docker restart supabase_auth_BlankLogo
```

---

## 8. API Keys & Environment Variables

### Key Types

| Key | Usage | Security |
|-----|-------|----------|
| **Anon Key** | Client-side, respects RLS | Safe to expose |
| **Service Role Key** | Server-side, bypasses RLS | **NEVER EXPOSE** |

### Environment Variables

**Frontend (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54351
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
```

**Backend (`apps/api/.env`):**
```env
SUPABASE_URL=http://127.0.0.1:54351
SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

### Getting Keys

```bash
# After running `supabase start`, keys are displayed:
supabase status

# Or extract programmatically:
supabase status -o env | grep SUPABASE
```

---

## 9. Testing Auth Flows

### Run Auth Tests
```bash
# All auth tests
pnpm exec playwright test tests/e2e/auth-flows.spec.ts

# Connectivity tests (includes auth)
pnpm exec playwright test tests/e2e/connectivity.spec.ts
```

### Manual Testing with cURL

```bash
# Set your anon key
ANON_KEY="sb_publishable_xxx"

# 1. Signup
curl -X POST http://127.0.0.1:54351/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. Login
curl -X POST "http://127.0.0.1:54351/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 3. Password Reset Request
curl -X POST http://127.0.0.1:54351/auth/v1/recover \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 4. Check Mailpit for reset email
curl http://localhost:54354/api/v1/messages
```

### Test Accounts

For local development, create test accounts:

```sql
-- Create test user directly in database
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'testuser@blanklogo.test',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);
```

---

## 10. Troubleshooting Guide

### Issue: "Database error saving new user" on Signup

**Cause:** Trigger function references non-existent table or has wrong table name.

**Fix:**
```bash
# 1. Check trigger function
docker exec supabase_db_BlankLogo psql -U postgres -c "
  SELECT prosrc FROM pg_proc WHERE proname LIKE '%user%' AND prosrc LIKE '%INSERT%';
"

# 2. Drop broken trigger
docker exec supabase_db_BlankLogo psql -U postgres -c "
  DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
"

# 3. Recreate with correct table name
docker exec supabase_db_BlankLogo psql -U postgres -c "
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS \$\$
  BEGIN
    INSERT INTO bl_profiles (id, credits_balance, created_at, updated_at)
    VALUES (NEW.id, 10, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END;
  \$\$ LANGUAGE plpgsql SECURITY DEFINER;
  
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
"

# 4. Restart auth service
docker restart supabase_auth_BlankLogo
```

### Issue: Password Reset Emails Not Appearing

**Cause:** SMTP not enabled in config.toml

**Fix:**
```toml
# In supabase/config.toml, ensure this section exists and is NOT commented:
[auth.email.smtp]
enabled = true
host = "inbucket"
port = 1025
user = "inbucket"
pass = "inbucket"
admin_email = "admin@blanklogo.com"
sender_name = "BlankLogo"
```

Then restart:
```bash
supabase stop && supabase start
```

### Issue: Auth Takes 1-2 Seconds

**Cause:** This is normal! bcrypt password hashing is intentionally slow for security.

**Explanation:**
- bcrypt uses a "cost factor" that makes password verification take ~1-2s
- This prevents brute-force attacks
- Production servers with more CPU are faster

### Issue: "Invalid login credentials" Immediately

**Cause:** User doesn't exist or wrong password.

**Debug:**
```bash
# Check if user exists
docker exec supabase_db_BlankLogo psql -U postgres -c "
  SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'test@example.com';
"
```

### Issue: Changes Not Taking Effect

**Cause:** Cached prepared statements or old config.

**Fix:**
```bash
# Full restart
supabase stop && supabase start

# Or just restart auth
docker restart supabase_auth_BlankLogo
```

### Viewing Logs

```bash
# Auth service logs (most useful for debugging)
docker logs supabase_auth_BlankLogo 2>&1 | tail -50

# Database logs
docker logs supabase_db_BlankLogo 2>&1 | tail -50

# All containers
docker ps --filter name=supabase
```

---

## 11. Production Deployment

### Environment Variables for Production

```env
# Supabase (from dashboard.supabase.com)
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# SMTP (for email delivery)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

### Production Checklist

- [ ] Enable email confirmations (`enable_confirmations = true`)
- [ ] Set strong password requirements
- [ ] Configure real SMTP provider
- [ ] Set correct `site_url` for redirects
- [ ] Enable RLS on all tables
- [ ] Test password reset flow
- [ ] Set up monitoring/alerting
- [ ] Review rate limits

### Migrations

```bash
# Generate migration from local changes
supabase db diff -f my_migration_name

# Push to production
supabase db push --linked

# Or apply via SQL in Supabase Dashboard
```

---

## Quick Reference Card

```
LOCAL DEVELOPMENT URLS
━━━━━━━━━━━━━━━━━━━━━━
Frontend:     http://localhost:3838
API:          http://localhost:8989
Supabase API: http://127.0.0.1:54351
Supabase DB:  postgresql://postgres:postgres@127.0.0.1:54352/postgres
Studio:       http://127.0.0.1:54353
Mailpit:      http://127.0.0.1:54354

COMMANDS
━━━━━━━━
supabase start          Start all services
supabase stop           Stop all services
supabase db reset       Reset database
supabase status         Show URLs and keys
docker logs <container> View container logs

AUTH ENDPOINTS
━━━━━━━━━━━━━━
POST /auth/v1/signup              Create account
POST /auth/v1/token?grant_type=password  Login
POST /auth/v1/logout              Logout
POST /auth/v1/recover             Request password reset
PUT  /auth/v1/user                Update user
GET  /auth/v1/user                Get current user

COMMON FIXES
━━━━━━━━━━━━
Emails not sending → Enable [auth.email.smtp] in config.toml
Signup fails       → Check trigger table name matches
Auth slow (1-2s)   → Normal (bcrypt security)
Changes stuck      → docker restart supabase_auth_BlankLogo
```

---

*Documentation maintained by BlankLogo team*  
*For issues, check logs: `docker logs supabase_auth_BlankLogo`*

# Credit Rewards System PRD

## Overview

A secure, fraud-resistant credit rewards system that awards credits based on verified user actions. Credits are treated like money with full audit trail, idempotency, and anti-abuse controls.

## Architecture Principles

1. **Never trust the client** - Credits awarded only from server-verified events
2. **Ledger-based accounting** - All credit changes are auditable transactions
3. **Idempotent operations** - Same event processed twice = same outcome
4. **PostHog for analytics, not authority** - Database is source of truth

---

## Database Schema

### 1. `bl_app_events` - Trusted Event Source

Stores server-verified events that can trigger rewards.

```sql
CREATE TABLE bl_app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('vercel_api', 'worker', 'stripe_webhook', 'supabase_trigger')),
  properties JSONB DEFAULT '{}',
  dedupe_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_events_user ON bl_app_events(user_id);
CREATE INDEX idx_app_events_name ON bl_app_events(event_name);
CREATE INDEX idx_app_events_time ON bl_app_events(event_time);
```

### 2. `bl_credit_ledger` - Auditable Credit Transactions

All credit changes go through this ledger.

```sql
CREATE TABLE bl_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  rule_id UUID REFERENCES bl_reward_rules(id),
  event_id UUID REFERENCES bl_app_events(id),
  campaign_id TEXT,
  job_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(rule_id, event_id)
);

CREATE INDEX idx_credit_ledger_user ON bl_credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_reason ON bl_credit_ledger(reason);
```

### 3. `bl_reward_rules` - Configurable Reward Definitions

```sql
CREATE TABLE bl_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  credits_delta INTEGER NOT NULL,
  conditions JSONB DEFAULT '{}',
  max_awards_per_user INTEGER DEFAULT 1,
  cooldown_seconds INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. `bl_promo_campaigns` - Marketing Campaigns

```sql
CREATE TABLE bl_promo_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL DEFAULT 10,
  max_redemptions INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  utm_source TEXT,
  utm_campaign TEXT,
  enabled BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. `bl_promo_redemptions` - Prevents Double-Claim

```sql
CREATE TABLE bl_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES bl_promo_campaigns(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token_hash TEXT,
  ip_hash TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_promo_redemptions_token ON bl_promo_redemptions(token_hash);
```

### 6. `bl_notification_outbox` - Reliable Email Delivery

```sql
CREATE TABLE bl_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  dedupe_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 8,
  next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_outbox_pending ON bl_notification_outbox(status, next_attempt_at) 
  WHERE status = 'pending';
```

### 7. View: `bl_credit_balance` - Computed Balance

```sql
CREATE OR REPLACE VIEW bl_credit_balance AS
SELECT 
  user_id,
  COALESCE(SUM(delta), 0) AS balance
FROM bl_credit_ledger
GROUP BY user_id;
```

---

## API Endpoints

### `GET /promo` - Landing Page with Token

1. Validate campaign from UTM params
2. Create signed JWT promo token
3. Set HttpOnly cookie `bl_promo_token`
4. Fire PostHog `promo_landing_viewed`
5. Redirect to signup or app

**Token payload:**
```json
{
  "campaign_id": "blanklogo_10credits",
  "issued_at": 1704067200,
  "expires_at": 1704672000,
  "nonce": "abc123",
  "ip_hash": "sha256..."
}
```

### `POST /api/promos/redeem` - Redeem Promo Credits

1. Read `bl_promo_token` cookie
2. Verify JWT signature + expiration
3. Check user is new (created within 7 days)
4. Check campaign active + not maxed
5. Check no prior redemption for this user+campaign
6. **In single transaction:**
   - Insert `bl_promo_redemptions`
   - Insert `bl_app_events` (promo_redeemed)
   - Insert `bl_credit_ledger` (+credits)
   - Insert `bl_notification_outbox` (reward email)
7. Fire PostHog `promo_credits_awarded`
8. Clear cookie

**Response:**
```json
{
  "success": true,
  "credits_awarded": 10,
  "new_balance": 10
}
```

### `GET /api/credits/balance` - Get User Balance

Returns computed balance from ledger.

---

## Promo Flow (End-to-End)

```
User clicks Meta ad
    ↓
GET /promo?utm_source=meta&utm_campaign=blanklogo_10credits
    ↓
Server validates campaign, creates JWT, sets cookie
    ↓
User redirected to /signup (or /login)
    ↓
User completes magic link / email verification
    ↓
Auth callback triggers POST /api/promos/redeem
    ↓
Server validates token + anti-abuse → awards credits
    ↓
User sees "10 credits added!" in app
    ↓
Email sent: "Welcome! You earned 10 bonus credits"
```

---

## Reward Rules (Initial Set)

| Rule | Trigger Event | Credits | Max/User | Conditions |
|------|---------------|---------|----------|------------|
| Promo Signup | `promo_redeemed` | +10 | 1 | campaign active |
| Welcome Bonus | `auth_signed_in` | +3 | 1 | `is_new_user=true` |
| First Job Complete | `job_completed` | +2 | 1 | first job only |
| Referral Conversion | `referral_converted` | +25 | unlimited | per referred user |

---

## Anti-Abuse Controls

### Minimum (Day 1)
- [x] Only new accounts eligible for promo
- [x] Email verification required (magic link)
- [x] 1 redemption per user per campaign (unique constraint)
- [x] Rate limit redemption endpoint (10/min per IP)
- [x] Token expiration (7 days max)

### Stronger (Phase 2)
- [ ] Store `token_hash` - refuse reuse across accounts
- [ ] IP velocity check - max 5 new accounts per IP per day
- [ ] Device fingerprint (lightweight)
- [ ] Require first job within 24h to keep credits
- [ ] Manual review queue for suspicious patterns

---

## PostHog Events

### Promo Events
| Event | Properties |
|-------|------------|
| `promo_landing_viewed` | campaign_id, utm_source, utm_campaign, fbclid_present |
| `promo_token_issued` | campaign_id, expires_at |
| `promo_redeem_attempted` | campaign_id |
| `promo_credits_awarded` | campaign_id, credits, new_balance |
| `promo_redeem_blocked` | campaign_id, reason |

### Credit Events
| Event | Properties |
|-------|------------|
| `credits_awarded` | rule_id, credits_delta, reason, event_id |
| `credits_spent` | job_id, credits_delta, balance_after |
| `credits_balance_low` | balance, threshold |

### Notification Events
| Event | Properties |
|-------|------------|
| `reward_email_queued` | notification_id, type |
| `reward_email_sent` | notification_id, provider_message_id |
| `reward_email_failed` | notification_id, error_code, attempts |

---

## Golden Funnel (PostHog)

```
promo_landing_viewed 
  → auth_signed_in (is_new_user=true) 
  → promo_credits_awarded 
  → job_created 
  → job_completed
```

**Key metrics:**
- Promo → Signup conversion rate
- Signup → First job conversion rate
- Credits earned → Credits spent ratio
- Cost per activated user (ad spend / job_completed users)

---

## Email Templates

### `reward_earned` - Credits Awarded Email

**Subject:** "🎉 You earned {{credits}} bonus credits!"

**Body:**
```
Welcome to BlankLogo!

You've received {{credits}} bonus credits as part of our {{campaign_name}} promotion.

Your current balance: {{balance}} credits

Ready to remove your first watermark?
[Start Now →]

These credits are valid for watermark removal on any video platform.
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (This PR)
- [x] Database migration (all tables)
- [x] `/promo` landing route with JWT cookie
- [x] `/api/promos/redeem` endpoint
- [x] Credit balance computation
- [x] PostHog promo events
- [x] Basic rate limiting

### Phase 2: Reward Rules Engine
- [ ] Configurable rules via database
- [ ] Rewards worker for async processing
- [ ] Welcome bonus on verified signup
- [ ] First job completion bonus

### Phase 3: Notifications
- [ ] Notification outbox worker
- [ ] Resend integration for reward emails
- [ ] User notification preferences

### Phase 4: Anti-Abuse Hardening
- [ ] Token hash storage
- [ ] IP velocity tracking
- [ ] Device fingerprinting
- [ ] Manual review dashboard

---

## Testing Requirements

### Unit Tests
- JWT token creation/verification
- Ledger balance computation
- Rule condition evaluation

### Integration Tests
- Ledger + outbox atomicity (rollback on failure)
- Idempotency (same event = same outcome)
- Rate limiting enforcement

### E2E Tests
- Full promo flow: ad click → signup → credits → first job
- Double redemption blocked
- Expired token rejected

---

## Configuration

### Environment Variables

```env
# Promo JWT signing
PROMO_JWT_SECRET=<32+ char secret>

# Rate limiting
PROMO_RATE_LIMIT_PER_MINUTE=10

# Default promo settings
DEFAULT_PROMO_CREDITS=10
DEFAULT_PROMO_EXPIRY_DAYS=7
```

### Active Campaigns (Database)

```sql
INSERT INTO bl_promo_campaigns (id, name, credits_amount, utm_source, utm_campaign)
VALUES 
  ('blanklogo_10credits', 'Meta Launch Promo', 10, 'meta', 'blanklogo_10credits'),
  ('tiktok_launch', 'TikTok Launch', 10, 'tiktok', 'blanklogo_tiktok');
```

---

## Safe Ad Copy Examples

✅ **Allowed:**
- "Get 10 bonus credits when you create your account today"
- "Limited-time: new accounts only"
- "Credits apply to your first watermark removal jobs"

❌ **Avoid (violates Meta policy):**
- "Click this ad to get 10 credits"
- "Tap the ad for free credits"
- "Watch this ad for rewards"

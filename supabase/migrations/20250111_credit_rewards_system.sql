-- Credit Rewards System Migration
-- Creates tables for secure, auditable credit rewards with anti-fraud controls

-- 1. Reward Rules - Configurable reward definitions
CREATE TABLE IF NOT EXISTS bl_reward_rules (
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

-- 2. App Events - Trusted server-verified events
CREATE TABLE IF NOT EXISTS bl_app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('vercel_api', 'worker', 'stripe_webhook', 'supabase_trigger')),
  properties JSONB DEFAULT '{}',
  dedupe_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bl_app_events_user ON bl_app_events(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_app_events_name ON bl_app_events(event_name);
CREATE INDEX IF NOT EXISTS idx_bl_app_events_time ON bl_app_events(event_time);

-- 3. Credit Ledger - All credit transactions (auditable)
CREATE TABLE IF NOT EXISTS bl_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  rule_id UUID REFERENCES bl_reward_rules(id),
  event_id UUID REFERENCES bl_app_events(id),
  campaign_id TEXT,
  job_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent double-awarding same reward for same event
CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_credit_ledger_rule_event 
  ON bl_credit_ledger(rule_id, event_id) 
  WHERE rule_id IS NOT NULL AND event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_user ON bl_credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_reason ON bl_credit_ledger(reason);
CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_created ON bl_credit_ledger(created_at);

-- 4. Promo Campaigns - Marketing campaigns
CREATE TABLE IF NOT EXISTS bl_promo_campaigns (
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

-- 5. Promo Redemptions - Prevents double-claim
CREATE TABLE IF NOT EXISTS bl_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL REFERENCES bl_promo_campaigns(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bl_promo_redemptions_token ON bl_promo_redemptions(token_hash);
CREATE INDEX IF NOT EXISTS idx_bl_promo_redemptions_ip ON bl_promo_redemptions(ip_hash);

-- 6. Notification Outbox - Reliable email delivery
CREATE TABLE IF NOT EXISTS bl_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_bl_notification_outbox_pending 
  ON bl_notification_outbox(status, next_attempt_at) 
  WHERE status = 'pending';

-- 7. View: Credit Balance (computed from ledger)
CREATE OR REPLACE VIEW bl_credit_balance_view AS
SELECT 
  user_id,
  COALESCE(SUM(delta), 0)::INTEGER AS balance,
  COUNT(*) AS transaction_count,
  MAX(created_at) AS last_transaction_at
FROM bl_credit_ledger
GROUP BY user_id;

-- 8. Function: Get credit balance for a user
CREATE OR REPLACE FUNCTION bl_get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM bl_credit_ledger
  WHERE user_id = p_user_id;
  
  RETURN v_balance;
END;
$$;

-- 9. Function: Award credits (with idempotency)
CREATE OR REPLACE FUNCTION bl_award_credits(
  p_user_id UUID,
  p_delta INTEGER,
  p_reason TEXT,
  p_rule_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_campaign_id TEXT DEFAULT NULL,
  p_job_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  ledger_id UUID,
  new_balance INTEGER,
  was_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ledger_id UUID;
  v_new_balance INTEGER;
  v_existing_id UUID;
BEGIN
  -- Check for duplicate (idempotency)
  IF p_rule_id IS NOT NULL AND p_event_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM bl_credit_ledger
    WHERE rule_id = p_rule_id AND event_id = p_event_id;
    
    IF v_existing_id IS NOT NULL THEN
      -- Return existing balance, mark as duplicate
      SELECT COALESCE(SUM(delta), 0) INTO v_new_balance
      FROM bl_credit_ledger WHERE user_id = p_user_id;
      
      RETURN QUERY SELECT v_existing_id, v_new_balance, true;
      RETURN;
    END IF;
  END IF;

  -- Insert new ledger entry
  INSERT INTO bl_credit_ledger (user_id, delta, reason, rule_id, event_id, campaign_id, job_id, metadata)
  VALUES (p_user_id, p_delta, p_reason, p_rule_id, p_event_id, p_campaign_id, p_job_id, p_metadata)
  RETURNING id INTO v_ledger_id;
  
  -- Get new balance
  SELECT COALESCE(SUM(delta), 0) INTO v_new_balance
  FROM bl_credit_ledger WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT v_ledger_id, v_new_balance, false;
END;
$$;

-- 10. Function: Redeem promo (atomic operation)
CREATE OR REPLACE FUNCTION bl_redeem_promo(
  p_user_id UUID,
  p_campaign_id TEXT,
  p_token_hash TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent_hash TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  credits_awarded INTEGER,
  new_balance INTEGER,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign RECORD;
  v_user_created_at TIMESTAMPTZ;
  v_existing_redemption UUID;
  v_event_id UUID;
  v_ledger_result RECORD;
BEGIN
  -- 1. Get campaign
  SELECT * INTO v_campaign
  FROM bl_promo_campaigns
  WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'campaign_not_found'::TEXT;
    RETURN;
  END IF;
  
  -- 2. Check campaign active
  IF NOT v_campaign.enabled THEN
    RETURN QUERY SELECT false, 0, 0, 'campaign_disabled'::TEXT;
    RETURN;
  END IF;
  
  IF v_campaign.starts_at > NOW() THEN
    RETURN QUERY SELECT false, 0, 0, 'campaign_not_started'::TEXT;
    RETURN;
  END IF;
  
  IF v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at < NOW() THEN
    RETURN QUERY SELECT false, 0, 0, 'campaign_expired'::TEXT;
    RETURN;
  END IF;
  
  -- 3. Check max redemptions
  IF v_campaign.max_redemptions IS NOT NULL 
     AND v_campaign.current_redemptions >= v_campaign.max_redemptions THEN
    RETURN QUERY SELECT false, 0, 0, 'campaign_maxed'::TEXT;
    RETURN;
  END IF;
  
  -- 4. Check user is new (created within 7 days)
  SELECT created_at INTO v_user_created_at
  FROM auth.users WHERE id = p_user_id;
  
  IF v_user_created_at < NOW() - INTERVAL '7 days' THEN
    RETURN QUERY SELECT false, 0, 0, 'user_not_new'::TEXT;
    RETURN;
  END IF;
  
  -- 5. Check no prior redemption
  SELECT id INTO v_existing_redemption
  FROM bl_promo_redemptions
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 'already_redeemed'::TEXT;
    RETURN;
  END IF;
  
  -- 6. All checks passed - perform redemption atomically
  
  -- Insert redemption record
  INSERT INTO bl_promo_redemptions (campaign_id, user_id, token_hash, ip_hash, user_agent_hash)
  VALUES (p_campaign_id, p_user_id, p_token_hash, p_ip_hash, p_user_agent_hash);
  
  -- Insert app event
  INSERT INTO bl_app_events (user_id, event_name, source, properties, dedupe_key)
  VALUES (
    p_user_id, 
    'promo_redeemed', 
    'vercel_api',
    jsonb_build_object('campaign_id', p_campaign_id, 'credits', v_campaign.credits_amount),
    'promo:' || p_campaign_id || ':' || p_user_id::TEXT
  )
  RETURNING id INTO v_event_id;
  
  -- Award credits
  SELECT * INTO v_ledger_result
  FROM bl_award_credits(
    p_user_id,
    v_campaign.credits_amount,
    'promo_signup',
    NULL,
    v_event_id,
    p_campaign_id
  );
  
  -- Increment campaign redemption count
  UPDATE bl_promo_campaigns
  SET current_redemptions = current_redemptions + 1
  WHERE id = p_campaign_id;
  
  -- Queue notification
  INSERT INTO bl_notification_outbox (user_id, type, payload, dedupe_key)
  VALUES (
    p_user_id,
    'reward_earned_email',
    jsonb_build_object(
      'credits_delta', v_campaign.credits_amount,
      'reason', 'promo_signup',
      'campaign_id', p_campaign_id,
      'campaign_name', v_campaign.name,
      'balance_after', v_ledger_result.new_balance
    ),
    'reward_email:promo:' || p_campaign_id || ':' || p_user_id::TEXT
  );
  
  RETURN QUERY SELECT true, v_campaign.credits_amount, v_ledger_result.new_balance, NULL::TEXT;
END;
$$;

-- 11. RLS Policies

-- Enable RLS
ALTER TABLE bl_app_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_reward_rules ENABLE ROW LEVEL SECURITY;

-- Users can read their own events
CREATE POLICY "Users can read own events" ON bl_app_events
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own ledger
CREATE POLICY "Users can read own ledger" ON bl_credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own redemptions
CREATE POLICY "Users can read own redemptions" ON bl_promo_redemptions
  FOR SELECT USING (auth.uid() = user_id);

-- Everyone can read active campaigns
CREATE POLICY "Anyone can read active campaigns" ON bl_promo_campaigns
  FOR SELECT USING (enabled = true);

-- Reward rules are read-only for everyone (admin manages via dashboard)
CREATE POLICY "Anyone can read enabled rules" ON bl_reward_rules
  FOR SELECT USING (enabled = true);

-- Notification outbox is internal only (no user access)
-- Service role handles all operations

-- 12. Seed initial promo campaign
INSERT INTO bl_promo_campaigns (id, name, credits_amount, utm_source, utm_campaign, enabled)
VALUES 
  ('blanklogo_10credits', 'Meta Launch Promo', 10, 'meta', 'blanklogo_10credits', true),
  ('tiktok_launch', 'TikTok Launch Promo', 10, 'tiktok', 'blanklogo_tiktok', true),
  ('welcome_bonus', 'Welcome Bonus', 3, NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- 13. Seed initial reward rules
INSERT INTO bl_reward_rules (name, trigger_event, credits_delta, conditions, max_awards_per_user, enabled)
VALUES 
  ('Welcome Bonus', 'auth_signed_in', 3, '{"is_new_user": true}', 1, true),
  ('First Job Bonus', 'job_completed', 2, '{"is_first_job": true}', 1, true)
ON CONFLICT DO NOTHING;

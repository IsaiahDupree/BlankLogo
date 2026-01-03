-- BlankLogo Auth Profiles & Sessions Migration
-- Supports full auth lifecycle: signup, verification, sessions, deletion

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS bl_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  
  -- Subscription & Credits
  subscription_tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  credits_balance INTEGER DEFAULT 0,
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_suspended BOOLEAN DEFAULT false,
  suspended_reason TEXT,
  suspended_at TIMESTAMPTZ,
  
  -- Deletion workflow (soft delete with grace period)
  deletion_requested_at TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- Consent & preferences
  marketing_consent BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions tracking table
CREATE TABLE IF NOT EXISTS bl_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session info
  device_name TEXT,
  device_type TEXT, -- 'mobile', 'desktop', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  
  -- Location (optional)
  country TEXT,
  city TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Login history / audit log
CREATE TABLE IF NOT EXISTS bl_auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event info
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'email_change', 'mfa_enabled', etc.
  event_status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed', 'blocked'
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  -- Additional data
  metadata JSONB,
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account deletion requests (for GDPR compliance)
CREATE TABLE IF NOT EXISTS bl_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Request info
  request_type TEXT NOT NULL DEFAULT 'full_delete', -- 'full_delete', 'data_export', 'deactivate'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  
  -- Scheduling
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Audit
  processed_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bl_profiles_subscription ON bl_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_bl_profiles_deletion ON bl_profiles(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bl_sessions_user ON bl_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_sessions_active ON bl_sessions(user_id, last_active_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bl_auth_events_user ON bl_auth_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bl_auth_events_type ON bl_auth_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bl_deletion_requests_status ON bl_deletion_requests(status, scheduled_for);

-- RLS Policies
ALTER TABLE bl_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON bl_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON bl_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Sessions: Users can view/delete their own sessions
CREATE POLICY "Users can view own sessions" ON bl_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON bl_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Auth events: Users can view their own events
CREATE POLICY "Users can view own auth events" ON bl_auth_events
  FOR SELECT USING (auth.uid() = user_id);

-- Deletion requests: Users can view/manage their own requests
CREATE POLICY "Users can view own deletion requests" ON bl_deletion_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deletion requests" ON bl_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel own deletion requests" ON bl_deletion_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bl_profiles (id, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_status TEXT DEFAULT 'success',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO bl_auth_events (user_id, event_type, event_status, ip_address, user_agent, metadata, error_message)
  VALUES (p_user_id, p_event_type, p_event_status, p_ip_address, p_user_agent, p_metadata, p_error_message)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process scheduled deletions (run via cron)
CREATE OR REPLACE FUNCTION process_scheduled_deletions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT id FROM bl_profiles
    WHERE deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= NOW()
      AND deleted_at IS NULL
  LOOP
    -- Mark as deleted (soft delete)
    UPDATE bl_profiles
    SET deleted_at = NOW(), is_active = false
    WHERE id = v_user.id;
    
    -- Update deletion request
    UPDATE bl_deletion_requests
    SET status = 'completed', processed_at = NOW()
    WHERE user_id = v_user.id AND status = 'pending';
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

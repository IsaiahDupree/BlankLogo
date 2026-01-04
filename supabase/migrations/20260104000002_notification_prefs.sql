-- User notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_job_started BOOLEAN DEFAULT false,
  email_job_completed BOOLEAN DEFAULT true,
  email_job_failed BOOLEAN DEFAULT true,
  email_credits_low BOOLEAN DEFAULT true,
  email_account_status BOOLEAN DEFAULT true,
  marketing_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own preferences
CREATE POLICY "Users can view own prefs" ON user_notification_prefs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prefs" ON user_notification_prefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prefs" ON user_notification_prefs
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can access all (for worker to read prefs)
CREATE POLICY "Service can read all prefs" ON user_notification_prefs
  FOR SELECT TO service_role USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON user_notification_prefs(user_id);

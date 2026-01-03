-- BlankLogo Database Schema
-- Watermark removal service tables

-- Jobs table - stores all watermark removal jobs
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    batch_id TEXT,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    
    -- Input
    input_url TEXT NOT NULL,
    input_filename TEXT,
    input_size_bytes BIGINT,
    input_duration_sec NUMERIC(10,2),
    
    -- Processing config
    crop_pixels INTEGER DEFAULT 100,
    crop_position TEXT DEFAULT 'bottom' CHECK (crop_position IN ('top', 'bottom', 'left', 'right')),
    platform TEXT DEFAULT 'custom',
    
    -- Output
    output_url TEXT,
    output_filename TEXT,
    output_size_bytes BIGINT,
    
    -- Webhook
    webhook_url TEXT,
    webhook_sent_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    api_key TEXT UNIQUE,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    credits_remaining INTEGER DEFAULT 10,
    credits_used_total INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    job_id TEXT REFERENCES jobs(id),
    action TEXT,
    credits_used INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform presets (for admin configuration)
CREATE TABLE IF NOT EXISTS platform_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    crop_pixels INTEGER DEFAULT 100,
    crop_position TEXT DEFAULT 'bottom',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default platform presets
INSERT INTO platform_presets (id, name, description, crop_pixels, crop_position) VALUES
    ('sora', 'Sora', 'OpenAI Sora text-to-video', 100, 'bottom'),
    ('tiktok', 'TikTok', 'TikTok video watermarks', 80, 'bottom'),
    ('runway', 'Runway', 'Runway Gen-2 videos', 60, 'bottom'),
    ('pika', 'Pika', 'Pika Labs AI videos', 50, 'bottom'),
    ('kling', 'Kling', 'Kuaishou Kling AI', 70, 'bottom'),
    ('luma', 'Luma', 'Luma Dream Machine', 55, 'bottom'),
    ('midjourney', 'Midjourney', 'Midjourney video output', 40, 'bottom'),
    ('custom', 'Custom', 'Custom crop settings', 100, 'bottom')
ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_batch_id ON jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_user_profiles_api_key ON user_profiles(api_key);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- RLS Policies
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Jobs: Users can only see their own jobs
CREATE POLICY "Users can view own jobs" ON jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs" ON jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- User profiles: Users can only see/update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Usage logs: Users can only see their own usage
CREATE POLICY "Users can view own usage" ON usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Function to generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'bl_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, api_key)
    VALUES (NEW.id, NEW.email, generate_api_key());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to decrement credits on job creation
CREATE OR REPLACE FUNCTION decrement_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_profiles
    SET credits_remaining = credits_remaining - 1,
        credits_used_total = credits_used_total + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id
    AND credits_remaining > 0;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;
    
    INSERT INTO usage_logs (user_id, job_id, action, credits_used)
    VALUES (NEW.user_id, NEW.id, 'job_created', 1);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to decrement credits when job is created
DROP TRIGGER IF EXISTS on_job_created ON jobs;
CREATE TRIGGER on_job_created
    AFTER INSERT ON jobs
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION decrement_user_credits();

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Authenticated upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.role() = 'authenticated');

CREATE POLICY "Service role full access" ON storage.objects
    FOR ALL USING (bucket_id = 'videos' AND auth.role() = 'service_role');

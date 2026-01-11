-- BlankLogo Database Schema
-- Watermark removal service tables
-- Prefixed with bl_ to avoid conflicts with existing tables

-- Jobs table - stores all watermark removal jobs
CREATE TABLE IF NOT EXISTS bl_jobs (
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
    processing_mode TEXT DEFAULT 'crop' CHECK (processing_mode IN ('crop', 'inpaint', 'auto')),
    
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
CREATE TABLE IF NOT EXISTS bl_user_profiles (
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
CREATE TABLE IF NOT EXISTS bl_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    job_id TEXT REFERENCES bl_jobs(id),
    action TEXT,
    credits_used INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform presets (for admin configuration)
CREATE TABLE IF NOT EXISTS bl_platform_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    crop_pixels INTEGER DEFAULT 100,
    crop_position TEXT DEFAULT 'bottom',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default platform presets
INSERT INTO bl_platform_presets (id, name, description, crop_pixels, crop_position) VALUES
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
CREATE INDEX IF NOT EXISTS idx_bl_jobs_user_id ON bl_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_jobs_status ON bl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bl_jobs_created_at ON bl_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bl_jobs_batch_id ON bl_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_bl_jobs_platform ON bl_jobs(platform);
CREATE INDEX IF NOT EXISTS idx_bl_user_profiles_api_key ON bl_user_profiles(api_key);
CREATE INDEX IF NOT EXISTS idx_bl_usage_logs_user_id ON bl_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_usage_logs_created_at ON bl_usage_logs(created_at DESC);

-- RLS Policies
ALTER TABLE bl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_usage_logs ENABLE ROW LEVEL SECURITY;

-- Jobs: Users can only see their own jobs
CREATE POLICY "bl_users_view_own_jobs" ON bl_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bl_users_create_own_jobs" ON bl_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "bl_users_update_own_jobs" ON bl_jobs
    FOR UPDATE USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Service role can do everything on bl_jobs
CREATE POLICY "bl_service_role_all_jobs" ON bl_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- User profiles: Users can only see/update their own profile
CREATE POLICY "bl_users_view_own_profile" ON bl_user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "bl_users_update_own_profile" ON bl_user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Usage logs: Users can only see their own usage
CREATE POLICY "bl_users_view_own_usage" ON bl_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Function to generate BlankLogo API key
CREATE OR REPLACE FUNCTION public.bl_generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'bl_' || encode(extensions.gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Function to create user profile on signup (BlankLogo specific)
CREATE OR REPLACE FUNCTION public.bl_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.bl_user_profiles (id, email, api_key)
    VALUES (NEW.id, NEW.email, public.bl_generate_api_key())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Trigger to create BlankLogo profile on user signup
DROP TRIGGER IF EXISTS bl_on_auth_user_created ON auth.users;
CREATE TRIGGER bl_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION bl_handle_new_user();

-- Function to decrement credits on BlankLogo job creation
CREATE OR REPLACE FUNCTION bl_decrement_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bl_user_profiles
    SET credits_remaining = credits_remaining - 1,
        credits_used_total = credits_used_total + 1,
        updated_at = NOW()
    WHERE id = NEW.user_id
    AND credits_remaining > 0;
    
    IF NOT FOUND AND NEW.user_id IS NOT NULL THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;
    
    IF NEW.user_id IS NOT NULL THEN
        INSERT INTO bl_usage_logs (user_id, job_id, action, credits_used)
        VALUES (NEW.user_id, NEW.id, 'job_created', 1);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to decrement credits when BlankLogo job is created
DROP TRIGGER IF EXISTS bl_on_job_created ON bl_jobs;
CREATE TRIGGER bl_on_job_created
    AFTER INSERT ON bl_jobs
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION bl_decrement_user_credits();

-- Storage bucket for videos (BlankLogo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('bl_videos', 'bl_videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for BlankLogo videos
DROP POLICY IF EXISTS "bl_public_read_access" ON storage.objects;
CREATE POLICY "bl_public_read_access" ON storage.objects
    FOR SELECT USING (bucket_id = 'bl_videos');

DROP POLICY IF EXISTS "bl_authenticated_upload" ON storage.objects;
CREATE POLICY "bl_authenticated_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'bl_videos');

DROP POLICY IF EXISTS "bl_service_role_full_access" ON storage.objects;
CREATE POLICY "bl_service_role_full_access" ON storage.objects
    FOR ALL USING (bucket_id = 'bl_videos' AND auth.role() = 'service_role');

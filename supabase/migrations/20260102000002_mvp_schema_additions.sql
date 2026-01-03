-- ============================================
-- BlankLogo MVP Schema Additions
-- project_inputs, template_packs, job_events, user voices
-- ============================================

-- ============================================
-- 1. PROJECT INPUTS (user-provided content)
-- ============================================
CREATE TABLE IF NOT EXISTS public.project_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Input type: 'text', 'file', 'url'
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'file', 'url')),
  
  -- For text input
  raw_text TEXT,
  
  -- For file input (stored in Supabase Storage)
  file_path TEXT,
  file_name TEXT,
  file_type TEXT, -- 'pdf', 'docx', 'txt', etc.
  file_size_bytes BIGINT,
  
  -- For URL input
  source_url TEXT,
  
  -- Extracted/processed content
  extracted_text TEXT,
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_error TEXT,
  
  -- Metadata
  word_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TEMPLATE PACKS (Remotion compositions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_packs (
  id TEXT PRIMARY KEY, -- e.g., 'minimal', 'cinematic', 'chalkboard'
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  
  -- Remotion composition ID
  composition_id TEXT NOT NULL,
  
  -- Styling defaults
  default_fps INT DEFAULT 30,
  default_resolution TEXT DEFAULT '1080p',
  
  -- Feature flags
  supports_captions BOOLEAN DEFAULT TRUE,
  supports_broll BOOLEAN DEFAULT FALSE,
  supports_transitions BOOLEAN DEFAULT TRUE,
  
  -- Pricing
  is_premium BOOLEAN DEFAULT FALSE,
  credit_multiplier DECIMAL(3,2) DEFAULT 1.0, -- 1.0 = standard, 1.5 = 50% more credits
  
  -- Ordering
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default templates
INSERT INTO public.template_packs (id, name, description, composition_id, sort_order) VALUES
  ('minimal', 'Clean Minimal', 'Simple, distraction-free style with focus on content', 'BlankLogoVideo', 0),
  ('cinematic', 'Cinematic', 'Movie-like feel with dramatic transitions', 'BlankLogoVideo', 1),
  ('documentary', 'Documentary', 'Ken Burns style with subtle motion', 'BlankLogoVideo', 2),
  ('educational', 'Educational', 'Clear visuals with text overlays', 'BlankLogoVideo', 3),
  ('energetic', 'Energetic', 'Fast-paced cuts for engaging content', 'BlankLogoVideo', 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. JOB EVENTS (detailed pipeline logging)
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL, -- 'step_started', 'step_completed', 'step_failed', 'retry', 'warning'
  step_name TEXT, -- 'scripting', 'tts', 'whisper', 'images', 'timeline', 'render', 'packaging'
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Details
  message TEXT,
  metadata JSONB DEFAULT '{}', -- step-specific data (tokens used, images generated, etc.)
  
  -- Errors
  error_code TEXT,
  error_message TEXT,
  stack_trace TEXT,
  
  -- Retry info
  attempt_number INT DEFAULT 1,
  will_retry BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying job history
CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON public.job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_step ON public.job_events(job_id, step_name);

-- ============================================
-- 4. USER VOICES (voice cloning)
-- ============================================
-- Note: voice_profiles already exists, but let's add more fields
ALTER TABLE public.voice_profiles
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'indextts' CHECK (provider IN ('indextts', 'elevenlabs', 'openai', 'custom')),
  ADD COLUMN IF NOT EXISTS training_audio_path TEXT,
  ADD COLUMN IF NOT EXISTS training_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS model_id TEXT, -- External model ID if using a service
  ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip TEXT;

-- ============================================
-- 5. VISUAL STYLE PRESETS
-- ============================================
CREATE TABLE IF NOT EXISTS public.visual_presets (
  id TEXT PRIMARY KEY, -- e.g., 'photorealistic', 'illustration', 'minimalist'
  name TEXT NOT NULL,
  description TEXT,
  
  -- OpenAI image generation settings
  image_model TEXT DEFAULT 'dall-e-3',
  image_style TEXT DEFAULT 'vivid', -- 'vivid' or 'natural'
  image_quality TEXT DEFAULT 'standard', -- 'standard' or 'hd'
  
  -- Prompt modifiers
  prompt_prefix TEXT, -- Prepended to all image prompts
  prompt_suffix TEXT, -- Appended to all image prompts
  negative_prompt TEXT, -- Things to avoid
  
  -- Pricing
  credit_modifier DECIMAL(3,2) DEFAULT 0.0, -- Additional credits per minute
  
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default presets
INSERT INTO public.visual_presets (id, name, description, image_style, prompt_prefix, credit_modifier, sort_order) VALUES
  ('photorealistic', 'Photorealistic', 'Realistic, photo-quality images', 'natural', 'photorealistic, high quality, ', 0.0, 0),
  ('illustration', 'Illustrated', 'Digital art illustration style', 'vivid', 'digital illustration, artistic, ', 0.0, 1),
  ('minimalist', 'Minimalist', 'Clean, simple graphics', 'natural', 'minimalist, clean, simple, ', 0.0, 2),
  ('cinematic', 'Cinematic', 'Movie-like dramatic lighting', 'vivid', 'cinematic lighting, dramatic, film still, ', 0.3, 3),
  ('anime', 'Anime Style', 'Japanese anime aesthetic', 'vivid', 'anime style, manga, Japanese animation, ', 0.0, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. META EVENTS LOG (for Pixel/CAPI)
-- ============================================
CREATE TABLE IF NOT EXISTS public.meta_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Event details
  event_name TEXT NOT NULL, -- 'Purchase', 'InitiateCheckout', 'CompleteRegistration', etc.
  event_time TIMESTAMPTZ DEFAULT NOW(),
  
  -- Attribution
  fbc TEXT, -- Facebook click ID (from cookie)
  fbp TEXT, -- Facebook browser ID (from cookie)
  
  -- Event data
  event_data JSONB DEFAULT '{}',
  custom_data JSONB DEFAULT '{}',
  
  -- CAPI send status
  sent_to_capi BOOLEAN DEFAULT FALSE,
  capi_response JSONB,
  capi_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for CAPI batch processing
CREATE INDEX IF NOT EXISTS idx_meta_events_unsent ON public.meta_event_log(sent_to_capi) WHERE sent_to_capi = FALSE;

-- ============================================
-- 7. RATE LIMITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Limit type
  limit_type TEXT NOT NULL, -- 'generation', 'image', 'tts', 'api'
  
  -- Window tracking
  window_start TIMESTAMPTZ NOT NULL,
  window_duration_seconds INT NOT NULL DEFAULT 3600, -- 1 hour default
  
  -- Usage
  count INT DEFAULT 0,
  max_count INT NOT NULL,
  
  -- Metadata
  last_request_at TIMESTAMPTZ,
  
  UNIQUE(user_id, limit_type, window_start)
);

-- ============================================
-- 8. ADD TEMPLATE + STYLE TO PROJECTS
-- ============================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS template_id TEXT REFERENCES public.template_packs(id) DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS visual_preset_id TEXT REFERENCES public.visual_presets(id) DEFAULT 'photorealistic',
  ADD COLUMN IF NOT EXISTS voice_profile_id UUID REFERENCES public.voice_profiles(id),
  ADD COLUMN IF NOT EXISTS image_density TEXT DEFAULT 'normal' CHECK (image_density IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS target_resolution TEXT DEFAULT '1080p' CHECK (target_resolution IN ('720p', '1080p', '4k'));

-- ============================================
-- RLS POLICIES
-- ============================================

-- Project inputs
ALTER TABLE public.project_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project inputs"
  ON public.project_inputs FOR ALL
  USING (auth.uid() = user_id);

-- Job events (read-only for users)
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own job events"
  ON public.job_events FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE user_id = auth.uid()
    )
  );

-- Rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Meta events
ALTER TABLE public.meta_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own meta events"
  ON public.meta_event_log FOR SELECT
  USING (auth.uid() = user_id);

-- Template packs and visual presets are public read
ALTER TABLE public.template_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read templates"
  ON public.template_packs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read visual presets"
  ON public.visual_presets FOR SELECT
  USING (true);

-- ============================================
-- HELPER FUNCTION: Check rate limit
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_limit_type TEXT,
  p_max_count INT DEFAULT 10,
  p_window_seconds INT DEFAULT 3600
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INT;
BEGIN
  -- Calculate current window start
  v_window_start := date_trunc('hour', NOW());
  
  -- Get or create rate limit record
  INSERT INTO public.rate_limits (user_id, limit_type, window_start, window_duration_seconds, count, max_count, last_request_at)
  VALUES (p_user_id, p_limit_type, v_window_start, p_window_seconds, 1, p_max_count, NOW())
  ON CONFLICT (user_id, limit_type, window_start) DO UPDATE
  SET 
    count = rate_limits.count + 1,
    last_request_at = NOW()
  RETURNING count INTO v_current_count;
  
  -- Check if over limit
  RETURN v_current_count <= p_max_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.project_inputs IS 'User-provided content for video generation (text, files, URLs)';
COMMENT ON TABLE public.template_packs IS 'Remotion video templates/compositions';
COMMENT ON TABLE public.job_events IS 'Detailed pipeline step logging for debugging';
COMMENT ON TABLE public.visual_presets IS 'Image generation style presets';
COMMENT ON TABLE public.meta_event_log IS 'Facebook/Meta Pixel and CAPI event tracking';
COMMENT ON TABLE public.rate_limits IS 'Per-user rate limiting for API/generation';

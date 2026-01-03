-- ============================================
-- Align schema with Worker Pipeline Spec
-- ============================================

-- Add title column to project_inputs (as per spec)
ALTER TABLE public.project_inputs
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Rename columns in project_inputs to match spec
-- input_type -> type, raw_text -> content_text, file_path -> storage_path
DO $$
BEGIN
  -- Rename input_type to type if not already renamed
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'project_inputs' AND column_name = 'input_type') THEN
    ALTER TABLE public.project_inputs RENAME COLUMN input_type TO type;
  END IF;
  
  -- Rename raw_text to content_text
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'project_inputs' AND column_name = 'raw_text') THEN
    ALTER TABLE public.project_inputs RENAME COLUMN raw_text TO content_text;
  END IF;
  
  -- Rename file_path to storage_path
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'project_inputs' AND column_name = 'file_path') THEN
    ALTER TABLE public.project_inputs RENAME COLUMN file_path TO storage_path;
  END IF;
END $$;

-- Add meta column to project_inputs
ALTER TABLE public.project_inputs
  ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';

-- Add stage column to job_events (matching job status values)
ALTER TABLE public.job_events
  ADD COLUMN IF NOT EXISTS stage TEXT;

-- Update job_events to copy step_name to stage where applicable
UPDATE public.job_events 
SET stage = UPPER(step_name) 
WHERE stage IS NULL AND step_name IS NOT NULL;

-- Add worker_id and claimed_at to jobs table for job claiming
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- ============================================
-- Storage bucket policies (run via Supabase dashboard or seed)
-- ============================================
-- Note: Storage buckets are created via Supabase dashboard or seed.sql
-- Buckets needed:
--   - project-assets (private, for intermediate files)
--   - project-outputs (private, for final deliverables)

-- ============================================
-- Claim job function (atomic job claiming)
-- ============================================
DROP FUNCTION IF EXISTS public.claim_next_job(TEXT);
CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Atomically claim the oldest QUEUED job
  UPDATE public.jobs
  SET 
    status = 'CLAIMED',
    worker_id = p_worker_id,
    claimed_at = NOW(),
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT id FROM public.jobs
    WHERE status = 'QUEUED'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_job_id;
  
  -- Log the claim event
  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.job_events (job_id, stage, message, meta)
    VALUES (v_job_id, 'CLAIMED', 'Job claimed by worker', jsonb_build_object('worker_id', p_worker_id));
  END IF;
  
  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Release job credits function (on failure)
-- ============================================
CREATE OR REPLACE FUNCTION public.release_job_credits(p_job_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_reserved_credits INT;
BEGIN
  -- Get user and reserved credits
  SELECT user_id, cost_credits_reserved INTO v_user_id, v_reserved_credits
  FROM public.jobs WHERE id = p_job_id;
  
  IF v_user_id IS NOT NULL AND v_reserved_credits > 0 THEN
    -- Credit back the reserved amount
    INSERT INTO public.credit_ledger (user_id, delta, reason, job_id)
    VALUES (v_user_id, v_reserved_credits, 'job_failed_refund', p_job_id);
    
    -- Clear reserved credits on job
    UPDATE public.jobs SET cost_credits_reserved = 0 WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comments
-- ============================================
COMMENT ON FUNCTION public.claim_next_job IS 'Atomically claim the next QUEUED job for a worker';
COMMENT ON FUNCTION public.release_job_credits IS 'Release reserved credits back to user on job failure';

-- ============================================
-- Enhanced job claiming with per-user concurrency limiting
-- ============================================

-- 1) Add attempt_count column if missing
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;

-- 2) Add indexes for efficient job claiming
CREATE INDEX IF NOT EXISTS jobs_status_created_idx
  ON public.jobs(status, created_at);

CREATE INDEX IF NOT EXISTS jobs_user_status_idx
  ON public.jobs(user_id, status);

-- 3) Drop existing function and recreate with enhanced logic
DROP FUNCTION IF EXISTS public.claim_next_job(TEXT);
DROP FUNCTION IF EXISTS public.claim_next_job(TEXT, INT);

CREATE OR REPLACE FUNCTION public.claim_next_job(
  p_worker_id TEXT,
  p_max_active_per_user INT DEFAULT 1
)
RETURNS TABLE(job_id UUID, user_id UUID, project_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
BEGIN
  /*
    Picks the oldest QUEUED job where the user has < p_max_active_per_user active jobs,
    and claims it using FOR UPDATE SKIP LOCKED so multiple workers can't grab same job.
  */

  SELECT j.id, j.user_id, j.project_id
    INTO v_job
  FROM public.jobs j
  WHERE j.status = 'QUEUED'
    AND (
      SELECT COUNT(*)
      FROM public.jobs a
      WHERE a.user_id = j.user_id
        AND a.status IN ('CLAIMED','SCRIPTING','VOICE_GEN','ALIGNMENT','VISUAL_PLAN','IMAGE_GEN','TIMELINE_BUILD','RENDERING','PACKAGING')
    ) < GREATEST(p_max_active_per_user, 1)
  ORDER BY j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.jobs
  SET status = 'CLAIMED',
      worker_id = p_worker_id,
      claimed_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      progress = GREATEST(COALESCE(progress, 0), 1),
      attempt_count = attempt_count + 1,
      updated_at = NOW()
  WHERE id = v_job.id;

  -- Log the claim event
  INSERT INTO public.job_events (job_id, stage, message, meta)
  VALUES (v_job.id, 'CLAIMED', 'Job claimed by worker', jsonb_build_object('worker_id', p_worker_id));

  job_id := v_job.id;
  user_id := v_job.user_id;
  project_id := v_job.project_id;
  RETURN NEXT;
END;
$$;

-- 4) Add level column to job_events for log severity
ALTER TABLE public.job_events
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug'));

-- 5) Restrict function to service role only
REVOKE ALL ON FUNCTION public.claim_next_job(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job(TEXT, INT) TO service_role;

-- 6) Helper function to insert job events
CREATE OR REPLACE FUNCTION public.insert_job_event(
  p_job_id UUID,
  p_stage TEXT,
  p_message TEXT,
  p_level TEXT DEFAULT 'info',
  p_meta JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.job_events (job_id, stage, message, level, meta)
  VALUES (p_job_id, p_stage, p_message, p_level, p_meta)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_job_event(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;

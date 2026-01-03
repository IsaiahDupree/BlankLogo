-- ============================================
-- Stale Recovery: heartbeat + requeue RPC
-- ============================================

-- 1) Ensure a heartbeat column exists (worker updates this)
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

-- 2) updated_at trigger helper (safe if it already exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_updated_at ON public.jobs;
CREATE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Requeue stale jobs that haven't heartbeated in N minutes
CREATE OR REPLACE FUNCTION public.requeue_stale_jobs(
  p_stale_minutes INT DEFAULT 15,
  p_max_attempts INT DEFAULT 3
)
RETURNS TABLE(requeued_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH stale AS (
    SELECT id
    FROM public.jobs
    WHERE status IN ('CLAIMED','SCRIPTING','VOICE_GEN','ALIGNMENT','VISUAL_PLAN','IMAGE_GEN','TIMELINE_BUILD','RENDERING','PACKAGING')
      AND COALESCE(heartbeat_at, claimed_at, updated_at, created_at) < NOW() - MAKE_INTERVAL(mins => GREATEST(p_stale_minutes, 1))
      AND attempt_count < GREATEST(p_max_attempts, 1)
  )
  UPDATE public.jobs j
  SET status = 'QUEUED',
      worker_id = NULL,
      claimed_at = NULL,
      heartbeat_at = NULL,
      progress = GREATEST(COALESCE(progress, 0), 1),
      error_code = NULL,
      error_message = NULL
  FROM stale
  WHERE j.id = stale.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  requeued_count := v_count;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_stale_jobs(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_jobs(INT, INT) TO service_role;

-- 4) Add RLS policy for project_inputs (user can manage own inputs)
DROP POLICY IF EXISTS "project_inputs_select_own" ON public.project_inputs;
DROP POLICY IF EXISTS "project_inputs_insert_own" ON public.project_inputs;
DROP POLICY IF EXISTS "project_inputs_delete_own" ON public.project_inputs;

CREATE POLICY "project_inputs_select_own" ON public.project_inputs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "project_inputs_insert_own" ON public.project_inputs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "project_inputs_delete_own" ON public.project_inputs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

ALTER TABLE public.project_inputs ENABLE ROW LEVEL SECURITY;

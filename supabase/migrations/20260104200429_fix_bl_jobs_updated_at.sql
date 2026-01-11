-- Add updated_at column to bl_jobs table
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION bl_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bl_jobs_updated_at ON bl_jobs;
CREATE TRIGGER trg_bl_jobs_updated_at
BEFORE UPDATE ON bl_jobs
FOR EACH ROW EXECUTE FUNCTION bl_set_updated_at();


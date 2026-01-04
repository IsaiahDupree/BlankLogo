-- Add missing columns for progress tracking
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS current_step TEXT;

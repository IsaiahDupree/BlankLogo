-- ============================================
-- Fix job_status enum to include all statuses
-- ============================================

-- Add missing statuses to the enum
DO $$
BEGIN
  -- Add CLAIMED if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CLAIMED' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'CLAIMED';
  END IF;
  
  -- Add VOICE_GEN if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VOICE_GEN' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'VOICE_GEN';
  END IF;
  
  -- Add VISUAL_PLAN if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'VISUAL_PLAN' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'VISUAL_PLAN';
  END IF;
  
  -- Add IMAGE_GEN if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'IMAGE_GEN' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'IMAGE_GEN';
  END IF;
  
  -- Add TIMELINE_BUILD if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TIMELINE_BUILD' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'TIMELINE_BUILD';
  END IF;
  
  -- Add RENDERING if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RENDERING' AND enumtypid = 'job_status'::regtype) THEN
    ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'RENDERING';
  END IF;
END $$;

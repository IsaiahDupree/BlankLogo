-- ============================================
-- BlankLogo Jobs - Add Credits Tracking
-- ============================================
-- This migration adds credit tracking to bl_jobs table
-- Credits are reserved on job creation, then either:
-- - Finalized (kept charged) on successful completion
-- - Released (refunded) on failure or cancellation

-- Add credits columns to bl_jobs
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS credits_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS credits_reserved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bl_jobs ADD COLUMN IF NOT EXISTS credits_charged INTEGER NOT NULL DEFAULT 0;

-- Create credit ledger for BlankLogo if not exists
CREATE TABLE IF NOT EXISTS bl_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id TEXT REFERENCES bl_jobs(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'subscription', 'reserve', 'release', 'charge', 'refund', 'admin_adjustment', 'bonus')),
    amount INTEGER NOT NULL, -- Positive = credit added, Negative = credit used
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_user_id ON bl_credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_job_id ON bl_credit_ledger(job_id);
CREATE INDEX IF NOT EXISTS idx_bl_credit_ledger_created_at ON bl_credit_ledger(created_at DESC);

-- RLS for credit ledger
ALTER TABLE bl_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bl_users_view_own_credits" ON bl_credit_ledger
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bl_service_role_all_credits" ON bl_credit_ledger
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Credit Functions for BlankLogo
-- ============================================

-- Get user's credit balance
CREATE OR REPLACE FUNCTION bl_get_credit_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_balance
    FROM bl_credit_ledger
    WHERE user_id = p_user_id;
    
    RETURN v_balance;
END;
$$;

-- Reserve credits for a job (called when job is created)
CREATE OR REPLACE FUNCTION bl_reserve_credits(p_user_id UUID, p_job_id TEXT, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Check balance
    SELECT bl_get_credit_balance(p_user_id) INTO v_balance;
    
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient credits. Have %, need %', v_balance, p_amount;
    END IF;
    
    -- Insert reserve entry (negative = credits held)
    INSERT INTO bl_credit_ledger (user_id, job_id, type, amount, note)
    VALUES (p_user_id, p_job_id, 'reserve', -p_amount, 'Credits reserved for watermark removal');
    
    -- Update job
    UPDATE bl_jobs 
    SET credits_reserved = p_amount,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

-- Release reserved credits (refund on failure/cancellation)
CREATE OR REPLACE FUNCTION bl_release_credits(p_user_id UUID, p_job_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserved INTEGER;
BEGIN
    -- Get reserved amount
    SELECT credits_reserved INTO v_reserved 
    FROM bl_jobs 
    WHERE id = p_job_id;
    
    IF COALESCE(v_reserved, 0) > 0 THEN
        -- Insert release entry (positive = credits returned)
        INSERT INTO bl_credit_ledger (user_id, job_id, type, amount, note)
        VALUES (p_user_id, p_job_id, 'release', v_reserved, 'Credits refunded - job failed or cancelled');
        
        -- Update job
        UPDATE bl_jobs 
        SET credits_reserved = 0,
            updated_at = NOW()
        WHERE id = p_job_id;
    END IF;
END;
$$;

-- Finalize credits (charge on successful completion)
CREATE OR REPLACE FUNCTION bl_finalize_credits(p_user_id UUID, p_job_id TEXT, p_final_cost INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserved INTEGER;
    v_refund INTEGER;
BEGIN
    -- Get reserved amount
    SELECT credits_reserved INTO v_reserved 
    FROM bl_jobs 
    WHERE id = p_job_id;
    
    -- Calculate refund if reserved more than final cost
    v_refund := COALESCE(v_reserved, 0) - p_final_cost;
    
    IF v_refund > 0 THEN
        -- Refund excess reserved credits
        INSERT INTO bl_credit_ledger (user_id, job_id, type, amount, note)
        VALUES (p_user_id, p_job_id, 'release', v_refund, 'Partial refund - final cost less than reserved');
    END IF;
    
    -- Update job with final charges
    UPDATE bl_jobs 
    SET credits_reserved = 0,
        credits_charged = p_final_cost,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$;

-- Add credits to user (purchases, bonuses, admin adjustments)
CREATE OR REPLACE FUNCTION bl_add_credits(p_user_id UUID, p_amount INTEGER, p_type TEXT, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO bl_credit_ledger (user_id, type, amount, note)
    VALUES (p_user_id, p_type, p_amount, p_note);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION bl_get_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bl_reserve_credits(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bl_release_credits(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bl_finalize_credits(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bl_add_credits(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- Also allow service role
GRANT EXECUTE ON FUNCTION bl_get_credit_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION bl_reserve_credits(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION bl_release_credits(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION bl_finalize_credits(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION bl_add_credits(UUID, INTEGER, TEXT, TEXT) TO service_role;

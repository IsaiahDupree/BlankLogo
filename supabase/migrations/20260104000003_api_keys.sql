-- API Keys Table Migration
-- Allows users to create API keys for programmatic access

-- Create api_keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification (e.g., "bl_abc123...")
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT api_keys_name_length CHECK (char_length(name) >= 1),
    CONSTRAINT api_keys_unique_hash UNIQUE (key_hash)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own API keys"
    ON public.api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
    ON public.api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update last_used_at timestamp
CREATE OR REPLACE FUNCTION update_api_key_last_used(p_key_hash VARCHAR)
RETURNS VOID AS $$
BEGIN
    UPDATE public.api_keys
    SET last_used_at = NOW()
    WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key and return user_id
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash VARCHAR)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT user_id, expires_at INTO v_user_id, v_expires_at
    FROM public.api_keys
    WHERE key_hash = p_key_hash;
    
    -- Check if key exists
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check if key is expired
    IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
        RETURN NULL;
    END IF;
    
    -- Update last used timestamp
    PERFORM update_api_key_last_used(p_key_hash);
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.api_keys TO authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_api_key_last_used(VARCHAR) TO authenticated;

-- Add comment
COMMENT ON TABLE public.api_keys IS 'User API keys for programmatic access to BlankLogo API';

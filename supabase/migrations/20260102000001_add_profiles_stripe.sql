-- Add profiles table for Stripe integration
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT CHECK (subscription_tier IN ('starter', 'pro', 'creator_plus')),
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can manage all profiles
CREATE POLICY "Service role can manage profiles"
  ON public.profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add voice_ref_path to voice_profiles if missing
ALTER TABLE public.voice_profiles
  ADD COLUMN IF NOT EXISTS voice_ref_path TEXT;

COMMENT ON TABLE public.profiles IS 'User profiles with Stripe integration';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Current subscription tier';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Current subscription status';

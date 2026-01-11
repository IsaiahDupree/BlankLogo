-- Reset password for isaiahdupree33@gmail.com
-- Run with: supabase db reset --db-url "postgresql://postgres:postgres@127.0.0.1:54352/postgres"
-- Or via Studio SQL Editor

-- Update password to 'NewPassword123!' (change this)
UPDATE auth.users
SET 
  encrypted_password = crypt('NewPassword123!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'isaiahdupree33@gmail.com';

-- Verify the update
SELECT id, email, created_at, updated_at, confirmed_at
FROM auth.users
WHERE email = 'isaiahdupree33@gmail.com';

-- Add 100 credits to test user
INSERT INTO bl_user_credits (user_id, balance, reserved)
VALUES ('70e7415f-c5b7-4a75-8b94-12a0cfe1c9df', 100, 0)
ON CONFLICT (user_id) 
DO UPDATE SET balance = 100, reserved = 0;

-- Verify credits
SELECT user_id, balance, reserved, updated_at
FROM bl_user_credits
WHERE user_id = '70e7415f-c5b7-4a75-8b94-12a0cfe1c9df';

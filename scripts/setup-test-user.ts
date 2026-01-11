#!/usr/bin/env tsx
/**
 * Setup test user with credits
 * Creates user if needed and adds 100 credits
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const TEST_EMAIL = 'isaiahdupree33@gmail.com';
const TEST_PASSWORD = 'Frogger12';
const CREDITS_TO_ADD = 100;

async function setupTestUser() {
  console.log('🔧 Setting up test user...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Try to get user via admin API
  const listResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  
  let userId: string | null = null;
  
  if (listResponse.ok) {
    const userList = await listResponse.json();
    const user = userList.users?.find((u: any) => u.email === TEST_EMAIL);
    if (user) {
      userId = user.id;
      console.log(`✓ Found existing user: ${userId}`);
    }
  }
  
  // If user doesn't exist, try to create via signup
  if (!userId) {
    console.log('Creating new user...');
    const { data: signupData, error: signupError } = await authClient.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: {
        emailRedirectTo: undefined,
      },
    });
    
    if (signupError) {
      console.error('❌ Signup error:', signupError.message);
      // Try login in case user exists but wasn't found
      const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });
      
      if (loginError || !loginData.user) {
        throw new Error(`Failed to create or login user: ${signupError.message} / ${loginError?.message}`);
      }
      userId = loginData.user.id;
      console.log(`✓ Logged in existing user: ${userId}`);
    } else if (signupData.user) {
      userId = signupData.user.id;
      console.log(`✓ Created new user: ${userId}`);
    } else {
      throw new Error('User creation returned no user data');
    }
  }
  
  if (!userId) {
    throw new Error('Could not get or create user ID');
  }
  
  // Add 100 credits using bl_add_credits function
  console.log(`💰 Adding ${CREDITS_TO_ADD} credits to user ${userId}...`);
  const { error: creditError } = await supabase.rpc('bl_add_credits', {
    p_user_id: userId,
    p_amount: CREDITS_TO_ADD,
    p_type: 'bonus',
    p_note: 'Test credits for integration tests',
  });
  
  if (creditError) {
    throw new Error(`Failed to add credits: ${creditError.message}`);
  }
  
  // Verify credits were added
  const { data: balance, error: balanceError } = await supabase.rpc('bl_get_credit_balance', {
    p_user_id: userId,
  });
  
  if (balanceError) {
    console.warn('⚠️ Could not verify balance:', balanceError.message);
  } else {
    console.log(`✅ User now has ${balance} credits`);
  }
  
  console.log('\n✅ Test user setup complete!');
  console.log(`   Email: ${TEST_EMAIL}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Credits: ${balance || CREDITS_TO_ADD}`);
  
  return userId;
}

setupTestUser()
  .then((userId) => {
    console.log(`\n🎉 Success! User ID: ${userId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });


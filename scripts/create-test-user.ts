#!/usr/bin/env tsx
/**
 * Create a test user in local Supabase for E2E testing
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@blanklogo.local';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

async function createTestUser() {
  console.log('🔧 Creating test user in local Supabase...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users.find(u => u.email === TEST_EMAIL);

    if (userExists) {
      console.log(`✅ User already exists: ${TEST_EMAIL}`);
      console.log(`   ID: ${userExists.id}`);
      
      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userExists.id,
        { password: TEST_PASSWORD }
      );
      
      if (updateError) {
        console.error('❌ Failed to update password:', updateError.message);
      } else {
        console.log(`✅ Password updated to: ${TEST_PASSWORD}`);
      }
    } else {
      // Create new user
      const { data, error } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: 'Test User',
        }
      });

      if (error) {
        console.error('❌ Failed to create user:', error);
        process.exit(1);
      }

      console.log(`✅ Test user created successfully!`);
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   Password: ${TEST_PASSWORD}`);
      console.log(`   ID: ${data.user?.id}`);
    }

    // Add initial credits via RPC function
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users.find(u => u.email === TEST_EMAIL);
    
    if (user) {
      const { error: creditsError } = await supabase.rpc('bl_add_credits', {
        p_user_id: user.id,
        p_amount: 100,
        p_type: 'bonus',
        p_note: 'Test user initial credits'
      });

      if (creditsError) {
        console.log(`⚠️  Could not add credits: ${creditsError.message}`);
      } else {
        console.log(`✅ Added 100 credits to user`);
      }
    }

    console.log('\n📝 Use these credentials for testing:');
    console.log(`   TEST_USER_EMAIL=${TEST_EMAIL}`);
    console.log(`   TEST_USER_PASSWORD=${TEST_PASSWORD}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestUser();

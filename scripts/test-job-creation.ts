#!/usr/bin/env npx tsx
/**
 * Test script to create a real job and verify it appears in the database
 * This tests the full flow: API → Worker → Database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
const API_URL = process.env.API_URL || 'http://localhost:8989';

const TEST_EMAIL = 'test@blanklogo.local';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

async function main() {
  console.log('🧪 Testing Full Job Creation Flow\n');
  console.log('═'.repeat(50));
  
  // 1. Login via Supabase
  console.log('\n1️⃣ Logging in...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  
  if (authError) {
    console.error('❌ Login failed:', authError.message);
    process.exit(1);
  }
  
  console.log(`✅ Logged in as ${authData.user?.email}`);
  console.log(`   User ID: ${authData.user?.id}`);
  
  const accessToken = authData.session?.access_token;
  if (!accessToken) {
    console.error('❌ No access token');
    process.exit(1);
  }
  
  // 2. Check credits
  console.log('\n2️⃣ Checking credits...');
  const { data: credits } = await supabase.rpc('bl_get_credit_balance', {
    p_user_id: authData.user!.id
  });
  console.log(`💰 Credits available: ${credits}`);
  
  if (credits < 2) {
    console.error('❌ Not enough credits (need 2)');
    process.exit(1);
  }
  
  // 3. Create job via API
  console.log('\n3️⃣ Creating job via API...');
  console.log(`   Video URL: ${TEST_VIDEO_URL}`);
  
  const response = await fetch(`${API_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      video_url: TEST_VIDEO_URL,
      platform: 'auto',
      processing_mode: 'crop',
    }),
  });
  
  const responseData = await response.json();
  console.log(`   API Response: ${response.status}`);
  console.log(`   Data:`, JSON.stringify(responseData, null, 2));
  
  if (!response.ok) {
    console.error(`❌ Job creation failed: ${responseData.error || response.status}`);
    process.exit(1);
  }
  
  const jobId = responseData.job_id || responseData.id;
  console.log(`✅ Job created: ${jobId}`);
  
  // 4. Poll for job completion
  console.log('\n4️⃣ Waiting for job to complete...');
  const maxWaitMs = 120000; // 2 minutes
  const startTime = Date.now();
  let jobStatus = 'queued';
  
  while (Date.now() - startTime < maxWaitMs) {
    const { data: job, error: jobError } = await supabase
      .from('bl_jobs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (jobError) {
      console.log(`   ⚠️ Error fetching job: ${jobError.message}`);
    } else if (job) {
      if (job.status !== jobStatus) {
        jobStatus = job.status;
        console.log(`   📊 Status: ${job.status} | Progress: ${job.progress || 0}% | Step: ${job.current_step || 'N/A'}`);
      }
      
      if (job.status === 'completed') {
        console.log(`\n✅ Job completed!`);
        console.log(`   Output URL: ${job.output_url}`);
        console.log(`   Processing time: ${job.processing_time_ms ? (job.processing_time_ms / 1000).toFixed(1) + 's' : 'N/A'}`);
        break;
      }
      
      if (job.status === 'failed') {
        console.log(`\n❌ Job failed: ${job.error_message}`);
        console.log(`   Failed at step: ${job.current_step}`);
        break;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // 5. Verify job in database
  console.log('\n5️⃣ Verifying job in database...');
  const { data: finalJob } = await supabase
    .from('bl_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (finalJob) {
    console.log(`   Job ID: ${finalJob.id}`);
    console.log(`   Status: ${finalJob.status}`);
    console.log(`   Input: ${finalJob.input_filename || finalJob.input_url}`);
    console.log(`   Output: ${finalJob.output_url || 'N/A'}`);
  }
  
  // 6. Verify credits were deducted
  console.log('\n6️⃣ Checking credits after job...');
  const { data: newCredits } = await supabase.rpc('bl_get_credit_balance', {
    p_user_id: authData.user!.id
  });
  console.log(`💰 Credits now: ${newCredits} (was ${credits})`);
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Test completed!');
  console.log('═'.repeat(50));
}

main().catch(console.error);

#!/usr/bin/env npx tsx
/**
 * Credit System Test Script
 * 
 * Tests:
 * 1. Get current credit balance
 * 2. Simulate credit purchase (add credits)
 * 3. Simulate job processing (reserve, finalize credits)
 * 4. Verify credit balance changes correctly
 * 
 * Usage: npx tsx scripts/test-credits.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cwnayaqzslaukjlwkzlo.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM0MzgyMSwiZXhwIjoyMDgyOTE5ODIxfQ.KNOVq9LWDKE7ZEw1Mh9kbSnYnkP2eP8ySGoX9BHDlR0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test user ID
const TEST_USER_ID = process.env.TEST_USER_ID || '67f1c269-494c-4749-8e3f-0817c5735d7a';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[Test] ${message}`);
}

function pass(name: string, message: string, details?: unknown) {
  results.push({ name, passed: true, message, details });
  console.log(`✅ ${name}: ${message}`);
}

function fail(name: string, message: string, details?: unknown) {
  results.push({ name, passed: false, message, details });
  console.log(`❌ ${name}: ${message}`);
  if (details) console.log('   Details:', details);
}

async function getCredits(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('bl_get_credit_balance', {
    p_user_id: userId,
  });
  
  if (error) {
    throw new Error(`Failed to get credits: ${error.message}`);
  }
  
  return data || 0;
}

async function addCredits(userId: string, amount: number, type: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('bl_add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_note: note,
  });
  
  if (error) {
    throw new Error(`Failed to add credits: ${error.message}`);
  }
}

async function reserveCredits(userId: string, jobId: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('bl_reserve_credits', {
    p_user_id: userId,
    p_job_id: jobId,
    p_amount: amount,
  });
  
  if (error) {
    throw new Error(`Failed to reserve credits: ${error.message}`);
  }
}

async function releaseCredits(userId: string, jobId: string): Promise<void> {
  // bl_release_credits takes only: p_user_id, p_job_id (no amount - uses job's reserved amount)
  const { error } = await supabase.rpc('bl_release_credits', {
    p_user_id: userId,
    p_job_id: jobId,
  });
  
  if (error) {
    throw new Error(`Failed to release credits: ${error.message}`);
  }
}

async function finalizeCredits(userId: string, jobId: string, finalCost: number): Promise<void> {
  const { error } = await supabase.rpc('bl_finalize_credits', {
    p_user_id: userId,
    p_job_id: jobId,
    p_final_cost: finalCost,
  });
  
  if (error) {
    throw new Error(`Failed to finalize credits: ${error.message}`);
  }
}

// Test 1: Get initial credit balance
async function testGetBalance() {
  const testName = 'Get Credit Balance';
  try {
    const balance = await getCredits(TEST_USER_ID);
    pass(testName, `Current balance: ${balance} credits`, { balance });
    return balance;
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return 0;
  }
}

// Test 2: Add credits (simulates purchase)
async function testAddCredits(initialBalance: number) {
  const testName = 'Add Credits (Purchase Simulation)';
  const creditsToAdd = 10;
  
  try {
    await addCredits(TEST_USER_ID, creditsToAdd, 'purchase', 'Test purchase simulation');
    const newBalance = await getCredits(TEST_USER_ID);
    
    if (newBalance === initialBalance + creditsToAdd) {
      pass(testName, `Added ${creditsToAdd} credits. Balance: ${initialBalance} → ${newBalance}`);
    } else {
      fail(testName, `Balance mismatch. Expected ${initialBalance + creditsToAdd}, got ${newBalance}`);
    }
    return newBalance;
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return initialBalance;
  }
}

// Test 3: Manual credit reservation via RPC
async function testReserveCredits(initialBalance: number) {
  const testName = 'Manual Credit Reservation';
  const jobId = `test-job-${Date.now()}`;
  const creditsRequired = 1;
  
  try {
    // Create job without triggering auto-decrement (use null user_id first)
    const { error: insertError } = await supabase.from('bl_jobs').insert({
      id: jobId,
      user_id: null, // Avoid trigger
      status: 'queued',
      credits_required: creditsRequired,
      input_url: 'https://test.example.com/test-video.mp4',
      input_filename: 'test-video.mp4',
    });
    
    if (insertError) {
      throw new Error(`Failed to create test job: ${insertError.message}`);
    }
    
    // Update to add user_id and manually reserve
    await supabase.from('bl_jobs').update({ user_id: TEST_USER_ID }).eq('id', jobId);
    
    log(`Created test job: ${jobId}`);
    
    // Manually reserve credits
    await reserveCredits(TEST_USER_ID, jobId, creditsRequired);
    const newBalance = await getCredits(TEST_USER_ID);
    
    if (newBalance === initialBalance - creditsRequired) {
      pass(testName, `Reserved ${creditsRequired} credit. Balance: ${initialBalance} → ${newBalance}`);
    } else {
      fail(testName, `Balance mismatch. Expected ${initialBalance - creditsRequired}, got ${newBalance}`);
    }
    
    return { newBalance, jobId };
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { newBalance: initialBalance, jobId: '' };
  }
}

// Test 4: Finalize credits (simulates job completion)
async function testFinalizeCredits(initialBalance: number, jobId: string) {
  const testName = 'Finalize Credits (Job Complete)';
  const finalCost = 1;
  
  if (!jobId) {
    fail(testName, 'No job ID from previous test');
    return initialBalance;
  }
  
  try {
    await finalizeCredits(TEST_USER_ID, jobId, finalCost);
    const newBalance = await getCredits(TEST_USER_ID);
    
    // Balance should stay the same since we reserved 1 and charged 1
    if (newBalance === initialBalance) {
      pass(testName, `Finalized ${finalCost} credit. Balance unchanged: ${newBalance}`);
    } else {
      fail(testName, `Balance changed unexpectedly. Expected ${initialBalance}, got ${newBalance}`);
    }
    
    // Clean up test job
    await supabase.from('bl_jobs').delete().eq('id', jobId);
    
    return newBalance;
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return initialBalance;
  }
}

// Test 5: Credit release on job failure
async function testReleaseCredits(initialBalance: number) {
  const testName = 'Credit Release (Job Failure)';
  const jobId = `test-job-fail-${Date.now()}`;
  const creditsRequired = 1;
  
  try {
    // Create job without auto-decrement
    const { error: insertError } = await supabase.from('bl_jobs').insert({
      id: jobId,
      user_id: null,
      status: 'queued',
      credits_required: creditsRequired,
      input_url: 'https://test.example.com/test-video-fail.mp4',
      input_filename: 'test-video-fail.mp4',
    });
    
    if (insertError) {
      throw new Error(`Failed to create test job: ${insertError.message}`);
    }
    
    await supabase.from('bl_jobs').update({ user_id: TEST_USER_ID }).eq('id', jobId);
    log(`Created test job: ${jobId}`);
    
    // Reserve credits
    await reserveCredits(TEST_USER_ID, jobId, creditsRequired);
    const afterReserve = await getCredits(TEST_USER_ID);
    log(`After reserve: ${afterReserve} credits`);
    
    // Release credits (simulating job failure)
    await releaseCredits(TEST_USER_ID, jobId);
    const afterRelease = await getCredits(TEST_USER_ID);
    
    if (afterRelease === initialBalance) {
      pass(testName, `Credits released. Balance restored: ${initialBalance}`);
    } else {
      fail(testName, `Balance not restored. Expected ${initialBalance}, got ${afterRelease}`);
    }
    
    // Clean up
    await supabase.from('bl_jobs').delete().eq('id', jobId);
    
    return afterRelease;
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return initialBalance;
  }
}

// Test 6: Verify credit ledger entries
async function testCreditLedger() {
  const testName = 'Credit Ledger Entries';
  
  try {
    const { data, error } = await supabase
      .from('bl_credit_ledger')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (data && data.length > 0) {
      pass(testName, `Found ${data.length} recent ledger entries`, { 
        entries: data.map(e => ({ type: e.type, amount: e.amount, note: e.note }))
      });
    } else {
      pass(testName, 'No ledger entries found (may be expected for new user)');
    }
  } catch (error) {
    fail(testName, `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main test runner
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       BlankLogo Credit System Test Suite');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Test User: ${TEST_USER_ID}`);
  console.log('');
  
  // Run tests in sequence
  const initialBalance = await testGetBalance();
  console.log('');
  
  const afterAdd = await testAddCredits(initialBalance);
  console.log('');
  
  const { newBalance: afterReserve, jobId } = await testReserveCredits(afterAdd);
  console.log('');
  
  const afterFinalize = await testFinalizeCredits(afterReserve, jobId);
  console.log('');
  
  await testReleaseCredits(afterFinalize);
  console.log('');
  
  await testCreditLedger();
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                    Test Summary');
  console.log('═══════════════════════════════════════════════════════');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${results.length}`);
  console.log('');
  
  // Get final balance
  const finalBalance = await getCredits(TEST_USER_ID);
  console.log(`💰 Final credit balance: ${finalBalance}`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('All tests passed! ✨');
    process.exit(0);
  }
}

runTests().catch(console.error);

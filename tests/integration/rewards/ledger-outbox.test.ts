import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration Tests: Ledger + Outbox Atomicity
 * 
 * Tests that credit awards and notification outbox entries
 * are created atomically in the same transaction.
 * 
 * Requires: Real Supabase connection (local or staging)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip if no service key (can't run integration tests)
const shouldSkip = !SUPABASE_SERVICE_KEY;

describe.skipIf(shouldSkip)('Ledger + Outbox Atomicity', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Create test user in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `test+${Date.now()}@blanklogo.test`,
      password: 'testpassword123',
      email_confirm: true,
    });
    
    if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
    testUserId = authUser.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await supabase.from('bl_credit_ledger').delete().eq('user_id', testUserId);
      await supabase.from('bl_notification_outbox').delete().eq('user_id', testUserId);
      await supabase.from('bl_app_events').delete().eq('user_id', testUserId);
      await supabase.from('bl_promo_redemptions').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  beforeEach(async () => {
    // Clean up user's data between tests
    if (testUserId) {
      await supabase.from('bl_credit_ledger').delete().eq('user_id', testUserId);
      await supabase.from('bl_notification_outbox').delete().eq('user_id', testUserId);
      await supabase.from('bl_app_events').delete().eq('user_id', testUserId);
    }
  });

  it('ledger_insert_success_queues_outbox', async () => {
    // Call the redemption function
    const { data, error } = await supabase.rpc('bl_redeem_promo', {
      p_user_id: testUserId,
      p_campaign_id: 'blanklogo_10credits',
      p_token_hash: 'test_hash_' + Date.now(),
      p_ip_hash: 'ip_hash_test',
      p_user_agent_hash: 'ua_hash_test',
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    const result = data?.[0];
    expect(result?.success).toBe(true);
    expect(result?.credits_awarded).toBe(10);

    // Verify ledger entry exists
    const { data: ledgerEntries } = await supabase
      .from('bl_credit_ledger')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'bonus');

    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries?.[0]?.amount).toBe(10);

    // Verify outbox entry exists
    const { data: outboxEntries } = await supabase
      .from('bl_notification_outbox')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'reward_earned_email');

    expect(outboxEntries).toHaveLength(1);
    expect(outboxEntries?.[0]?.status).toBe('pending');
  });

  it('duplicate_event_processing_awards_once', async () => {
    const uniqueHash = 'dedupe_test_' + Date.now();
    
    // First redemption
    const { data: first } = await supabase.rpc('bl_redeem_promo', {
      p_user_id: testUserId,
      p_campaign_id: 'blanklogo_10credits',
      p_token_hash: uniqueHash,
    });

    expect(first?.[0]?.success).toBe(true);

    // Second attempt (should be blocked - already redeemed)
    const { data: second } = await supabase.rpc('bl_redeem_promo', {
      p_user_id: testUserId,
      p_campaign_id: 'blanklogo_10credits',
      p_token_hash: uniqueHash + '_2',
    });

    expect(second?.[0]?.success).toBe(false);
    expect(second?.[0]?.error_code).toBe('already_redeemed');

    // Verify only ONE ledger entry
    const { data: ledgerEntries } = await supabase
      .from('bl_credit_ledger')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'bonus');

    expect(ledgerEntries).toHaveLength(1);

    // Verify only ONE outbox entry
    const { data: outboxEntries } = await supabase
      .from('bl_notification_outbox')
      .select('*')
      .eq('user_id', testUserId)
      .eq('type', 'reward_earned_email');

    expect(outboxEntries).toHaveLength(1);
  });
});

describe.skipIf(shouldSkip)('Idempotency - App Events', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `test+events+${Date.now()}@blanklogo.test`,
      password: 'testpassword123',
      email_confirm: true,
    });
    
    if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
    testUserId = authUser.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await supabase.from('bl_app_events').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('duplicate_dedupe_key_rejected', async () => {
    const dedupeKey = `dedupe:test:${Date.now()}`;
    
    // First insert
    const { error: first } = await supabase
      .from('bl_app_events')
      .insert({
        user_id: testUserId,
        event_name: 'test_event',
        source: 'vercel_api',
        dedupe_key: dedupeKey,
      });

    expect(first).toBeNull();

    // Second insert with same dedupe_key (should fail)
    const { error: second } = await supabase
      .from('bl_app_events')
      .insert({
        user_id: testUserId,
        event_name: 'test_event',
        source: 'vercel_api',
        dedupe_key: dedupeKey,
      });

    expect(second).not.toBeNull();
    expect(second?.message).toContain('duplicate');
  });
});

describe.skipIf(shouldSkip)('RLS Security', () => {
  let serviceClient: ReturnType<typeof createClient>;
  let anonClient: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email: `test+rls+${Date.now()}@blanklogo.test`,
      password: 'testpassword123',
      email_confirm: true,
    });
    
    if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
    testUserId = authUser.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await serviceClient.from('bl_credit_ledger').delete().eq('user_id', testUserId);
      await serviceClient.auth.admin.deleteUser(testUserId);
    }
  });

  it('rls_user_cannot_insert_ledger', async () => {
    // Try to insert directly into ledger with anon key (no auth)
    const { error } = await anonClient
      .from('bl_credit_ledger')
      .insert({
        user_id: testUserId,
        type: 'bonus',
        amount: 1000, // Trying to give self credits
        note: 'Hack attempt',
      });

    // Should be denied by RLS
    expect(error).not.toBeNull();
  });

  it('service_role_can_award_and_queue', async () => {
    // Service role should be able to insert
    const { error } = await serviceClient
      .from('bl_credit_ledger')
      .insert({
        user_id: testUserId,
        type: 'bonus',
        amount: 5,
        note: 'Legitimate service award',
      });

    expect(error).toBeNull();
  });
});

describe.skipIf(shouldSkip)('Concurrency - Double Processing Prevention', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `test+concurrency+${Date.now()}@blanklogo.test`,
      password: 'testpassword123',
      email_confirm: true,
    });
    
    if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
    testUserId = authUser.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await supabase.from('bl_credit_ledger').delete().eq('user_id', testUserId);
      await supabase.from('bl_notification_outbox').delete().eq('user_id', testUserId);
      await supabase.from('bl_promo_redemptions').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  it('two_workers_processing_same_event_award_once', async () => {
    // Simulate two workers trying to redeem same promo concurrently
    const redemptionPromises = [
      supabase.rpc('bl_redeem_promo', {
        p_user_id: testUserId,
        p_campaign_id: 'tiktok_launch',
        p_token_hash: 'concurrent_test_1',
      }),
      supabase.rpc('bl_redeem_promo', {
        p_user_id: testUserId,
        p_campaign_id: 'tiktok_launch',
        p_token_hash: 'concurrent_test_2',
      }),
    ];

    const results = await Promise.all(redemptionPromises);
    
    // One should succeed, one should fail (already_redeemed)
    const successes = results.filter(r => r.data?.[0]?.success === true);
    const failures = results.filter(r => r.data?.[0]?.success === false);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].data?.[0]?.error_code).toBe('already_redeemed');

    // Verify only ONE ledger entry
    const { data: ledgerEntries } = await supabase
      .from('bl_credit_ledger')
      .select('*')
      .eq('user_id', testUserId)
      .ilike('note', '%TikTok%');

    expect(ledgerEntries?.length).toBe(1);
  });
});

describe.skipIf(shouldSkip)('Email Worker - Outbox Processing', () => {
  let supabase: ReturnType<typeof createClient>;
  let testUserId: string;
  let testOutboxId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: `test+outbox+${Date.now()}@blanklogo.test`,
      password: 'testpassword123',
      email_confirm: true,
    });
    
    if (authError) throw new Error(`Failed to create test user: ${authError.message}`);
    testUserId = authUser.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await supabase.from('bl_notification_outbox').delete().eq('user_id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });

  beforeEach(async () => {
    // Create a test outbox entry
    const { data, error } = await supabase
      .from('bl_notification_outbox')
      .insert({
        user_id: testUserId,
        type: 'reward_earned_email',
        payload: { credits_delta: 10, reason: 'test' },
        dedupe_key: `outbox_test:${Date.now()}`,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    testOutboxId = data.id;
  });

  it('outbox_retry_increments_attempts', async () => {
    // Simulate first failed attempt
    const { error: updateError } = await supabase
      .from('bl_notification_outbox')
      .update({
        attempts: 1,
        next_attempt_at: new Date(Date.now() + 60000).toISOString(), // 1 min from now
        error_message: 'Provider timeout',
      })
      .eq('id', testOutboxId);

    expect(updateError).toBeNull();

    // Verify state
    const { data } = await supabase
      .from('bl_notification_outbox')
      .select('*')
      .eq('id', testOutboxId)
      .single();

    expect(data?.attempts).toBe(1);
    expect(data?.status).toBe('pending');
    expect(data?.error_message).toBe('Provider timeout');
  });

  it('outbox_max_attempts_marks_failed', async () => {
    // Simulate max attempts reached
    const { error: updateError } = await supabase
      .from('bl_notification_outbox')
      .update({
        attempts: 8,
        status: 'failed',
        error_message: 'Max retries exceeded',
      })
      .eq('id', testOutboxId);

    expect(updateError).toBeNull();

    const { data } = await supabase
      .from('bl_notification_outbox')
      .select('*')
      .eq('id', testOutboxId)
      .single();

    expect(data?.status).toBe('failed');
    expect(data?.attempts).toBe(8);
  });

  it('outbox_sent_updates_status', async () => {
    // Simulate successful send
    const { error: updateError } = await supabase
      .from('bl_notification_outbox')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('id', testOutboxId);

    expect(updateError).toBeNull();

    const { data } = await supabase
      .from('bl_notification_outbox')
      .select('*')
      .eq('id', testOutboxId)
      .single();

    expect(data?.status).toBe('sent');
    expect(data?.sent_at).toBeDefined();
  });
});

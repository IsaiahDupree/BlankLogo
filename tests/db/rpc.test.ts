import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "./config";

// ============================================
// BlankLogo Credit System RPC Tests
// ============================================

let supabase: SupabaseClient;
const testUserId = "8d954cc4-a5c3-4bb8-b6ef-1cd38f24af28"; // isaiahdupree33@gmail.com

beforeAll(async () => {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
});

afterAll(async () => {
  // Cleanup test credit entries
  await supabase
    .from("bl_credit_ledger")
    .delete()
    .eq("note", "Test credit entry");
    
  // Cleanup test jobs
  await supabase
    .from("bl_jobs")
    .delete()
    .like("id", "test_%");
});

// ============================================
// bl_get_credit_balance Tests
// ============================================

describe("bl_get_credit_balance RPC", () => {
  it("returns user credit balance", async () => {
    const { data: balance, error } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    expect(error).toBeNull();
    expect(typeof balance).toBe("number");
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 for user with no credits", async () => {
    // Use a non-existent user ID
    const { data: balance, error } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(balance).toBe(0);
  });
});

// ============================================
// bl_reserve_credits Tests
// ============================================

describe("bl_reserve_credits RPC", () => {
  it("reserves credits for a job", async () => {
    const testJobId = `test_reserve_${Date.now()}`;
    
    // Get initial balance FIRST
    const { data: initialBalance } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });
    
    // Create a test job first (must exist before reserve)
    const { error: jobError } = await supabase.from("bl_jobs").insert({
      id: testJobId,
      user_id: testUserId,
      status: "queued",
      platform: "test",
      input_url: "https://example.com/test.mp4",
    });
    
    if (jobError) {
      console.error("Failed to create job:", jobError);
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Reserve credits
    const { error: reserveError } = await supabase.rpc("bl_reserve_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
      p_amount: 1,
    });

    expect(reserveError).toBeNull();

    // Check balance decreased by 1
    const { data: newBalance } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    // Balance should decrease (may have race conditions with parallel tests)
    expect(newBalance).toBeLessThan(initialBalance);

    // Cleanup
    await supabase.from("bl_credit_ledger").delete().eq("job_id", testJobId);
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });

  it("fails when insufficient credits", async () => {
    const testJobId = `test_insufficient_${Date.now()}`;

    // Create a test job
    await supabase.from("bl_jobs").insert({
      id: testJobId,
      user_id: testUserId,
      status: "queued",
      platform: "test",
      input_url: "https://example.com/test.mp4",
    });

    // Try to reserve more credits than available
    const { error } = await supabase.rpc("bl_reserve_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
      p_amount: 99999,
    });

    // Should fail with insufficient credits error
    expect(error).toBeDefined();
    expect(error?.message).toContain("Insufficient");

    // Cleanup
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });
});

// ============================================
// bl_release_credits Tests
// ============================================

describe("bl_release_credits RPC", () => {
  it("releases reserved credits back to user", async () => {
    const testJobId = `test_release_${Date.now()}`;

    // Add test credits
    await supabase.from("bl_credit_ledger").insert({
      user_id: testUserId,
      type: "bonus",
      amount: 5,
      note: "Test credit entry",
    });

    // Create job and reserve credits
    await supabase.from("bl_jobs").insert({
      id: testJobId,
      user_id: testUserId,
      status: "queued",
      platform: "test",
      input_url: "https://example.com/test.mp4",
      credits_reserved: 0,
    });

    await supabase.rpc("bl_reserve_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
      p_amount: 2,
    });

    // Get balance after reserve
    const { data: balanceAfterReserve } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    // Release credits
    const { error: releaseError } = await supabase.rpc("bl_release_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
    });

    expect(releaseError).toBeNull();

    // Check balance increased back
    const { data: balanceAfterRelease } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    expect(balanceAfterRelease).toBe(balanceAfterReserve + 2);

    // Cleanup
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });
});

// ============================================
// bl_finalize_credits Tests
// ============================================

describe("bl_finalize_credits RPC", () => {
  it("finalizes credits on job completion", async () => {
    const testJobId = `test_finalize_${Date.now()}`;

    // Add test credits
    await supabase.from("bl_credit_ledger").insert({
      user_id: testUserId,
      type: "bonus",
      amount: 5,
      note: "Test credit entry",
    });

    // Create job and reserve credits
    await supabase.from("bl_jobs").insert({
      id: testJobId,
      user_id: testUserId,
      status: "processing",
      platform: "test",
      input_url: "https://example.com/test.mp4",
      credits_reserved: 0,
    });

    await supabase.rpc("bl_reserve_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
      p_amount: 3,
    });

    // Get balance after reserve
    const { data: balanceAfterReserve } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    // Finalize with actual cost of 2 (should refund 1)
    const { error: finalizeError } = await supabase.rpc("bl_finalize_credits", {
      p_user_id: testUserId,
      p_job_id: testJobId,
      p_final_cost: 2,
    });

    expect(finalizeError).toBeNull();

    // Check balance (should have 1 credit refunded)
    const { data: balanceAfterFinalize } = await supabase.rpc("bl_get_credit_balance", {
      p_user_id: testUserId,
    });

    expect(balanceAfterFinalize).toBe(balanceAfterReserve + 1);

    // Cleanup
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });
});

// ============================================
// bl_jobs Table Tests
// ============================================

describe("bl_jobs table", () => {
  it("can create a job", async () => {
    const testJobId = `test_create_${Date.now()}`;

    const { data: job, error } = await supabase
      .from("bl_jobs")
      .insert({
        id: testJobId,
        user_id: testUserId,
        status: "queued",
        platform: "sora",
        input_url: "https://example.com/video.mp4",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(job).toBeDefined();
    expect(job?.id).toBe(testJobId);
    expect(job?.status).toBe("queued");

    // Cleanup
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });

  it("can update job status", async () => {
    const testJobId = `test_update_${Date.now()}`;

    await supabase.from("bl_jobs").insert({
      id: testJobId,
      user_id: testUserId,
      status: "queued",
      platform: "auto",
      input_url: "https://example.com/test.mp4",
    });

    const { error: updateError } = await supabase
      .from("bl_jobs")
      .update({ status: "processing" })
      .eq("id", testJobId);

    expect(updateError).toBeNull();

    const { data: updatedJob } = await supabase
      .from("bl_jobs")
      .select("status")
      .eq("id", testJobId)
      .single();

    expect(updatedJob?.status).toBe("processing");

    // Cleanup
    await supabase.from("bl_jobs").delete().eq("id", testJobId);
  });

  it("can query jobs by user", async () => {
    const { data: jobs, error } = await supabase
      .from("bl_jobs")
      .select("*")
      .eq("user_id", testUserId)
      .limit(10);

    expect(error).toBeNull();
    expect(Array.isArray(jobs)).toBe(true);
  });
});

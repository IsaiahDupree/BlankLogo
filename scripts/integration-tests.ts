#!/usr/bin/env npx ts-node
/**
 * External Integration Tests for BlankLogo
 * Tests the deployed production system
 * 
 * Usage: npx ts-node scripts/integration-tests.ts
 * Or:    SUPABASE_TEST_EMAIL=xxx SUPABASE_TEST_PASSWORD=xxx npx ts-node scripts/integration-tests.ts
 */

import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.TEST_BASE_URL || "https://www.blanklogo.app";
const WORKER_URL = process.env.TEST_WORKER_URL || "https://blanklogo-api.onrender.com";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";
const INTERNAL_NOTIFY_SECRET = process.env.INTERNAL_NOTIFY_SECRET || "xK9mP2vL8nQ4rT6wY1zB3cF5hJ7kM0oP9sU2vX4yA6bD8eG1iL3n";

// Test credentials (set via environment variables for security)
const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL || "";
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || "";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      message: "OK",
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

// ==================== UNAUTHENTICATED TESTS ====================

async function testLandingPage(): Promise<void> {
  const res = await fetch(`${BASE_URL}/`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const html = await res.text();
  if (!html.includes("BlankLogo")) throw new Error("Missing BlankLogo branding");
}

async function testPricingPage(): Promise<void> {
  const res = await fetch(`${BASE_URL}/pricing`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const html = await res.text();
  if (!html.includes("Monthly") && !html.includes("pricing")) {
    throw new Error("Missing pricing content");
  }
}

async function testSignupPage(): Promise<void> {
  const res = await fetch(`${BASE_URL}/signup`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
}

async function testLoginPage(): Promise<void> {
  const res = await fetch(`${BASE_URL}/login`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
}

async function testWorkerHealth(): Promise<void> {
  const res = await fetch(`${WORKER_URL}/health`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json() as { status: string; services?: { redis?: string; queue?: string } };
  if (data.status !== "healthy") throw new Error(`Worker unhealthy: ${JSON.stringify(data)}`);
  if (data.services?.redis !== "connected") throw new Error("Redis not connected");
  if (data.services?.queue !== "ready") throw new Error("Queue not ready");
}

async function testStripeWebhookEndpoint(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  // Should return 400 with "Missing signature" - that's correct behavior
  const data = await res.json() as { error?: string };
  if (!data.error?.includes("signature")) {
    throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  }
}

async function testCreditsAPIUnauth(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/credits`);
  const data = await res.json() as { error?: string };
  if (!data.error?.includes("Unauthorized")) {
    throw new Error(`Expected Unauthorized, got: ${JSON.stringify(data)}`);
  }
}

async function testEmailEndpoint(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/test/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${INTERNAL_NOTIFY_SECRET}`,
    },
    body: JSON.stringify({
      email: "test@test.com",
      template: "welcome",
      userName: "Test",
      dryRun: true, // Don't actually send
    }),
  });
  // Even if it fails to send, the endpoint should be reachable
  if (res.status === 404) throw new Error("Email endpoint not found");
}

// ==================== AUTHENTICATED TESTS ====================

async function testAuthenticatedFlow(): Promise<void> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD to run auth tests");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) throw new Error(`Auth failed: ${authError.message}`);
  if (!authData.session) throw new Error("No session returned");
  if (!authData.session.access_token) throw new Error("No access token in session");

  // Test user profile via Supabase client
  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Get user failed: ${userError.message}`);
  if (user.user?.email !== TEST_EMAIL) throw new Error("User email mismatch");

  // Test database access - get user's credit balance directly
  const { data: credits, error: creditsError } = await supabase.rpc("get_credit_balance", {
    p_user_id: user.user?.id,
  });
  
  if (creditsError) throw new Error(`Credits RPC failed: ${creditsError.message}`);
  if (typeof credits !== "number") throw new Error(`Invalid credits response: ${credits}`);

  // Sign out
  await supabase.auth.signOut();
}

async function testStripePortalRedirect(): Promise<void> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error || !authData.session) throw new Error("Auth failed");

  const res = await fetch(`${BASE_URL}/api/stripe/portal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authData.session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  // Should return a URL or an error about no customer
  const data = await res.json() as { error?: string; url?: string };
  if (res.status !== 200 && !data.error) {
    throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  }

  await supabase.auth.signOut();
}

// ==================== MAIN ====================

async function main() {
  console.log("\n🧪 BlankLogo Integration Tests\n");
  console.log(`📍 Web: ${BASE_URL}`);
  console.log(`📍 Worker: ${WORKER_URL}`);
  console.log(`📍 Auth: ${TEST_EMAIL ? "Configured" : "Not configured (skipping auth tests)"}\n`);
  console.log("─".repeat(50));

  // Unauthenticated tests
  console.log("\n📋 Public Endpoints:\n");
  await runTest("Landing Page", testLandingPage);
  await runTest("Pricing Page", testPricingPage);
  await runTest("Signup Page", testSignupPage);
  await runTest("Login Page", testLoginPage);
  await runTest("Worker Health", testWorkerHealth);
  await runTest("Stripe Webhook (signature check)", testStripeWebhookEndpoint);
  await runTest("Credits API (unauth rejection)", testCreditsAPIUnauth);
  await runTest("Email Endpoint", testEmailEndpoint);

  // Authenticated tests (only if credentials provided)
  if (TEST_EMAIL && TEST_PASSWORD) {
    console.log("\n📋 Authenticated Endpoints:\n");
    await runTest("Auth Flow (login/logout)", testAuthenticatedFlow);
    await runTest("Stripe Portal", testStripePortalRedirect);
  }

  // Summary
  console.log("\n" + "─".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed (${totalTime}ms total)\n`);

  if (failed > 0) {
    console.log("❌ Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log("✅ All tests passed!\n");
  }
}

main().catch(console.error);

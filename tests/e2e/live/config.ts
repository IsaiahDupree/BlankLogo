/**
 * BlankLogo Live E2E Test Configuration
 * 
 * NO MOCKS - All tests hit real deployed infrastructure:
 * - Vercel (staging web app)
 * - Render (API + Workers)
 * - Supabase (Auth + DB + Storage)
 * - Stripe (test mode)
 * - Resend (real emails)
 * - OpenAI (real API)
 */

import { v4 as uuidv4 } from "uuid";

// Run ID for this test session (used for cleanup)
export const RUN_ID = process.env.E2E_RUN_ID || `e2e-${Date.now()}`;

// Environment URLs - MUST be real staging/prod endpoints
export const ENV = {
  // Web App (Vercel)
  WEB_URL: process.env.E2E_WEB_URL || process.env.BASE_URL || "http://localhost:3939",
  
  // API (Render)
  API_URL: process.env.E2E_API_URL || process.env.API_URL || "http://localhost:8989",
  
  // Supabase (Real project)
  SUPABASE_URL: process.env.SUPABASE_URL || "http://127.0.0.1:54351",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || "",
  
  // Stripe (Test Mode)
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  
  // Test inbox for email verification
  TEST_EMAIL_DOMAIN: process.env.TEST_EMAIL_DOMAIN || "blanklogo.app",
};

// Test user factory - creates unique users for each test run
export function createTestUser(suffix?: string) {
  const id = suffix || uuidv4().slice(0, 8);
  return {
    email: `e2e+${RUN_ID}-${id}@${ENV.TEST_EMAIL_DOMAIN}`,
    password: "E2eTestPass123!",
    name: `E2E Test User ${id}`,
  };
}

// Existing test user with credits (for tests that need pre-existing account)
// MUST be set via TEST_USER_EMAIL and TEST_USER_PASSWORD env vars
export const EXISTING_TEST_USER = {
  email: process.env.TEST_USER_EMAIL || "",
  password: process.env.TEST_USER_PASSWORD || "",
};

// Validate test user is configured
if (!EXISTING_TEST_USER.email || !EXISTING_TEST_USER.password) {
  console.warn("⚠️  TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.test");
}

// Stripe test cards
export const STRIPE_TEST_CARDS = {
  SUCCESS: "4242424242424242",
  DECLINE: "4000000000000002",
  REQUIRE_AUTH: "4000002500003155",
  INSUFFICIENT_FUNDS: "4000000000009995",
};

// Timeouts (15s default per memory requirement)
export const TIMEOUTS = {
  DEFAULT: 15000,
  PAGE_LOAD: 15000,
  API_RESPONSE: 15000,
  JOB_COMPLETION: 180000, // 3 min for actual processing
  WEBHOOK_DELIVERY: 30000,
  EMAIL_DELIVERY: 60000,
};

// Generate trace ID for observability
export function generateTraceId(): string {
  return `trace-${RUN_ID}-${uuidv4().slice(0, 8)}`;
}

// Test data marker for cleanup
export const TEST_DATA_MARKER = {
  created_by: "e2e",
  run_id: RUN_ID,
};

// Sample test video URLs (real, publicly accessible)
export const TEST_VIDEOS = {
  SMALL: "https://www.w3schools.com/html/mov_bbb.mp4",
  MEDIUM: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  SORA_WATERMARKED: "https://example.com/sora-sample.mp4", // Replace with actual
};

// Logging with trace context
export function logWithTrace(traceId: string, message: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    trace_id: traceId,
    run_id: RUN_ID,
    timestamp: new Date().toISOString(),
    message,
    ...data,
  }));
}

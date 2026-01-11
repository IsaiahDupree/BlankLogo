#!/usr/bin/env npx ts-node
/**
 * Test Stripe Checkout Flow
 */

import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.blanklogo.app";
const SUPABASE_URL = "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";

const TEST_EMAIL = process.env.SUPABASE_TEST_EMAIL || "isaiahdupree33@gmail.com";
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD || "Frogger12";

// Price IDs
const PRICE_IDS = {
  pack_10: "price_1Sm34mD7MP3Gp2rw8A8eImNp",
  pack_25: "price_1Sm37mD7MP3Gp2rwdNEBy48s",
  starter: "price_1Sm35mD7MP3Gp2rwGHDyW88r",
};

async function main() {
  console.log("\n🧪 Testing Stripe Checkout Flow\n");

  // 1. Authenticate
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError || !authData.session) {
    console.error("❌ Auth failed:", authError?.message);
    process.exit(1);
  }

  console.log("✅ Logged in as:", TEST_EMAIL);
  const accessToken = authData.session.access_token;

  // 2. Test checkout endpoint
  console.log("\n📦 Testing checkout for 10 Credits pack...\n");

  const res = await fetch(`${BASE_URL}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `sb-access-token=${accessToken}; sb-refresh-token=${authData.session.refresh_token}`,
    },
    body: JSON.stringify({
      priceId: PRICE_IDS.pack_10,
      mode: "payment",
    }),
  });

  console.log("Response status:", res.status);
  const data = await res.json() as { url?: string; error?: string };
  console.log("Response body:", JSON.stringify(data, null, 2));

  if (data.url) {
    console.log("\n✅ Stripe Checkout URL generated!");
    console.log("🔗", data.url);
  } else if (data.error) {
    console.log("\n❌ Error:", data.error);
  }

  await supabase.auth.signOut();
}

main().catch(console.error);

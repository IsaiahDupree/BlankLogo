import { createClient } from "@supabase/supabase-js";

const WORKER_URL = "https://blanklogo-api.onrender.com";
const SUPABASE_URL = "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";

async function main() {
  console.log("🔐 Authenticating...");
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "isaiahdupree33@gmail.com",
    password: "Frogger12",
  });

  if (error || !data.session) {
    console.error("❌ Auth failed:", error?.message);
    return;
  }

  console.log("✅ Authenticated");
  const token = data.session.access_token;

  console.log("\n📤 Submitting job with Sora URL...");
  
  const res = await fetch(`${WORKER_URL}/api/v1/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      video_url: "https://sora.chatgpt.com/p/s_695a1e3eb9b88191aea94a19e10d7d87",
      platform: "sora",
      crop_pixels: 120,
    }),
  });

  console.log("📥 Status:", res.status);
  const body = await res.json() as Record<string, unknown>;
  console.log("📦 Response:", JSON.stringify(body, null, 2));

  if (body.error) {
    console.log("\n❌ ERROR:", body.error);
  } else if (body.jobId) {
    console.log("\n✅ Job created:", body.jobId);
  }

  await supabase.auth.signOut();
}

main().catch(console.error);

#!/usr/bin/env npx tsx
/**
 * Test file upload flow against production API
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const API_URL = process.env.API_URL || "https://blanklogo-api.onrender.com";
const SUPABASE_URL = "https://cwnayaqzslaukjlwkzlo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3bmF5YXF6c2xhdWtqbHdremxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDM4MjEsImV4cCI6MjA4MjkxOTgyMX0.zUotVxyEjSC9QhKnJ7WU8qcP_PVeRBBonxLBMspkE28";

const TEST_VIDEO = process.argv[2] || "./test-videos/sora-watermark-test.mp4";
const POLL_INTERVAL = 5000;
const TIMEOUT = 300000; // 5 minutes

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║          Production Upload Test                                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  // Check video file exists
  if (!fs.existsSync(TEST_VIDEO)) {
    console.log(`❌ Video file not found: ${TEST_VIDEO}`);
    console.log("   Run: npx tsx scripts/test-browserbase.ts first to download a test video");
    process.exit(1);
  }

  const videoStats = fs.statSync(TEST_VIDEO);
  console.log(`📹 Test video: ${TEST_VIDEO}`);
  console.log(`   Size: ${(videoStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   API: ${API_URL}`);

  // Authenticate
  console.log("\n🔐 Authenticating...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "isaiahdupree33@gmail.com",
    password: "Frogger12",
  });

  if (authError || !authData.session) {
    console.log(`❌ Auth failed: ${authError?.message}`);
    process.exit(1);
  }
  console.log(`✅ Authenticated as ${authData.user?.email}`);

  const token = authData.session.access_token;

  // Upload video
  console.log("\n📤 Uploading video...");
  const startTime = Date.now();

  const formData = new FormData();
  const videoBuffer = fs.readFileSync(TEST_VIDEO);
  const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });
  formData.append("video", videoBlob, path.basename(TEST_VIDEO));
  formData.append("platform", "sora");
  formData.append("crop_pixels", "100");

  const uploadRes = await fetch(`${API_URL}/api/v1/jobs/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  const uploadTime = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!uploadRes.ok) {
    console.log(`❌ Upload failed: ${uploadData.error}`);
    process.exit(1);
  }

  console.log(`✅ Upload successful in ${uploadTime}s`);
  console.log(`   Job ID: ${uploadData.job_id}`);
  console.log(`   Status: ${uploadData.status}`);

  // Poll for job completion
  console.log("\n⏳ Waiting for job to complete...");
  const jobId = uploadData.job_id;
  const pollStart = Date.now();

  while (Date.now() - pollStart < TIMEOUT) {
    const jobRes = await fetch(`${API_URL}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (jobRes.ok) {
      const jobData = await jobRes.json();
      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      
      process.stdout.write(`\r   [${elapsed}s] Status: ${jobData.status} - Progress: ${jobData.progress || 0}% - ${jobData.current_step || "waiting"}          `);

      if (jobData.status === "completed") {
        console.log("\n\n✅ JOB COMPLETED!");
        console.log(`   Processing time: ${jobData.processingTimeMs ? (jobData.processingTimeMs / 1000).toFixed(1) + "s" : "N/A"}`);
        console.log(`   Output URL: ${jobData.output?.downloadUrl || "N/A"}`);
        
        // Download output to verify
        if (jobData.output?.downloadUrl) {
          console.log("\n📥 Downloading processed video...");
          const outputRes = await fetch(jobData.output.downloadUrl);
          if (outputRes.ok) {
            const outputBuffer = await outputRes.arrayBuffer();
            const outputPath = "./test-videos/sora-no-watermark.mp4";
            fs.writeFileSync(outputPath, Buffer.from(outputBuffer));
            console.log(`✅ Saved to: ${outputPath} (${(outputBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
          }
        }
        
        console.log("\n═══════════════════════════════════════════════════════════════════");
        console.log("✅ UPLOAD FLOW TEST PASSED");
        console.log("═══════════════════════════════════════════════════════════════════\n");
        process.exit(0);
      }

      if (jobData.status === "failed") {
        console.log("\n\n❌ JOB FAILED!");
        console.log(`   Error: ${jobData.error}`);
        process.exit(1);
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.log("\n\n⏱️ TIMEOUT - Job did not complete in time");
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

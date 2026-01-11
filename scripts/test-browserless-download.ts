#!/usr/bin/env npx tsx
/**
 * Quick test for Browserbase download capability
 */

import path from "path";
import fs from "fs";
import os from "os";

// Set env before importing download module
process.env.BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY || "bb_live_fG38kffIFRx5Fpu_eL_UhH0TboE";
process.env.BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "d118b6fa-c48f-4b09-9d24-dbc1c00dd779";

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║          Browserless Download Test                                ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝\n");

  // Import after setting env
  const { downloadVideo, checkCapabilities } = await import("../apps/worker/src/download");

  // Check capabilities
  const caps = await checkCapabilities();
  console.log("📋 Capabilities:");
  console.log(`   Chrome: ${caps.chrome}`);
  console.log(`   Chromium: ${caps.chromium}`);
  console.log(`   Browserless: ${caps.browserless}`);
  console.log(`   yt-dlp: ${caps.ytdlp}`);
  console.log(`   curl: ${caps.curl}`);
  console.log(`   Environment: ${caps.environment}`);

  if (!caps.browserless) {
    console.log("\n❌ Browserless not configured!");
    process.exit(1);
  }

  // Test URLs - Real social media videos
  const testUrls = [
    {
      name: "Instagram Reel",
      url: "https://www.instagram.com/p/DHlTxAtsvvA/",
    },
    {
      name: "YouTube Shorts",
      url: "https://www.youtube.com/shorts/lrzq8kfSF-o",
    },
    {
      name: "TikTok Video",
      url: "https://www.tiktok.com/@burntpizza89/video/7067695578729221378",
    },
  ];

  const tmpDir = path.join(os.tmpdir(), `browserless_test_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`\n📁 Temp directory: ${tmpDir}\n`);

  for (const test of testUrls) {
    console.log(`\n🔗 Testing: ${test.name}`);
    console.log(`   URL: ${test.url}`);

    const destPath = path.join(tmpDir, `test_${Date.now()}.mp4`);
    const startTime = Date.now();

    try {
      const result = await downloadVideo(test.url, destPath);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        const stats = fs.statSync(result.filePath!);
        console.log(`   ✅ Success! Method: ${result.method}`);
        console.log(`   📦 Size: ${(stats.size / 1024).toFixed(1)} KB`);
        console.log(`   ⏱️  Duration: ${duration}s`);
        
        // Clean up
        fs.unlinkSync(result.filePath!);
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        console.log(`   ⏱️  Duration: ${duration}s`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err}`);
    }
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("\n✅ Test complete!\n");
}

main().catch(console.error);

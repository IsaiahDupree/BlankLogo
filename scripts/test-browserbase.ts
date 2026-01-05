#!/usr/bin/env npx tsx
/**
 * Simple Browserbase video download test
 */

import puppeteer from "puppeteer-core";
import Browserbase from "@browserbasehq/sdk";
import fs from "fs";
import path from "path";
import os from "os";

const API_KEY = process.env.BROWSERBASE_API_KEY || "bb_live_fG38kffIFRx5Fpu_eL_UhH0TboE";
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID || "d118b6fa-c48f-4b09-9d24-dbc1c00dd779";

const TEST_URLS = [
  { name: "Instagram", url: "https://www.instagram.com/p/DHlTxAtsvvA/" },
  { name: "YouTube Shorts", url: "https://www.youtube.com/shorts/lrzq8kfSF-o" },
  { name: "TikTok", url: "https://www.tiktok.com/@burntpizza89/video/7067695578729221378" },
];

async function testDownload(name: string, url: string) {
  console.log(`\n🔗 Testing: ${name}`);
  console.log(`   URL: ${url}`);

  const bb = new Browserbase({ apiKey: API_KEY });

  try {
    // Create session
    console.log("   Creating Browserbase session...");
    const session = await bb.sessions.create({ projectId: PROJECT_ID });
    console.log(`   Session ID: ${session.id}`);

    // Connect Puppeteer
    const browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });

    const page = (await browser.pages())[0];
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Collect video URLs from network
    const videoUrls: string[] = [];
    page.on("response", (response) => {
      const respUrl = response.url();
      const ct = response.headers()["content-type"] || "";
      if (ct.includes("video") || respUrl.includes(".mp4") || respUrl.includes("/video/")) {
        videoUrls.push(respUrl);
        console.log(`   📹 Found video URL: ${respUrl.substring(0, 80)}...`);
      }
    });

    // Navigate to page
    console.log("   Navigating to page...");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for video to load
    await new Promise((r) => setTimeout(r, 5000));

    // Try to find video element
    const videoSrc = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video?.src || video?.querySelector("source")?.src || null;
    });

    if (videoSrc) {
      console.log(`   📹 Video src found: ${videoSrc.substring(0, 80)}...`);
      videoUrls.unshift(videoSrc);
    }

    await browser.close();

    // Try to download one of the video URLs
    const uniqueUrls = [...new Set(videoUrls)];
    console.log(`   Found ${uniqueUrls.length} potential video URLs`);

    for (const videoUrl of uniqueUrls.slice(0, 3)) {
      try {
        console.log(`   Trying to download: ${videoUrl.substring(0, 60)}...`);
        const resp = await fetch(videoUrl, {
          headers: { Referer: url, "User-Agent": "Mozilla/5.0" },
        });

        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          if (buffer.byteLength > 100000) {
            const tmpPath = path.join(os.tmpdir(), `test_${Date.now()}.mp4`);
            fs.writeFileSync(tmpPath, Buffer.from(buffer));
            console.log(`   ✅ SUCCESS! Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
            fs.unlinkSync(tmpPath);
            console.log(`   View replay: https://browserbase.com/sessions/${session.id}`);
            return true;
          }
        }
      } catch (e) {
        // Continue to next URL
      }
    }

    console.log(`   ❌ Could not download video`);
    console.log(`   View replay: https://browserbase.com/sessions/${session.id}`);
    return false;
  } catch (err) {
    console.log(`   ❌ Error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║          Browserbase Video Download Test                          ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");
  console.log(`\nAPI Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`Project ID: ${PROJECT_ID}`);

  const results: { name: string; success: boolean }[] = [];

  for (const test of TEST_URLS) {
    const success = await testDownload(test.name, test.url);
    results.push({ name: test.name, success });
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("Results:");
  for (const r of results) {
    console.log(`  ${r.success ? "✅" : "❌"} ${r.name}`);
  }
}

main().catch(console.error);

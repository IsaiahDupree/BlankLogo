#!/usr/bin/env npx tsx
/**
 * Test @sparticuz/chromium for Railway deployment
 * Simulates cloud environment to verify bundled Chromium works
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEST_URL = process.argv[2] || "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromium-test-"));
const destPath = path.join(tmpDir, "video.mp4");

// Force cloud mode to test @sparticuz/chromium
process.env.CLOUD_ENV = "true";

console.log(`
╔════════════════════════════════════════════════════════════╗
║     @sparticuz/chromium TEST (Railway Simulation)          ║
╠════════════════════════════════════════════════════════════╣
║  URL: ${TEST_URL.substring(0, 50)}...
║  Output: ${destPath}
║  Mode: Cloud (simulated)
╚════════════════════════════════════════════════════════════╝
`);

async function main() {
  console.log("Step 1: Loading @sparticuz/chromium...");
  
  let chromium;
  let executablePath: string;
  
  try {
    chromium = await import("@sparticuz/chromium");
    console.log("  ✅ @sparticuz/chromium loaded");
    
    // Get executable path
    executablePath = await chromium.default.executablePath();
    console.log(`  ✅ Chromium path: ${executablePath}`);
    
    // Check if file exists
    if (fs.existsSync(executablePath)) {
      console.log("  ✅ Chromium binary exists");
    } else {
      console.log("  ⚠️ Chromium binary not found at path, will download on first use");
    }
    
    // Get args
    const args = chromium.default.args;
    console.log(`  ✅ Chromium args: ${args.length} flags`);
    
  } catch (error) {
    console.error("  ❌ Failed to load @sparticuz/chromium:", error);
    process.exit(1);
  }
  
  console.log("\nStep 2: Launching Puppeteer with @sparticuz/chromium...");
  
  const puppeteer = await import("puppeteer-core");
  
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: chromium.default.args,
  });
  
  console.log("  ✅ Browser launched");
  
  const page = await browser.newPage();
  
  // Anti-detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty((globalThis as any).navigator, "webdriver", { get: () => false });
  });
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  console.log("  ✅ Page created with anti-detection");
  
  // Capture video URLs
  const videoUrls: { url: string; size: number; contentType: string }[] = [];
  page.on("response", (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] || "";
    const size = parseInt(response.headers()["content-length"] || "0");
    
    if (ct.includes("video") || url.includes(".mp4") || url.includes("/raw")) {
      console.log(`  📹 Found video: ${url.substring(0, 60)}... (${size} bytes)`);
      videoUrls.push({ url, size, contentType: ct });
    }
  });
  
  console.log("\nStep 3: Navigating to URL...");
  
  try {
    await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
    console.log("  ✅ Page loaded");
  } catch (error) {
    console.log(`  ⚠️ Navigation timeout/error: ${error}`);
  }
  
  // Wait for video to load
  console.log("\nStep 4: Waiting for video element...");
  await new Promise((r) => setTimeout(r, 5000));
  
  // Try to click video
  try {
    await page.click("video");
    console.log("  ✅ Clicked video element");
    await new Promise((r) => setTimeout(r, 2000));
  } catch {
    console.log("  ℹ️ No video element to click (might be auto-playing)");
  }
  
  // Get video.src
  const videoInfo = await page.evaluate(() => {
    const doc = (globalThis as any).document;
    const video = doc.querySelector("video");
    if (video) {
      return {
        src: video.src || null,
        currentSrc: video.currentSrc || null,
        duration: video.duration || 0,
        readyState: video.readyState,
      };
    }
    return null;
  });
  
  console.log("\nStep 5: Video element info:");
  if (videoInfo) {
    console.log(`  ✅ video.src: ${videoInfo.src?.substring(0, 60)}...`);
    console.log(`  ✅ duration: ${videoInfo.duration}s`);
    console.log(`  ✅ readyState: ${videoInfo.readyState}`);
  } else {
    console.log("  ❌ No video element found");
  }
  
  await browser.close();
  console.log("\n  ✅ Browser closed");
  
  // Download the video
  console.log("\nStep 6: Downloading video...");
  
  const urlsToTry: string[] = [];
  if (videoInfo?.src) urlsToTry.push(videoInfo.src);
  if (videoInfo?.currentSrc && videoInfo.currentSrc !== videoInfo.src) {
    urlsToTry.push(videoInfo.currentSrc);
  }
  urlsToTry.push(...videoUrls.filter((v) => v.contentType.includes("video")).map((v) => v.url));
  
  console.log(`  Found ${urlsToTry.length} URLs to try`);
  
  for (const videoUrl of [...new Set(urlsToTry)]) {
    console.log(`  Trying: ${videoUrl.substring(0, 60)}...`);
    
    try {
      const resp = await fetch(videoUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: TEST_URL,
        },
      });
      
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        console.log(`  Downloaded: ${buffer.byteLength} bytes`);
        
        // Check if it's a valid video
        const header = new Uint8Array(buffer.slice(0, 12));
        const isMp4 = header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
        
        if (isMp4 || buffer.byteLength > 500000) {
          fs.writeFileSync(destPath, Buffer.from(buffer));
          
          console.log(`
╔════════════════════════════════════════════════════════════╗
║                    ✅ SUCCESS!                             ║
╠════════════════════════════════════════════════════════════╣
║  File: ${destPath}
║  Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB
║  Format: ${isMp4 ? "MP4" : "Unknown"}
║  
║  @sparticuz/chromium works! Ready for Railway deployment.
╚════════════════════════════════════════════════════════════╝
`);
          return;
        }
      }
    } catch (e) {
      console.log(`  Failed: ${e}`);
    }
  }
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    ❌ FAILED                               ║
╠════════════════════════════════════════════════════════════╣
║  Could not download video.
║  Video URLs found: ${videoUrls.length}
║  
║  Check if the page requires authentication.
╚════════════════════════════════════════════════════════════╝
`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

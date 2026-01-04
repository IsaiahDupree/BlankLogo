/**
 * Standalone @sparticuz/chromium test for Railway/Linux
 * Uses puppeteer-extra with stealth plugin for Cloudflare bypass
 */
import * as fs from "fs";

const TEST_URL = process.env.TEST_URL || "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   @sparticuz/chromium Railway Test (with Stealth)         ║
╠═══════════════════════════════════════════════════════════╣
║  URL: ${TEST_URL.substring(0, 48)}...
║  Platform: ${process.platform}
║  Arch: ${process.arch}
╚═══════════════════════════════════════════════════════════╝
`);

async function main() {
  console.log("1. Loading @sparticuz/chromium...");
  const chromium = await import("@sparticuz/chromium");
  
  const execPath = await chromium.default.executablePath();
  console.log(`   ✅ Chromium path: ${execPath}`);
  console.log(`   ✅ Args: ${chromium.default.args.length} flags`);
  
  console.log("\n2. Loading puppeteer-extra with stealth...");
  const puppeteerExtra = await import("puppeteer-extra");
  const StealthPlugin = await import("puppeteer-extra-plugin-stealth");
  
  puppeteerExtra.default.use(StealthPlugin.default());
  console.log("   ✅ Stealth plugin loaded");
  
  console.log("\n3. Launching browser...");
  const browser = await puppeteerExtra.default.launch({
    executablePath: execPath,
    headless: "new",
    args: [
      ...chromium.default.args,
      "--disable-blink-features=AutomationControlled",
    ],
  });
  console.log("   ✅ Browser launched");
  
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  
  // Capture video URLs
  const videoUrls: string[] = [];
  page.on("response", (r) => {
    const url = r.url();
    const ct = r.headers()["content-type"] || "";
    if (ct.includes("video") || url.includes(".mp4") || url.includes("/raw")) {
      console.log(`   📹 ${url.substring(0, 60)}...`);
      videoUrls.push(url);
    }
  });
  
  console.log("\n3. Navigating to URL...");
  await page.goto(TEST_URL, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  
  // Get video src
  const videoSrc = await page.evaluate(() => {
    const v = (globalThis as any).document.querySelector("video");
    return v?.src || v?.currentSrc || null;
  });
  
  await browser.close();
  
  console.log("\n4. Results:");
  if (videoSrc) {
    console.log(`   ✅ video.src: ${videoSrc.substring(0, 60)}...`);
    
    // Try to download
    const resp = await fetch(videoSrc, { headers: { Referer: TEST_URL } });
    if (resp.ok) {
      const buffer = await resp.arrayBuffer();
      console.log(`   ✅ Downloaded: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
      fs.writeFileSync("/tmp/video.mp4", Buffer.from(buffer));
      console.log("   ✅ Saved to /tmp/video.mp4");
      
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║   ✅ SUCCESS - Ready for Railway deployment!              ║
╚═══════════════════════════════════════════════════════════╝
`);
      return;
    }
  }
  
  console.log(`   ❌ No video found. URLs captured: ${videoUrls.length}`);
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});

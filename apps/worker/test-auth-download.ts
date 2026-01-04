#!/usr/bin/env npx tsx
/**
 * Test authenticated video download from Sora
 * Usage: SORA_EMAIL=x SORA_PASS=y npx tsx test-auth-download.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEST_URL = process.argv[2] || "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const EMAIL = process.env.SORA_EMAIL;
const PASS = process.env.SORA_PASS;

if (!EMAIL || !PASS) {
  console.error("Usage: SORA_EMAIL=email SORA_PASS=password npx tsx test-auth-download.ts");
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sora-auth-"));
const destPath = path.join(tmpDir, "video.mp4");

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Authenticated Sora Download Test                        ║
╠═══════════════════════════════════════════════════════════╣
║  URL: ${TEST_URL.substring(0, 48)}...
║  Email: ${EMAIL.substring(0, 5)}***
╚═══════════════════════════════════════════════════════════╝
`);

async function main() {
  const puppeteer = await import("puppeteer-core");
  
  console.log("1. Launching browser...");
  const browser = await puppeteer.default.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false, // Visible for debugging
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1280, height: 800 },
  });
  
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty((globalThis as any).navigator, "webdriver", { get: () => false });
  });
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  
  console.log("2. Going to Sora login...");
  await page.goto("https://sora.chatgpt.com", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Check if we need to log in
  const pageUrl = page.url();
  console.log(`   Current URL: ${pageUrl}`);
  
  // Look for login button or email input
  const needsAuth = await page.evaluate(() => {
    const doc = (globalThis as any).document;
    return !!(
      doc.querySelector('input[type="email"]') ||
      doc.querySelector('input[name="email"]') ||
      doc.querySelector('[data-testid="login-button"]') ||
      doc.body.innerText.includes("Log in") ||
      doc.body.innerText.includes("Sign in")
    );
  });
  
  if (needsAuth) {
    console.log("3. Attempting login...");
    
    // Try to find and fill email field
    try {
      // Wait for email input
      await page.waitForSelector('input[type="email"], input[name="email"], input[name="username"]', { timeout: 10000 });
      
      const emailSelector = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        if (doc.querySelector('input[type="email"]')) return 'input[type="email"]';
        if (doc.querySelector('input[name="email"]')) return 'input[name="email"]';
        if (doc.querySelector('input[name="username"]')) return 'input[name="username"]';
        return null;
      });
      
      if (emailSelector) {
        await page.type(emailSelector, EMAIL!, { delay: 50 });
        console.log("   ✅ Entered email");
        
        // Look for continue/next button
        await new Promise(r => setTimeout(r, 1000));
        const continueBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
        if (continueBtn) {
          await continueBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
        
        // Wait for password field
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.type('input[type="password"]', PASS!, { delay: 50 });
        console.log("   ✅ Entered password");
        
        // Click login button
        await new Promise(r => setTimeout(r, 1000));
        const loginBtn = await page.$('button[type="submit"]');
        if (loginBtn) {
          await loginBtn.click();
          console.log("   ✅ Clicked login button");
        }
        
        // Wait for login to complete
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.log(`   ⚠️ Login flow issue: ${e}`);
    }
  } else {
    console.log("3. Already authenticated or no login needed");
  }
  
  console.log("4. Navigating to video page...");
  await page.goto(TEST_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));
  
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
  
  // Reload to capture video URLs
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 5000));
  
  // Get video src
  const videoSrc = await page.evaluate(() => {
    const video = (globalThis as any).document.querySelector("video");
    return video?.src || video?.currentSrc || null;
  });
  
  console.log("5. Video info:");
  if (videoSrc) {
    console.log(`   ✅ video.src: ${videoSrc.substring(0, 60)}...`);
  } else {
    console.log("   ❌ No video.src found");
  }
  console.log(`   Network URLs: ${videoUrls.length}`);
  
  // Try to download
  const urlsToTry = videoSrc ? [videoSrc, ...videoUrls] : videoUrls;
  
  for (const videoUrl of [...new Set(urlsToTry)]) {
    console.log(`\n6. Downloading: ${videoUrl.substring(0, 50)}...`);
    try {
      const resp = await fetch(videoUrl, { headers: { Referer: TEST_URL } });
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        console.log(`   Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        
        if (buffer.byteLength > 100000) {
          fs.writeFileSync(destPath, Buffer.from(buffer));
          console.log(`
╔═══════════════════════════════════════════════════════════╗
║   ✅ SUCCESS!                                             ║
╠═══════════════════════════════════════════════════════════╣
║  File: ${destPath}
║  Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB
╚═══════════════════════════════════════════════════════════╝
`);
          await browser.close();
          return;
        }
      }
    } catch (e) {
      console.log(`   Failed: ${e}`);
    }
  }
  
  console.log("\n   Keeping browser open for manual inspection (30s)...");
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});

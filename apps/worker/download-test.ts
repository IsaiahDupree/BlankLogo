#!/usr/bin/env npx tsx
/**
 * Comprehensive Video Download Test Script
 * Tests all available download methods and reports results
 * 
 * Usage: npx tsx download-test.ts <url>
 * Example: npx tsx download-test.ts "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed"
 */

import { spawn, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEST_URL = process.argv[2] || "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "download-test-"));

interface DownloadResult {
  method: string;
  success: boolean;
  size: number;
  isVideo: boolean;
  duration: number;
  error?: string;
  filePath?: string;
}

const results: DownloadResult[] = [];

console.log(`
╔════════════════════════════════════════════════════════════╗
║           VIDEO DOWNLOAD METHOD TESTER                     ║
╠════════════════════════════════════════════════════════════╣
║  URL: ${TEST_URL.substring(0, 50)}...
║  Output: ${tmpDir}
╚════════════════════════════════════════════════════════════╝
`);

// Check if file is a valid video
function validateVideo(filePath: string): { isVideo: boolean; size: number; format?: string } {
  if (!fs.existsSync(filePath)) {
    return { isVideo: false, size: 0 };
  }
  
  const stats = fs.statSync(filePath);
  const size = stats.size;
  
  if (size < 1000) {
    return { isVideo: false, size };
  }
  
  // Read file header
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);
  
  // Check signatures
  const isMp4 = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70; // ftyp
  const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  const isAvi = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'AVI ';
  const isMov = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70; // Same as MP4
  
  let format = 'unknown';
  if (isMp4) format = 'mp4';
  else if (isWebm) format = 'webm';
  else if (isAvi) format = 'avi';
  
  return { 
    isVideo: isMp4 || isWebm || isAvi || size > 100000, 
    size, 
    format 
  };
}

// Helper to run a download method with timeout
async function runMethod(
  name: string, 
  fn: () => Promise<string | null>
): Promise<DownloadResult> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ Testing: ${name}`);
  console.log(`${'─'.repeat(60)}`);
  
  const start = Date.now();
  
  try {
    const filePath = await fn();
    const duration = Date.now() - start;
    
    if (filePath && fs.existsSync(filePath)) {
      const validation = validateVideo(filePath);
      const result: DownloadResult = {
        method: name,
        success: validation.isVideo && validation.size > 10000,
        size: validation.size,
        isVideo: validation.isVideo,
        duration,
        filePath,
      };
      
      if (result.success) {
        console.log(`✅ SUCCESS: ${validation.size} bytes, format: ${validation.format}`);
      } else {
        console.log(`❌ FAILED: File too small or not a video (${validation.size} bytes)`);
      }
      
      return result;
    }
    
    return { method: name, success: false, size: 0, isVideo: false, duration, error: 'No file created' };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ ERROR: ${errorMsg}`);
    return { method: name, success: false, size: 0, isVideo: false, duration, error: errorMsg };
  }
}

// ═══════════════════════════════════════════════════════════
// DOWNLOAD METHODS
// ═══════════════════════════════════════════════════════════

// 1. Node.js fetch (native)
async function downloadWithFetch(): Promise<string | null> {
  const destPath = path.join(tmpDir, "fetch.mp4");
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'video/mp4,video/*,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': TEST_URL,
  };
  
  const response = await fetch(TEST_URL, { headers, redirect: 'follow' });
  console.log(`  Status: ${response.status} ${response.statusText}`);
  console.log(`  Content-Type: ${response.headers.get('content-type')}`);
  
  if (!response.ok) return null;
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  return destPath;
}

// 2. curl
async function downloadWithCurl(): Promise<string | null> {
  const destPath = path.join(tmpDir, "curl.mp4");
  
  return new Promise((resolve) => {
    const curl = spawn("curl", [
      "-L", "-f", "-s", "--show-error",
      "-o", destPath,
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "-H", "Accept: video/mp4,video/*,*/*",
      "-H", `Referer: ${TEST_URL}`,
      "--compressed",
      "--max-time", "120",
      "-w", "\\nHTTP %{http_code}, %{size_download} bytes, %{time_total}s",
      TEST_URL
    ]);
    
    curl.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    curl.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    curl.on("close", (code) => {
      resolve(code === 0 ? destPath : null);
    });
    
    curl.on("error", () => resolve(null));
  });
}

// 3. wget
async function downloadWithWget(): Promise<string | null> {
  const destPath = path.join(tmpDir, "wget.mp4");
  
  return new Promise((resolve) => {
    const wget = spawn("wget", [
      "-O", destPath,
      "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "--header=Accept: video/mp4,video/*,*/*",
      `--header=Referer: ${TEST_URL}`,
      "--timeout=120",
      "--tries=2",
      "--progress=bar:force",
      TEST_URL
    ]);
    
    wget.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    wget.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    wget.on("close", (code) => {
      resolve(code === 0 ? destPath : null);
    });
    
    wget.on("error", () => resolve(null));
  });
}

// 4. aria2c (fast parallel downloader)
async function downloadWithAria2(): Promise<string | null> {
  const destPath = path.join(tmpDir, "aria2.mp4");
  
  return new Promise((resolve) => {
    const aria2 = spawn("aria2c", [
      "-o", path.basename(destPath),
      "-d", path.dirname(destPath),
      "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      `--referer=${TEST_URL}`,
      "--max-connection-per-server=4",
      "--split=4",
      "--timeout=120",
      TEST_URL
    ]);
    
    aria2.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    aria2.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    aria2.on("close", (code) => {
      resolve(code === 0 ? destPath : null);
    });
    
    aria2.on("error", () => {
      console.log("  aria2c not installed");
      resolve(null);
    });
  });
}

// 5. yt-dlp (standard)
async function downloadWithYtDlp(): Promise<string | null> {
  const destPath = path.join(tmpDir, "ytdlp.mp4");
  
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", [
      "--no-warnings",
      "--no-playlist",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-o", destPath,
      "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      TEST_URL
    ]);
    
    ytdlp.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    ytdlp.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      resolve(code === 0 && fs.existsSync(destPath) ? destPath : null);
    });
    
    ytdlp.on("error", () => {
      console.log("  yt-dlp not installed");
      resolve(null);
    });
    
    setTimeout(() => { ytdlp.kill(); resolve(null); }, 60000);
  });
}

// 6. yt-dlp with browser cookies
async function downloadWithYtDlpCookies(): Promise<string | null> {
  const destPath = path.join(tmpDir, "ytdlp-cookies.mp4");
  
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", [
      "--no-warnings",
      "--no-playlist",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-o", destPath,
      "--cookies-from-browser", "chrome",
      TEST_URL
    ]);
    
    ytdlp.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    ytdlp.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      resolve(code === 0 && fs.existsSync(destPath) ? destPath : null);
    });
    
    ytdlp.on("error", () => resolve(null));
    
    setTimeout(() => { ytdlp.kill(); resolve(null); }, 60000);
  });
}

// 7. yt-dlp with impersonation
async function downloadWithYtDlpImpersonate(): Promise<string | null> {
  const destPath = path.join(tmpDir, "ytdlp-impersonate.mp4");
  
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", [
      "--no-warnings",
      "--no-playlist",
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "-o", destPath,
      "--extractor-args", "generic:impersonate",
      TEST_URL
    ]);
    
    ytdlp.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    ytdlp.stderr.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      resolve(code === 0 && fs.existsSync(destPath) ? destPath : null);
    });
    
    ytdlp.on("error", () => resolve(null));
    
    setTimeout(() => { ytdlp.kill(); resolve(null); }, 60000);
  });
}

// 8. ffmpeg (for streaming URLs)
async function downloadWithFfmpeg(): Promise<string | null> {
  const destPath = path.join(tmpDir, "ffmpeg.mp4");
  
  return new Promise((resolve) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-user_agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "-headers", `Referer: ${TEST_URL}\r\n`,
      "-i", TEST_URL,
      "-c", "copy",
      "-t", "60",
      destPath
    ]);
    
    ffmpeg.stdout.on("data", (d) => console.log(`  ${d.toString().trim()}`));
    ffmpeg.stderr.on("data", (d) => {
      const line = d.toString().trim();
      if (line.includes('frame=') || line.includes('size=') || line.includes('error') || line.includes('Error')) {
        console.log(`  ${line}`);
      }
    });
    
    ffmpeg.on("close", (code) => {
      resolve(code === 0 ? destPath : null);
    });
    
    ffmpeg.on("error", () => {
      console.log("  ffmpeg not installed");
      resolve(null);
    });
    
    setTimeout(() => { ffmpeg.kill(); resolve(null); }, 60000);
  });
}

// 9. Puppeteer (headless browser)
async function downloadWithPuppeteer(): Promise<string | null> {
  const destPath = path.join(tmpDir, "puppeteer.mp4");
  
  try {
    const puppeteer = await import('puppeteer-core');
    
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (!fs.existsSync(chromePath)) {
      console.log("  Chrome not found at expected path");
      return null;
    }
    
    console.log("  Launching browser...");
    const browser = await puppeteer.default.launch({
      executablePath: chromePath,
      headless: 'shell',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Capture video URLs
    const videoUrls: { url: string; size: number }[] = [];
    page.on('response', (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      const size = parseInt(response.headers()['content-length'] || '0');
      if (ct.includes('video') || url.includes('.mp4') || url.includes('/raw')) {
        console.log(`  Found: ${url.substring(0, 60)}... (${size} bytes)`);
        videoUrls.push({ url, size });
      }
    });
    
    console.log("  Navigating to page...");
    await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Get video.src
    const videoSrc = await page.evaluate(() => {
      const video = (globalThis as any).document.querySelector('video');
      return video?.src || video?.currentSrc || null;
    });
    
    await browser.close();
    
    if (videoSrc) {
      console.log(`  Video src: ${videoSrc.substring(0, 60)}...`);
      const resp = await fetch(videoSrc, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': TEST_URL },
      });
      
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(buffer));
        return destPath;
      }
    }
    
    // Try network-captured URLs
    for (const { url } of videoUrls.sort((a, b) => b.size - a.size)) {
      try {
        const resp = await fetch(url, { headers: { 'Referer': TEST_URL } });
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          if (buffer.byteLength > 100000) {
            fs.writeFileSync(destPath, Buffer.from(buffer));
            return destPath;
          }
        }
      } catch {}
    }
    
    return null;
  } catch (error) {
    console.log(`  Error: ${error}`);
    return null;
  }
}

// 10. Puppeteer with visible browser
async function downloadWithPuppeteerVisible(): Promise<string | null> {
  const destPath = path.join(tmpDir, "puppeteer-visible.mp4");
  
  try {
    const puppeteer = await import('puppeteer-core');
    
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (!fs.existsSync(chromePath)) return null;
    
    console.log("  Launching VISIBLE browser...");
    const browser = await puppeteer.default.launch({
      executablePath: chromePath,
      headless: false,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      defaultViewport: { width: 1280, height: 800 },
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const videoUrls: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('video') || url.includes('/raw')) {
        videoUrls.push(url);
      }
    });
    
    console.log("  Navigating...");
    await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise(r => setTimeout(r, 8000));
    
    // Click video to ensure it loads
    try { await page.click('video'); } catch {}
    await new Promise(r => setTimeout(r, 2000));
    
    const videoSrc = await page.evaluate(() => {
      const video = (globalThis as any).document.querySelector('video');
      return video?.src || null;
    });
    
    await browser.close();
    
    if (videoSrc) {
      const resp = await fetch(videoSrc, { headers: { 'Referer': TEST_URL } });
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(buffer));
        return destPath;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`  Error: ${error}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  // Run all methods
  results.push(await runMethod("1. fetch (Node.js native)", downloadWithFetch));
  results.push(await runMethod("2. curl", downloadWithCurl));
  results.push(await runMethod("3. wget", downloadWithWget));
  results.push(await runMethod("4. aria2c", downloadWithAria2));
  results.push(await runMethod("5. yt-dlp", downloadWithYtDlp));
  results.push(await runMethod("6. yt-dlp + browser cookies", downloadWithYtDlpCookies));
  results.push(await runMethod("7. yt-dlp + impersonate", downloadWithYtDlpImpersonate));
  results.push(await runMethod("8. ffmpeg", downloadWithFfmpeg));
  results.push(await runMethod("9. Puppeteer (headless)", downloadWithPuppeteer));
  results.push(await runMethod("10. Puppeteer (visible)", downloadWithPuppeteerVisible));
  
  // Print summary
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    RESULTS SUMMARY                         ║
╠════════════════════════════════════════════════════════════╣`);
  
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const size = r.size > 0 ? `${(r.size / 1024 / 1024).toFixed(2)} MB` : '0 bytes';
    const time = `${(r.duration / 1000).toFixed(1)}s`;
    console.log(`║ ${status} ${r.method.padEnd(35)} ${size.padStart(10)} ${time.padStart(8)} ║`);
  }
  
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  
  // Show successful downloads
  const successful = results.filter(r => r.success);
  if (successful.length > 0) {
    console.log(`\n🎉 Successfully downloaded with ${successful.length} method(s):`);
    for (const r of successful) {
      console.log(`   - ${r.method}: ${r.filePath}`);
    }
  } else {
    console.log(`\n😞 No method succeeded. Try uploading the video file directly.`);
  }
  
  // List all files
  console.log(`\n📁 Files in ${tmpDir}:`);
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    const stats = fs.statSync(filePath);
    const validation = validateVideo(filePath);
    const icon = validation.isVideo ? '🎬' : '📄';
    console.log(`   ${icon} ${file}: ${stats.size} bytes ${validation.format ? `(${validation.format})` : ''}`);
  }
  
  console.log(`\n💡 Temp directory kept at: ${tmpDir}`);
}

main().catch(console.error);

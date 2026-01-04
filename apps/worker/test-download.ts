import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEST_URL = "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sora-test-"));

console.log(`\n========================================`);
console.log(`Testing download methods for: ${TEST_URL}`);
console.log(`Temp directory: ${tmpDir}`);
console.log(`========================================\n`);

// Helper to check if file has valid video data
function checkFile(filePath: string): { success: boolean; size: number; isVideo: boolean } {
  if (!fs.existsSync(filePath)) {
    return { success: false, size: 0, isVideo: false };
  }
  const stats = fs.statSync(filePath);
  const size = stats.size;
  
  if (size < 1000) {
    return { success: false, size, isVideo: false };
  }
  
  // Check for video file signatures
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 12, 0);
  fs.closeSync(fd);
  
  // MP4: ftyp at offset 4
  const isMp4 = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
  // WebM: 1a 45 df a3
  const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
  
  return { success: size > 10000, size, isVideo: isMp4 || isWebm };
}

// Test 1: curl with various options
async function testCurl(): Promise<boolean> {
  console.log("\n--- Test 1: curl ---");
  const destPath = path.join(tmpDir, "curl.mp4");
  
  return new Promise((resolve) => {
    const curl = spawn("curl", [
      "-L", "-f", "-s",
      "-o", destPath,
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "-H", "Accept: video/mp4,video/*,*/*",
      "-H", `Referer: ${TEST_URL}`,
      "--compressed",
      TEST_URL
    ]);
    
    curl.on("close", (code) => {
      const result = checkFile(destPath);
      console.log(`curl: code=${code}, size=${result.size}, isVideo=${result.isVideo}`);
      resolve(result.success && result.isVideo);
    });
    
    curl.on("error", () => resolve(false));
  });
}

// Test 2: wget
async function testWget(): Promise<boolean> {
  console.log("\n--- Test 2: wget ---");
  const destPath = path.join(tmpDir, "wget.mp4");
  
  return new Promise((resolve) => {
    const wget = spawn("wget", [
      "-q", "-O", destPath,
      "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      TEST_URL
    ]);
    
    wget.on("close", (code) => {
      const result = checkFile(destPath);
      console.log(`wget: code=${code}, size=${result.size}, isVideo=${result.isVideo}`);
      resolve(result.success && result.isVideo);
    });
    
    wget.on("error", () => resolve(false));
  });
}

// Test 3: yt-dlp standard
async function testYtDlp(): Promise<boolean> {
  console.log("\n--- Test 3: yt-dlp ---");
  const destPath = path.join(tmpDir, "ytdlp.mp4");
  
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", [
      "-v",
      "--no-playlist",
      "-f", "best[ext=mp4]/best",
      "-o", destPath,
      TEST_URL
    ]);
    
    ytdlp.stdout.on("data", (d) => console.log(`[yt-dlp] ${d.toString().trim()}`));
    ytdlp.stderr.on("data", (d) => console.log(`[yt-dlp] ${d.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      const result = checkFile(destPath);
      console.log(`yt-dlp: code=${code}, size=${result.size}, isVideo=${result.isVideo}`);
      resolve(result.success && result.isVideo);
    });
    
    ytdlp.on("error", () => resolve(false));
    
    setTimeout(() => { ytdlp.kill(); resolve(false); }, 60000);
  });
}

// Test 4: yt-dlp with cookies from browser
async function testYtDlpCookies(): Promise<boolean> {
  console.log("\n--- Test 4: yt-dlp with browser cookies ---");
  const destPath = path.join(tmpDir, "ytdlp-cookies.mp4");
  
  return new Promise((resolve) => {
    const ytdlp = spawn("yt-dlp", [
      "-v",
      "--no-playlist",
      "-f", "best[ext=mp4]/best",
      "-o", destPath,
      "--cookies-from-browser", "chrome",
      TEST_URL
    ]);
    
    ytdlp.stdout.on("data", (d) => console.log(`[yt-dlp-cookies] ${d.toString().trim()}`));
    ytdlp.stderr.on("data", (d) => console.log(`[yt-dlp-cookies] ${d.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      const result = checkFile(destPath);
      console.log(`yt-dlp-cookies: code=${code}, size=${result.size}, isVideo=${result.isVideo}`);
      resolve(result.success && result.isVideo);
    });
    
    ytdlp.on("error", () => resolve(false));
    
    setTimeout(() => { ytdlp.kill(); resolve(false); }, 60000);
  });
}

// Test 5: Puppeteer
async function testPuppeteer(): Promise<boolean> {
  console.log("\n--- Test 5: Puppeteer ---");
  const destPath = path.join(tmpDir, "puppeteer.mp4");
  
  try {
    const puppeteer = await import('puppeteer-core');
    
    const browser = await puppeteer.default.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const videoUrls: string[] = [];
    page.on('response', (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('video') || url.includes('.mp4')) {
        console.log(`[Puppeteer] Found video: ${url.substring(0, 80)}...`);
        videoUrls.push(url);
      }
    });
    
    console.log(`[Puppeteer] Navigating to page...`);
    await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Get video src from page
    const videoSrc = await page.evaluate(() => {
      const video = (globalThis as any).document.querySelector('video');
      return video?.src || video?.querySelector('source')?.src || null;
    });
    
    if (videoSrc) {
      console.log(`[Puppeteer] Found video src: ${videoSrc}`);
      videoUrls.unshift(videoSrc);
    }
    
    // Also look for video URLs in page content
    const content = await page.content();
    const matches = content.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi) || [];
    videoUrls.push(...matches);
    
    await browser.close();
    
    console.log(`[Puppeteer] Found ${videoUrls.length} video URLs`);
    
    // Try downloading each URL
    for (const videoUrl of [...new Set(videoUrls)]) {
      console.log(`[Puppeteer] Trying to download: ${videoUrl.substring(0, 60)}...`);
      try {
        const resp = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': TEST_URL,
          },
        });
        
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          if (buffer.byteLength > 10000) {
            fs.writeFileSync(destPath, Buffer.from(buffer));
            const result = checkFile(destPath);
            console.log(`[Puppeteer] Downloaded: ${result.size} bytes, isVideo=${result.isVideo}`);
            if (result.isVideo) return true;
          }
        }
      } catch (e) {
        console.log(`[Puppeteer] Download failed: ${e}`);
      }
    }
    
    return false;
  } catch (error) {
    console.log(`[Puppeteer] Error: ${error}`);
    return false;
  }
}

// Test 6: gallery-dl (alternative to yt-dlp)
async function testGalleryDl(): Promise<boolean> {
  console.log("\n--- Test 6: gallery-dl ---");
  
  return new Promise((resolve) => {
    const gd = spawn("gallery-dl", [
      "-v",
      "-d", tmpDir,
      TEST_URL
    ]);
    
    gd.stdout.on("data", (d) => console.log(`[gallery-dl] ${d.toString().trim()}`));
    gd.stderr.on("data", (d) => console.log(`[gallery-dl] ${d.toString().trim()}`));
    
    gd.on("close", (code) => {
      // Check if any video files were downloaded
      const files = fs.readdirSync(tmpDir).filter(f => /\.(mp4|webm|mov)$/i.test(f));
      console.log(`gallery-dl: code=${code}, files found: ${files.length}`);
      resolve(files.length > 0);
    });
    
    gd.on("error", () => {
      console.log(`gallery-dl not installed`);
      resolve(false);
    });
    
    setTimeout(() => { gd.kill(); resolve(false); }, 60000);
  });
}

// Main test runner
async function runTests() {
  const results: Record<string, boolean> = {};
  
  results['curl'] = await testCurl();
  results['wget'] = await testWget();
  results['yt-dlp'] = await testYtDlp();
  results['yt-dlp-cookies'] = await testYtDlpCookies();
  results['puppeteer'] = await testPuppeteer();
  results['gallery-dl'] = await testGalleryDl();
  
  console.log(`\n========================================`);
  console.log(`RESULTS:`);
  console.log(`========================================`);
  for (const [method, success] of Object.entries(results)) {
    console.log(`${method}: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  
  // List downloaded files
  console.log(`\nFiles in ${tmpDir}:`);
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  ${file}: ${stats.size} bytes`);
  }
  
  // Cleanup
  // fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\nTemp files kept at: ${tmpDir}`);
}

runTests().catch(console.error);

import "dotenv/config";
import { Worker as BullWorker, Job } from "bullmq";
import Redis from "ioredis";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadVideo, checkCapabilities } from "./download.js";
import { notifyJobStarted, notifyJobCompleted, notifyJobFailed, notifyCreditsLow } from "./userNotify.js";

const WORKER_ID = process.env.WORKER_ID ?? `worker-${Math.random().toString(16).slice(2, 10)}`;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const INPAINT_SERVICE_URL = process.env.INPAINT_SERVICE_URL || "http://localhost:8081";

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
console.log(`[Worker] Supabase URL: ${supabaseUrl || '(not set)'}`);
console.log(`[Worker] Supabase Key: ${supabaseKey ? '***' + supabaseKey.slice(-8) : '(not set)'}`);
const supabase = createClient(supabaseUrl, supabaseKey);

type ProcessingMode = "crop" | "inpaint" | "auto";

interface JobData {
  jobId: string;
  inputUrl: string;
  inputFilename: string;
  cropPixels: number;
  cropPosition: "top" | "bottom" | "left" | "right";
  platform: string;
  processingMode: ProcessingMode;
  webhookUrl?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

// Download using curl (often works when fetch doesn't due to TLS/HTTP2 handling)
async function downloadWithCurl(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[Worker] Trying curl for: ${url}`);
    
    const curl = spawn("curl", [
      "-L",  // Follow redirects
      "-f",  // Fail silently on HTTP errors
      "-s",  // Silent mode
      "-o", destPath,
      "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "-H", "Accept: video/mp4,video/*,*/*",
      "-H", `Referer: ${url}`,
      "--compressed",
      "--max-time", "120",
      url
    ]);
    
    curl.stderr.on("data", (data) => console.log(`[curl] ${data.toString().trim()}`));
    
    curl.on("close", (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        if (size > 10000) {
          console.log(`[Worker] ✅ curl downloaded ${size} bytes`);
          resolve(true);
        } else {
          console.log(`[Worker] curl file too small: ${size} bytes`);
          fs.unlinkSync(destPath);
          resolve(false);
        }
      } else {
        console.log(`[Worker] curl failed with code ${code}`);
        resolve(false);
      }
    });
    
    curl.on("error", (err) => {
      console.log(`[Worker] curl not available: ${err.message}`);
      resolve(false);
    });
  });
}

// Download using wget (alternative to curl)
async function downloadWithWget(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[Worker] Trying wget for: ${url}`);
    
    const wget = spawn("wget", [
      "-q",  // Quiet
      "-O", destPath,
      "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "--header=Accept: video/mp4,video/*,*/*",
      `--header=Referer: ${url}`,
      "--timeout=120",
      "--tries=2",
      url
    ]);
    
    wget.stderr.on("data", (data) => console.log(`[wget] ${data.toString().trim()}`));
    
    wget.on("close", (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        if (size > 10000) {
          console.log(`[Worker] ✅ wget downloaded ${size} bytes`);
          resolve(true);
        } else {
          console.log(`[Worker] wget file too small: ${size} bytes`);
          fs.unlinkSync(destPath);
          resolve(false);
        }
      } else {
        console.log(`[Worker] wget failed with code ${code}`);
        resolve(false);
      }
    });
    
    wget.on("error", (err) => {
      console.log(`[Worker] wget not available: ${err.message}`);
      resolve(false);
    });
  });
}

// Download using yt-dlp with impersonation (bypasses more protections)
async function downloadWithYtDlpImpersonate(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[Worker] Trying yt-dlp with impersonation for: ${url}`);
    
    const ytdlp = spawn("yt-dlp", [
      "--no-warnings",
      "--no-playlist",
      "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--output", destPath,
      "--no-check-certificates",
      "--extractor-args", "generic:impersonate",
      "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      url
    ]);
    
    ytdlp.stdout.on("data", (data) => console.log(`[yt-dlp-imp] ${data.toString().trim()}`));
    ytdlp.stderr.on("data", (data) => console.log(`[yt-dlp-imp] ${data.toString().trim()}`));
    
    ytdlp.on("close", (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        console.log(`[Worker] ✅ yt-dlp (impersonate) downloaded ${size} bytes`);
        resolve(true);
      } else {
        console.log(`[Worker] yt-dlp (impersonate) failed with code ${code}`);
        resolve(false);
      }
    });
    
    ytdlp.on("error", (err) => {
      console.log(`[Worker] yt-dlp not available: ${err.message}`);
      resolve(false);
    });
    
    setTimeout(() => {
      ytdlp.kill();
      resolve(false);
    }, 90000);
  });
}

// Use Puppeteer to extract video URL from pages with Cloudflare protection
async function downloadWithPuppeteer(url: string, destPath: string): Promise<boolean> {
  console.log(`[Worker] Trying Puppeteer for: ${url}`);
  
  try {
    const puppeteer = await import('puppeteer-core');
    
    // Try to find Chrome/Chromium
    const possiblePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      process.env.CHROME_PATH,
    ].filter(Boolean);
    
    let executablePath: string | undefined;
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
    
    if (!executablePath) {
      console.log(`[Worker] Chrome/Chromium not found, skipping Puppeteer`);
      return false;
    }
    
    console.log(`[Worker] Using browser: ${executablePath}`);
    
    const browser = await puppeteer.default.launch({
      executablePath,
      headless: 'shell', // Use new headless mode for better compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    const page = await browser.newPage();
    
    // Anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty((globalThis as any).navigator, 'webdriver', { get: () => false });
    });
    
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Capture video URLs from network (including signed URLs)
    const videoUrls: { url: string; size: number; contentType: string }[] = [];
    page.on('response', (response) => {
      const respUrl = response.url();
      const contentType = response.headers()['content-type'] || '';
      const contentLength = parseInt(response.headers()['content-length'] || '0');
      
      // Look for video content or video-related URLs
      if (contentType.includes('video') || 
          respUrl.includes('video') ||
          respUrl.includes('.mp4') ||
          respUrl.includes('/raw') ||
          respUrl.includes('media')) {
        console.log(`[Worker] Network video: ${respUrl.substring(0, 80)}... (${contentLength} bytes)`);
        videoUrls.push({ url: respUrl, size: contentLength, contentType });
      }
    });
    
    // Navigate to the page
    console.log(`[Worker] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    
    // Wait for video element to load
    console.log(`[Worker] Waiting for video to load...`);
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to click/play video to trigger loading
    try {
      await page.click('video');
      await new Promise(r => setTimeout(r, 2000));
    } catch {
      // Video might auto-play
    }
    
    // Get video element src (this is the key - it contains signed Azure URL)
    const videoInfo = await page.evaluate((): { src: string | null; currentSrc: string | null; duration: number } => {
      const doc = (globalThis as any).document;
      const video = doc.querySelector('video');
      if (video) {
        return {
          src: video.src || null,
          currentSrc: video.currentSrc || null,
          duration: video.duration || 0,
        };
      }
      return { src: null, currentSrc: null, duration: 0 };
    });
    
    await browser.close();
    
    // Prioritize video element src (contains signed URL that works)
    const urlsToTry: string[] = [];
    
    if (videoInfo.src) {
      console.log(`[Worker] Found video.src: ${videoInfo.src.substring(0, 80)}...`);
      urlsToTry.push(videoInfo.src);
    }
    if (videoInfo.currentSrc && videoInfo.currentSrc !== videoInfo.src) {
      urlsToTry.push(videoInfo.currentSrc);
    }
    
    // Add network-captured video URLs, sorted by size (largest first)
    const sortedNetworkUrls = videoUrls
      .filter(v => v.contentType.includes('video') || v.size > 100000)
      .sort((a, b) => b.size - a.size)
      .map(v => v.url);
    urlsToTry.push(...sortedNetworkUrls);
    
    console.log(`[Worker] Found ${urlsToTry.length} video URLs to try`);
    
    // Try to download each URL
    for (const videoUrl of [...new Set(urlsToTry)]) {
      console.log(`[Worker] Downloading: ${videoUrl.substring(0, 80)}...`);
      try {
        const resp = await fetch(videoUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': url,
            'Origin': new URL(url).origin,
          },
        });
        
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          console.log(`[Worker] Downloaded ${buffer.byteLength} bytes`);
          
          // Verify it's a real video (check MP4 signature or size)
          const header = new Uint8Array(buffer.slice(0, 12));
          const isMp4 = header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70;
          
          if (isMp4 || buffer.byteLength > 500000) { // MP4 signature or > 500KB
            fs.writeFileSync(destPath, Buffer.from(buffer));
            console.log(`[Worker] ✅ Puppeteer download successful: ${buffer.byteLength} bytes`);
            return true;
          } else {
            console.log(`[Worker] Not a valid video file, trying next URL...`);
          }
        }
      } catch (e) {
        console.log(`[Worker] Download failed: ${e}`);
      }
    }
    
    return false;
  } catch (error) {
    console.log(`[Worker] Puppeteer error: ${error}`);
    return false;
  }
}

// Download video using yt-dlp (handles most video sites)
async function downloadWithYtDlp(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`[Worker] Trying yt-dlp for: ${url}`);
    
    const ytdlp = spawn("yt-dlp", [
      "--no-warnings",
      "--no-playlist",
      "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "--output", destPath,
      "--no-check-certificates",
      "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      url
    ]);
    
    let stderr = "";
    ytdlp.stdout.on("data", (data) => console.log(`[yt-dlp] ${data.toString().trim()}`));
    ytdlp.stderr.on("data", (data) => { 
      stderr += data.toString();
      console.log(`[yt-dlp] ${data.toString().trim()}`);
    });
    
    ytdlp.on("close", (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        console.log(`[Worker] ✅ yt-dlp downloaded ${size} bytes`);
        resolve(true);
      } else {
        console.log(`[Worker] yt-dlp failed with code ${code}`);
        resolve(false);
      }
    });
    
    ytdlp.on("error", (err) => {
      console.log(`[Worker] yt-dlp not available: ${err.message}`);
      resolve(false);
    });
    
    // Timeout after 60 seconds
    setTimeout(() => {
      ytdlp.kill();
      resolve(false);
    }, 60000);
  });
}

// Simple direct download with browser headers
async function downloadDirect(url: string, destPath: string): Promise<boolean> {
  console.log(`[Worker] Trying direct download: ${url}`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'video/mp4,video/*,application/octet-stream,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': url,
  };
  
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    console.log(`[Worker] Response: ${response.status} ${response.statusText}`);
    console.log(`[Worker] Content-Type: ${response.headers.get('content-type')}`);
    
    if (!response.ok) {
      console.log(`[Worker] Direct download failed: ${response.status}`);
      return false;
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // If it's HTML, we need to extract the video URL
    if (contentType.includes('text/html')) {
      console.log(`[Worker] Got HTML, will try to extract video URL`);
      return false;
    }
    
    const buffer = await response.arrayBuffer();
    
    // Check if it's a valid video (at least 10KB and looks like video data)
    if (buffer.byteLength < 10000) {
      console.log(`[Worker] File too small: ${buffer.byteLength} bytes`);
      return false;
    }
    
    fs.writeFileSync(destPath, Buffer.from(buffer));
    console.log(`[Worker] ✅ Direct download successful: ${buffer.byteLength} bytes`);
    return true;
  } catch (error) {
    console.log(`[Worker] Direct download error: ${error}`);
    return false;
  }
}

// Extract video URL from HTML page and download
async function downloadFromPage(url: string, destPath: string): Promise<boolean> {
  console.log(`[Worker] Fetching page to extract video URL: ${url}`);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  
  try {
    const response = await fetch(url, { headers, redirect: 'follow' });
    if (!response.ok) {
      console.log(`[Worker] Page fetch failed: ${response.status}`);
      return false;
    }
    
    const html = await response.text();
    console.log(`[Worker] Page size: ${html.length} chars`);
    
    // Extract video URLs from HTML
    const videoPatterns = [
      // JSON data patterns
      /"(?:video_?[Uu]rl|download_?[Uu]rl|mp4_?[Uu]rl|stream_?[Uu]rl|file_?[Uu]rl|src|url)"\s*:\s*"(https?:\/\/[^"]+\.(?:mp4|webm|mov)[^"]*)"/gi,
      /"(?:video_?[Uu]rl|download_?[Uu]rl|mp4_?[Uu]rl|stream_?[Uu]rl|file_?[Uu]rl|src|url)"\s*:\s*"(https?:\/\/[^"]+)"/gi,
      // HTML video tags  
      /<video[^>]*\ssrc=["']([^"']+)["']/gi,
      /<source[^>]*\ssrc=["']([^"']+)["'][^>]*type=["']video/gi,
      // Data attributes
      /data-(?:video-)?(?:src|url)=["']([^"']+\.(?:mp4|webm|mov)[^"']*)["']/gi,
      // Direct URLs in content
      /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi,
      /https?:\/\/[^\s"'<>]*\/video[^\s"'<>]*\.mp4[^\s"'<>]*/gi,
    ];
    
    const foundUrls: string[] = [];
    
    for (const pattern of videoPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let videoUrl = (match[1] || match[0])
          .replace(/\\u002F/g, '/')
          .replace(/\\\//g, '/')
          .replace(/\\"/g, '')
          .replace(/&amp;/g, '&');
        
        if (videoUrl.startsWith('http') && !foundUrls.includes(videoUrl)) {
          foundUrls.push(videoUrl);
        }
      }
    }
    
    console.log(`[Worker] Found ${foundUrls.length} video URLs in page`);
    foundUrls.slice(0, 5).forEach((u, i) => console.log(`[Worker]   ${i+1}. ${u.substring(0, 80)}...`));
    
    // Try to download each found URL
    for (const videoUrl of foundUrls) {
      const videoHeaders = {
        ...headers,
        'Accept': 'video/mp4,video/*,*/*',
        'Referer': url,
        'Origin': new URL(url).origin,
      };
      
      try {
        const videoResp = await fetch(videoUrl, { headers: videoHeaders, redirect: 'follow' });
        if (videoResp.ok) {
          const buffer = await videoResp.arrayBuffer();
          if (buffer.byteLength > 10000) {
            fs.writeFileSync(destPath, Buffer.from(buffer));
            console.log(`[Worker] ✅ Downloaded from extracted URL: ${buffer.byteLength} bytes`);
            return true;
          }
        }
      } catch (e) {
        console.log(`[Worker] Failed to download ${videoUrl.substring(0, 50)}: ${e}`);
      }
    }
    
    return false;
  } catch (error) {
    console.log(`[Worker] Page extraction error: ${error}`);
    return false;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`[Worker] 📥 Starting download...`);
  console.log(`[Worker]    URL: ${url}`);
  
  // Use the scalable download module (works on local, Vercel, Railway)
  const result = await downloadVideo(url, destPath);
  
  if (!result.success) {
    console.error(`[Worker] ❌ Download failed: ${result.error}`);
    throw new Error(
      `Failed to download video: ${result.error}. Tips: 1) Right-click the video → "Copy video address" and paste that URL, ` +
      `2) Download the video to your device and upload it directly, ` +
      `3) Try a different video hosting platform.`
    );
  }
  
  console.log(`[Worker] ✅ Downloaded ${result.size} bytes via ${result.method}`);
  
  // Validate the downloaded file is a real video
  if (!fs.existsSync(destPath)) {
    throw new Error('Download completed but file not found on disk');
  }
  
  const fileSize = fs.statSync(destPath).size;
  console.log(`[Worker]    File size on disk: ${fileSize} bytes`);
  
  if (fileSize < 10000) {
    // Read first bytes to see what we got
    const buffer = Buffer.alloc(Math.min(500, fileSize));
    const fd = fs.openSync(destPath, 'r');
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    const content = buffer.toString('utf8').substring(0, 200);
    console.error(`[Worker] ❌ File too small (${fileSize} bytes). Content preview: ${content}`);
    throw new Error(
      `Downloaded file is too small (${fileSize} bytes) and may not be a valid video. ` +
      `The URL might require authentication or be blocked. Try: 1) Copy the direct video URL, ` +
      `2) Upload the video file directly.`
    );
  }
  
  // Check for valid video signature (MP4, WebM, etc.)
  const header = Buffer.alloc(12);
  const fd = fs.openSync(destPath, 'r');
  fs.readSync(fd, header, 0, 12, 0);
  fs.closeSync(fd);
  
  const isMp4 = header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70; // ftyp
  const isWebm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3; // EBML
  const isMov = header[4] === 0x6d && header[5] === 0x6f && header[6] === 0x6f && header[7] === 0x76; // moov
  
  // Check for HTML or invalid content
  const textBuffer = Buffer.alloc(500);
  const fd2 = fs.openSync(destPath, 'r');
  fs.readSync(fd2, textBuffer, 0, 500, 0);
  fs.closeSync(fd2);
  const textContent = textBuffer.toString('utf8').toLowerCase();
  
  if (textContent.includes('<!doctype') || textContent.includes('<html') || textContent.includes('cloudflare') || textContent.includes('login')) {
    console.error(`[Worker] ❌ Downloaded file is HTML, not video`);
    console.error(`[Worker]    Content preview: ${textContent.substring(0, 100)}`);
    throw new Error(
      `Downloaded file is a webpage, not a video. The URL may be protected or require login. ` +
      `Try: 1) Right-click the video → "Copy video address", 2) Upload the video file directly.`
    );
  }
  
  if (!isMp4 && !isWebm && !isMov) {
    // Not a recognized video format
    if (fileSize < 500000) {
      console.error(`[Worker] ❌ Downloaded file is not a valid video format`);
      console.error(`[Worker]    Size: ${fileSize} bytes, Header: ${header.toString('hex')}`);
      throw new Error(
        `Downloaded file is not a valid video (${(fileSize/1024).toFixed(1)} KB). ` +
        `The URL may require login or be protected. Try uploading the video file directly.`
      );
    }
    console.log(`[Worker]    ⚠️ Unknown video format, proceeding anyway (${(fileSize/1024/1024).toFixed(2)} MB)`);
  } else {
    console.log(`[Worker]    Video signature: ${isMp4 ? 'MP4' : isWebm ? 'WebM' : 'MOV'}`);
  }
}

async function getVideoInfo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,duration",
      "-of", "json",
      filePath
    ]);

    let output = "";
    ffprobe.stdout.on("data", (data) => { output += data.toString(); });
    ffprobe.stderr.on("data", (data) => { console.error(`ffprobe stderr: ${data}`); });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        // Check if the file might be HTML instead of video
        const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
        const errorHint = fileSize < 500000 
          ? " The downloaded file may not be a valid video (possibly HTML/login page). Try uploading the video directly or use a direct video URL."
          : "";
        reject(new Error(`ffprobe exited with code ${code}.${errorHint}`));
        return;
      }
      try {
        const parsed = JSON.parse(output);
        const stream = parsed.streams[0];
        resolve({
          width: parseInt(stream.width),
          height: parseInt(stream.height),
          duration: parseFloat(stream.duration || "0"),
        });
      } catch (e) {
        reject(new Error(`Failed to parse ffprobe output: ${e}`));
      }
    });
  });
}

async function removeWatermarkCrop(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string,
  videoInfo: VideoInfo
): Promise<{ mode: string }> {
  return new Promise((resolve, reject) => {
    let cropFilter: string;
    const { width, height } = videoInfo;

    switch (cropPosition) {
      case "top":
        cropFilter = `crop=${width}:${height - cropPixels}:0:${cropPixels}`;
        break;
      case "bottom":
        cropFilter = `crop=${width}:${height - cropPixels}:0:0`;
        break;
      case "left":
        cropFilter = `crop=${width - cropPixels}:${height}:${cropPixels}:0`;
        break;
      case "right":
        cropFilter = `crop=${width - cropPixels}:${height}:0:0`;
        break;
      default:
        cropFilter = `crop=${width}:${height - cropPixels}:0:0`;
    }

    console.log(`[Worker] 🎬 FFmpeg starting...`);
    console.log(`[Worker]    Input: ${inputPath}`);
    console.log(`[Worker]    Output: ${outputPath}`);
    console.log(`[Worker]    Crop filter: ${cropFilter}`);

    const ffmpegArgs = [
      "-y",
      "-i", inputPath,
      "-vf", cropFilter,
      "-c:a", "copy",
      "-preset", "fast",
      outputPath
    ];
    console.log(`[Worker]    Command: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let stderrOutput = '';
    ffmpeg.stdout.on("data", (data) => { 
      console.log(`[FFmpeg stdout] ${data}`); 
    });
    ffmpeg.stderr.on("data", (data) => { 
      const msg = data.toString();
      stderrOutput += msg;
      // Only log progress updates, skip the verbose codec info
      if (msg.includes('frame=') || msg.includes('time=') || msg.includes('error') || msg.includes('Error')) {
        console.log(`[FFmpeg] ${msg.trim()}`);
      }
    });

    ffmpeg.on("close", (code) => {
      console.log(`[Worker] 🎬 FFmpeg exited with code: ${code}`);
      if (code === 0) {
        console.log(`[Worker] ✅ FFmpeg processing successful`);
        resolve({ mode: "crop" });
      } else {
        console.error(`[Worker] ❌ FFmpeg failed with code ${code}`);
        console.error(`[Worker]    Last stderr: ${stderrOutput.slice(-500)}`);
        reject(new Error(`FFmpeg exited with code ${code}. Check logs for details.`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error(`[Worker] ❌ FFmpeg spawn error: ${err.message}`);
      reject(new Error(`FFmpeg error: ${err.message}`));
    });
  });
}

async function removeWatermarkInpaint(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string
): Promise<{ mode: string; watermarksDetected?: number }> {
  console.log(`[Worker] Using inpainting mode (YOLO + LAMA)`);
  
  // Read input file
  const fileBuffer = fs.readFileSync(inputPath);
  const blob = new Blob([fileBuffer], { type: "video/mp4" });
  
  // Create form data
  const formData = new FormData();
  formData.append("video", blob, "input.mp4");
  formData.append("mode", "inpaint");
  formData.append("crop_pixels", cropPixels.toString());
  formData.append("crop_position", cropPosition);
  
  // Call inpainting service
  const response = await fetch(`${INPAINT_SERVICE_URL}/process`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inpainting service error: ${response.status} - ${errorText}`);
  }
  
  // Save response to output file
  const outputBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(outputBuffer));
  
  console.log(`[Worker] Inpainting complete`);
  
  return { mode: "inpaint" };
}

async function removeWatermark(
  inputPath: string,
  outputPath: string,
  cropPixels: number,
  cropPosition: string,
  videoInfo: VideoInfo,
  processingMode: ProcessingMode = "inpaint"
): Promise<{ mode: string; watermarksDetected?: number }> {
  // Always use AI inpainting for all sources - no cropping
  // This preserves full frame and uses YOLO detection + LAMA/OpenCV inpainting
  console.log(`[Worker] 🤖 Using AI inpainting (preserves full frame)`);
  return await removeWatermarkInpaint(inputPath, outputPath, cropPixels, cropPosition);
}

async function uploadToStorage(filePath: string, jobId: string, filename: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `processed/${jobId}/${filename}`;

  const { error } = await supabase.storage
    .from("bl_videos")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from("bl_videos").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function sendWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`[Worker] Webhook sent to ${webhookUrl}`);
  } catch (error) {
    console.error(`[Worker] Webhook failed:`, error);
  }
}

async function processJob(job: Job<JobData>): Promise<void> {
  const { jobId, inputUrl, inputFilename, cropPixels, cropPosition, processingMode = "crop", webhookUrl } = job.data;
  const startTime = Date.now();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[Worker] 🎬 STARTING JOB: ${jobId}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`[Worker] 📋 Job Details:`);
  console.log(`[Worker]    Input URL: ${inputUrl}`);
  console.log(`[Worker]    Platform: ${job.data.platform || 'auto'}`);
  console.log(`[Worker]    Crop Pixels: ${cropPixels}px (${cropPosition})`);
  console.log(`[Worker]    Processing Mode: ${processingMode}`);
  console.log(`[Worker]    Webhook: ${webhookUrl || 'none'}`);

  // Helper to update progress
  const updateProgress = async (progress: number, step: string) => {
    console.log(`[Worker] 📊 Progress: ${progress}% - ${step}`);
    const { error } = await supabase
      .from("bl_jobs")
      .update({ progress, current_step: step })
      .eq("id", jobId);
    if (error) console.error(`[Worker] ❌ Failed to update progress:`, error.message);
  };

  // Update status to processing
  console.log(`[Worker] 📊 Step 1/6: Updating job status to 'processing'...`);
  const { error: statusError } = await supabase
    .from("bl_jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), progress: 5, current_step: "Starting" })
    .eq("id", jobId);
  if (statusError) {
    console.error(`[Worker] ❌ Failed to update status to processing:`, statusError.message);
  } else {
    console.log(`[Worker] ✅ Status updated to 'processing'`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `blanklogo-${jobId}-`));
  const inputPath = path.join(tmpDir, "input.mp4");
  // Ensure output filename always has .mp4 extension
  const baseName = inputFilename.replace(/\.[^.]+$/, "") || inputFilename;
  const outputFilename = `${baseName}_clean.mp4`;
  const outputPath = path.join(tmpDir, outputFilename);
  console.log(`[Worker] 📁 Temp directory: ${tmpDir}`);

  try {
    // Download input video
    await updateProgress(10, "Downloading video");
    console.log(`[Worker] ⬇️ Step 2/6: Downloading video...`);
    console.log(`[Worker]    URL: ${inputUrl}`);
    const downloadStart = Date.now();
    await downloadFile(inputUrl, inputPath);
    const downloadTime = Date.now() - downloadStart;
    const inputSize = fs.statSync(inputPath).size;
    console.log(`[Worker] ✅ Download complete: ${(inputSize / 1024 / 1024).toFixed(2)} MB in ${(downloadTime / 1000).toFixed(1)}s`);

    // Get video info
    await updateProgress(30, "Analyzing video");
    console.log(`[Worker] 🔍 Step 3/6: Analyzing video...`);
    const videoInfo = await getVideoInfo(inputPath);
    console.log(`[Worker] ✅ Video analysis complete:`);
    console.log(`[Worker]    Resolution: ${videoInfo.width}x${videoInfo.height}`);
    console.log(`[Worker]    Duration: ${videoInfo.duration}s`);

    // Upload original video for before/after comparison
    console.log(`[Worker] 📤 Uploading original video for comparison...`);
    const originalFilename = `original_${inputFilename}.mp4`;
    const originalUrl = await uploadToStorage(inputPath, jobId, originalFilename);
    console.log(`[Worker] ✅ Original video uploaded: ${originalUrl}`);

    // Update input info in database with playable URL
    console.log(`[Worker] 📊 Updating video metadata in database...`);
    await supabase
      .from("bl_jobs")
      .update({
        input_size_bytes: inputSize,
        input_duration_sec: videoInfo.duration,
        input_url: originalUrl,  // Update to playable URL instead of page URL
      })
      .eq("id", jobId);

    // Remove watermark
    await updateProgress(40, "Removing watermark");
    console.log(`[Worker] ✨ Step 4/6: Removing watermark...`);
    console.log(`[Worker]    Mode: ${processingMode}`);
    console.log(`[Worker]    Crop: ${cropPixels}px from ${cropPosition}`);
    const processStart = Date.now();
    const processResult = await removeWatermark(inputPath, outputPath, cropPixels, cropPosition, videoInfo, processingMode);
    const processTime = Date.now() - processStart;
    console.log(`[Worker] ✅ Watermark removal complete:`);
    console.log(`[Worker]    Method used: ${processResult.mode}`);
    console.log(`[Worker]    Processing time: ${(processTime / 1000).toFixed(1)}s`);
    const outputSize = fs.statSync(outputPath).size;
    console.log(`[Worker]    Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);

    // Upload processed video
    await updateProgress(70, "Uploading result");
    console.log(`[Worker] ⬆️ Step 5/6: Uploading processed video...`);
    const uploadStart = Date.now();
    const outputUrl = await uploadToStorage(outputPath, jobId, outputFilename);
    const uploadTime = Date.now() - uploadStart;
    console.log(`[Worker] ✅ Upload complete in ${(uploadTime / 1000).toFixed(1)}s`);
    console.log(`[Worker]    Output URL: ${outputUrl}`);

    const processingTime = Date.now() - startTime;

    // Update job as completed
    await updateProgress(90, "Finalizing");
    console.log(`[Worker] 📊 Step 6/6: Finalizing job...`);
    await supabase
      .from("bl_jobs")
      .update({
        status: "completed",
        progress: 100,
        current_step: "Complete",
        output_url: outputUrl,
        output_filename: outputFilename,
        output_size_bytes: outputSize,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .eq("id", jobId);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[Worker] ✅ JOB COMPLETED: ${jobId}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`[Worker]    Total time: ${(processingTime / 1000).toFixed(1)}s`);
    console.log(`[Worker]    Input: ${(inputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`[Worker]    Output: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`${'═'.repeat(60)}\n`);

    // Send webhook if configured
    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        job_id: jobId,
        status: "completed",
        output_url: outputUrl,
        processing_time_ms: processingTime,
      });
    }

    // Send email notification to user
    if (job.data.userId) {
      await notifyJobCompleted(
        job.data.userId,
        jobId,
        outputUrl,
        processingTime,
        job.data.platform || 'video'
      );
      
      // Check if credits are low and notify
      const { data: profile } = await supabase
        .from('bl_profiles')
        .select('credits_balance')
        .eq('id', job.data.userId)
        .single();
      
      if (profile && profile.credits_balance <= 5) {
        await notifyCreditsLow(job.data.userId, profile.credits_balance);
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    
    console.log(`\n${'═'.repeat(60)}`);
    console.error(`[Worker] ❌ JOB FAILED: ${jobId}`);
    console.log(`${'═'.repeat(60)}`);
    console.error(`[Worker]    Error: ${errorMessage}`);
    if (errorStack) {
      console.error(`[Worker]    Stack: ${errorStack.split('\n').slice(0, 3).join('\n')}`);
    }
    console.log(`${'═'.repeat(60)}\n`);

    await supabase
      .from("bl_jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (webhookUrl) {
      await sendWebhook(webhookUrl, {
        job_id: jobId,
        status: "failed",
        error: errorMessage,
      });
    }

    // Send email notification to user on failure
    if (job.data.userId) {
      await notifyJobFailed(
        job.data.userId,
        jobId,
        errorMessage,
        job.data.platform || 'video'
      );
    }

    throw error;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`[Worker] Failed to cleanup temp dir:`, e);
    }
  }
}

async function main(): Promise<void> {
  console.log(`[Worker] Starting BlankLogo worker ${WORKER_ID}`);
  console.log(`[Worker] Concurrency: ${CONCURRENCY}`);
  
  // Log download capabilities
  const caps = await checkCapabilities();
  console.log(`[Worker] Environment: ${caps.environment}`);
  console.log(`[Worker] Capabilities: Chrome=${caps.chrome}, Chromium=${caps.chromium}, Browserless=${caps.browserless}, yt-dlp=${caps.ytdlp}, curl=${caps.curl}`);

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  
  redis.on('connect', () => {
    console.log(`[Worker] ✅ Redis connected: ${REDIS_URL}`);
  });
  
  redis.on('error', (err) => {
    console.error(`[Worker] ❌ Redis error:`, err.message);
  });

  const worker = new BullWorker<JobData>(
    "watermark-removal",
    async (job) => {
      const attemptNum = job.attemptsMade + 1;
      const maxAttempts = 3;
      console.log(`\n[Worker] 📥 RECEIVED JOB: ${job.id} (attempt ${attemptNum}/${maxAttempts})`);
      console.log(`[Worker]    Data:`, JSON.stringify(job.data, null, 2));
      await processJob(job);
    },
    {
      connection: redis,
      concurrency: CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          // Exponential backoff: 5s, 10s, 20s
          return Math.min(5000 * Math.pow(2, attemptsMade), 60000);
        },
      },
    }
  );

  worker.on("ready", () => {
    console.log(`[Worker] ✅ Worker connected to queue "watermark-removal"`);
  });

  worker.on("active", (job) => {
    console.log(`[Worker] 🔄 Job ${job.id} is now active`);
  });

  worker.on("completed", (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("[Worker] ❌ Worker error:", error);
  });

  console.log("[Worker] Worker is ready and listening for jobs");
  console.log(`[Worker] Queue: watermark-removal`);
  console.log(`[Worker] Redis: ${REDIS_URL}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[Worker] Shutting down...");
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});

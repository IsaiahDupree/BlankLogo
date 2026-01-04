/**
 * Scalable Video Download Module
 * Works on local dev, Vercel, Railway, and other cloud platforms
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { notifyDownloadFailure } from "./notify.js";

// Environment detection
const IS_VERCEL = !!process.env.VERCEL;
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const IS_AWS_LAMBDA = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const IS_CLOUD = IS_VERCEL || IS_RAILWAY || IS_AWS_LAMBDA || !!process.env.CLOUD_ENV;

// External service URLs (configure via env vars)
const BROWSERLESS_URL = process.env.BROWSERLESS_URL; // e.g., wss://chrome.browserless.io?token=YOUR_TOKEN
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

interface DownloadResult {
  success: boolean;
  filePath?: string;
  size?: number;
  method?: string;
  error?: string;
}

/**
 * Get Chrome executable path based on environment
 */
async function getChromePath(): Promise<string | null> {
  // Local development paths
  const localPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
    '/usr/bin/google-chrome', // Linux
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
    process.env.CHROME_PATH,
  ].filter(Boolean) as string[];

  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // For serverless/cloud, use @sparticuz/chromium
  if (IS_CLOUD) {
    try {
      const chromium = await import('@sparticuz/chromium');
      return await chromium.default.executablePath();
    } catch (e) {
      console.log('[Download] @sparticuz/chromium not available:', e);
    }
  }

  return null;
}

/**
 * Download video using Puppeteer with Stealth (local Chrome or @sparticuz/chromium)
 */
async function downloadWithLocalPuppeteer(url: string, destPath: string): Promise<DownloadResult> {
  console.log('[Download] Trying Puppeteer with Stealth...');
  
  try {
    const chromePath = await getChromePath();
    
    if (!chromePath) {
      return { success: false, error: 'Chrome not found' };
    }
    
    console.log(`[Download] Using Chrome: ${chromePath}`);
    
    // Use puppeteer-extra with stealth plugin for Cloudflare bypass
    const puppeteerExtra = await import('puppeteer-extra');
    const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
    
    puppeteerExtra.default.use(StealthPlugin.default());
    console.log('[Download] Stealth plugin loaded');
    
    // Get chromium args for serverless if needed
    let args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ];
    
    if (IS_CLOUD) {
      try {
        const chromium = await import('@sparticuz/chromium');
        args = [...chromium.default.args, '--disable-blink-features=AutomationControlled'];
      } catch (e) {
        console.log('[Download] Chromium import failed (expected in local env):', e instanceof Error ? e.message : e);
      }
    }
    
    const browser = await puppeteerExtra.default.launch({
      executablePath: chromePath,
      headless: 'new',
      args,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    
    // Capture video URLs
    const videoUrls: { url: string; size: number }[] = [];
    page.on('response', (response: any) => {
      const respUrl = response.url();
      const ct = response.headers()['content-type'] || '';
      const size = parseInt(response.headers()['content-length'] || '0');
      if (ct.includes('video') || respUrl.includes('.mp4') || respUrl.includes('/raw')) {
        videoUrls.push({ url: respUrl, size });
      }
    });
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));
    
    // Get video.src
    const videoSrc = await page.evaluate(() => {
      const video = (globalThis as any).document.querySelector('video');
      return video?.src || video?.currentSrc || null;
    });
    
    await browser.close();
    
    // Download the video
    const urlsToTry = videoSrc ? [videoSrc, ...videoUrls.map(v => v.url)] : videoUrls.map(v => v.url);
    
    for (const videoUrl of [...new Set(urlsToTry)]) {
      try {
        const resp = await fetch(videoUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': url },
        });
        
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          if (buffer.byteLength > 100000) {
            fs.writeFileSync(destPath, Buffer.from(buffer));
            return { success: true, filePath: destPath, size: buffer.byteLength, method: 'puppeteer-local' };
          }
        }
      } catch (e) {
        console.log('[Download] Failed to fetch video URL:', videoUrl.substring(0, 80), e instanceof Error ? e.message : e);
      }
    }
    
    return { success: false, error: 'No valid video URL found' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download video using Browserless.io (cloud browser service)
 */
async function downloadWithBrowserless(url: string, destPath: string): Promise<DownloadResult> {
  if (!BROWSERLESS_URL && !BROWSERLESS_TOKEN) {
    return { success: false, error: 'Browserless not configured' };
  }
  
  console.log('[Download] Trying Browserless.io...');
  
  try {
    const puppeteer = await import('puppeteer-core');
    
    const wsEndpoint = BROWSERLESS_URL || `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`;
    
    const browser = await puppeteer.default.connect({
      browserWSEndpoint: wsEndpoint,
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const videoUrls: string[] = [];
    page.on('response', (response) => {
      const respUrl = response.url();
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('video') || respUrl.includes('.mp4') || respUrl.includes('/raw')) {
        videoUrls.push(respUrl);
      }
    });
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const videoSrc = await page.evaluate(() => {
      const video = (globalThis as any).document.querySelector('video');
      return video?.src || null;
    });
    
    await browser.close();
    
    const urlsToTry = videoSrc ? [videoSrc, ...videoUrls] : videoUrls;
    
    for (const videoUrl of [...new Set(urlsToTry)]) {
      try {
        const resp = await fetch(videoUrl, { headers: { 'Referer': url } });
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          if (buffer.byteLength > 100000) {
            fs.writeFileSync(destPath, Buffer.from(buffer));
            return { success: true, filePath: destPath, size: buffer.byteLength, method: 'browserless' };
          }
        }
      } catch (e) {
        console.log('[Download] Browserless fetch failed:', videoUrl.substring(0, 80), e instanceof Error ? e.message : e);
      }
    }
    
    return { success: false, error: 'No valid video URL found via Browserless' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download video using direct fetch (for direct video URLs)
 */
async function downloadDirect(url: string, destPath: string): Promise<DownloadResult> {
  console.log('[Download] Trying direct download...');
  
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'video/mp4,video/*,*/*',
        'Referer': url,
      },
      redirect: 'follow',
    });
    
    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }
    
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      return { success: false, error: 'Got HTML, not video' };
    }
    
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength < 10000) {
      return { success: false, error: 'File too small' };
    }
    
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return { success: true, filePath: destPath, size: buffer.byteLength, method: 'direct' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download video using curl (available on most platforms)
 */
async function downloadWithCurl(url: string, destPath: string): Promise<DownloadResult> {
  console.log('[Download] Trying curl...');
  
  return new Promise((resolve) => {
    const curl = spawn('curl', [
      '-L', '-f', '-s',
      '-o', destPath,
      '-A', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      '-H', 'Accept: video/mp4,video/*,*/*',
      '-H', `Referer: ${url}`,
      '--compressed',
      '--max-time', '120',
      url,
    ]);
    
    curl.on('close', (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        if (size > 10000) {
          resolve({ success: true, filePath: destPath, size, method: 'curl' });
        } else {
          fs.unlinkSync(destPath);
          resolve({ success: false, error: 'File too small' });
        }
      } else {
        resolve({ success: false, error: `curl exited with ${code}` });
      }
    });
    
    curl.on('error', () => resolve({ success: false, error: 'curl not available' }));
  });
}

/**
 * Download video using yt-dlp (if available)
 */
async function downloadWithYtDlp(url: string, destPath: string): Promise<DownloadResult> {
  console.log('[Download] Trying yt-dlp...');
  
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', [
      '--no-warnings',
      '--no-playlist',
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '-o', destPath,
      url,
    ]);
    
    ytdlp.on('close', (code) => {
      if (code === 0 && fs.existsSync(destPath)) {
        const size = fs.statSync(destPath).size;
        resolve({ success: true, filePath: destPath, size, method: 'yt-dlp' });
      } else {
        resolve({ success: false, error: `yt-dlp exited with ${code}` });
      }
    });
    
    ytdlp.on('error', () => resolve({ success: false, error: 'yt-dlp not available' }));
    
    setTimeout(() => { ytdlp.kill(); resolve({ success: false, error: 'timeout' }); }, 60000);
  });
}

/**
 * Main download function - tries all methods in order of preference
 */
export async function downloadVideo(url: string, destPath: string): Promise<DownloadResult> {
  console.log('[Download] ═══════════════════════════════════════════');
  console.log(`[Download] URL: ${url}`);
  console.log(`[Download] Dest: ${destPath}`);
  console.log(`[Download] Environment: ${IS_VERCEL ? 'Vercel' : IS_RAILWAY ? 'Railway' : IS_AWS_LAMBDA ? 'Lambda' : 'Local'}`);
  console.log('[Download] ═══════════════════════════════════════════');
  
  const isDirectVideoUrl = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
  
  // For direct video URLs, try simple methods first
  if (isDirectVideoUrl) {
    console.log('[Download] Direct video URL detected, trying fast methods...');
    
    let result = await downloadDirect(url, destPath);
    if (result.success) return result;
    
    result = await downloadWithCurl(url, destPath);
    if (result.success) return result;
  }
  
  // For page URLs or if direct methods failed, try browser-based extraction
  console.log('[Download] Trying browser-based extraction...');
  
  // Method 1: Browserless (best for cloud - no local Chrome needed)
  if (BROWSERLESS_URL || BROWSERLESS_TOKEN) {
    const result = await downloadWithBrowserless(url, destPath);
    if (result.success) return result;
  }
  
  // Method 2: Local Puppeteer (works on Railway with @sparticuz/chromium)
  {
    const result = await downloadWithLocalPuppeteer(url, destPath);
    if (result.success) return result;
  }
  
  // Method 3: yt-dlp (if installed)
  if (!IS_VERCEL) { // yt-dlp unlikely to work on Vercel
    const result = await downloadWithYtDlp(url, destPath);
    if (result.success) return result;
  }
  
  // Method 4: Try direct/curl as last resort
  if (!isDirectVideoUrl) {
    let result = await downloadDirect(url, destPath);
    if (result.success) return result;
    
    result = await downloadWithCurl(url, destPath);
    if (result.success) return result;
  }
  
  // Notify developers of the failure
  await notifyDownloadFailure(
    url,
    'All download methods failed',
    undefined,
    ['direct', 'curl', 'browserless', 'puppeteer', 'yt-dlp']
  );
  
  return {
    success: false,
    error: 'All download methods failed. Try uploading the video file directly.',
  };
}

/**
 * Check what download capabilities are available
 */
export async function checkCapabilities(): Promise<{
  chrome: boolean;
  chromium: boolean;
  browserless: boolean;
  ytdlp: boolean;
  curl: boolean;
  environment: string;
}> {
  const chromePath = await getChromePath();
  
  let ytdlpAvailable = false;
  try {
    const { execSync } = await import('child_process');
    execSync('which yt-dlp', { stdio: 'ignore' });
    ytdlpAvailable = true;
  } catch {
    // yt-dlp not installed - this is expected in some environments
  }
  
  let curlAvailable = false;
  try {
    const { execSync } = await import('child_process');
    execSync('which curl', { stdio: 'ignore' });
    curlAvailable = true;
  } catch {
    // curl not installed - this is expected in some environments
  }
  
  return {
    chrome: !!chromePath && !IS_CLOUD,
    chromium: IS_CLOUD && !!chromePath,
    browserless: !!(BROWSERLESS_URL || BROWSERLESS_TOKEN),
    ytdlp: ytdlpAvailable,
    curl: curlAvailable,
    environment: IS_VERCEL ? 'vercel' : IS_RAILWAY ? 'railway' : IS_AWS_LAMBDA ? 'lambda' : 'local',
  };
}

export default downloadVideo;

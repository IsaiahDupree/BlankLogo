import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const TEST_URL = "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sora-visible-"));
const destPath = path.join(tmpDir, "video.mp4");

console.log(`Testing with visible browser...`);
console.log(`URL: ${TEST_URL}`);
console.log(`Output: ${destPath}`);

async function main() {
  const puppeteer = await import('puppeteer-core');
  
  const browser = await puppeteer.default.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, // Visible browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });
  
  const page = await browser.newPage();
  
  // Remove webdriver detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Capture ALL network requests
  const allUrls: { url: string; contentType: string; size: number }[] = [];
  
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    const cl = parseInt(response.headers()['content-length'] || '0');
    
    if (ct.includes('video') || url.includes('.mp4') || url.includes('/video') || url.includes('media')) {
      console.log(`[Network] Video-like: ${url.substring(0, 100)}`);
      console.log(`          Content-Type: ${ct}, Size: ${cl}`);
      allUrls.push({ url, contentType: ct, size: cl });
    }
  });
  
  console.log(`\nNavigating to page...`);
  await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 60000 });
  
  console.log(`\nPage loaded. Waiting 10s for video to start...`);
  await new Promise(r => setTimeout(r, 10000));
  
  // Try to click play button if exists
  try {
    await page.click('video');
    console.log('Clicked video element');
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.log('No video element to click');
  }
  
  // Get video element info
  const videoInfo = await page.evaluate(() => {
    const doc = (globalThis as any).document;
    const video = doc.querySelector('video');
    if (video) {
      return {
        src: video.src,
        currentSrc: video.currentSrc,
        sources: Array.from(video.querySelectorAll('source')).map((s: any) => s.src),
        poster: video.poster,
        readyState: video.readyState,
        duration: video.duration,
      };
    }
    return null;
  });
  
  console.log(`\nVideo element info:`, JSON.stringify(videoInfo, null, 2));
  
  // Also get all URLs from page HTML
  const pageContent = await page.content();
  const mp4Matches = pageContent.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/gi) || [];
  const videoMatches = pageContent.match(/"[^"]*video[^"]*":\s*"([^"]+)"/gi) || [];
  
  console.log(`\nMP4 URLs in HTML: ${mp4Matches.length}`);
  mp4Matches.forEach(u => console.log(`  ${u.substring(0, 100)}`));
  
  console.log(`\nVideo URLs in JSON: ${videoMatches.length}`);
  videoMatches.forEach(u => console.log(`  ${u.substring(0, 100)}`));
  
  console.log(`\n========================================`);
  console.log(`All captured video URLs: ${allUrls.length}`);
  console.log(`========================================`);
  
  // Try to download the first video URL
  for (const { url, contentType, size } of allUrls) {
    if (size < 1000 && !url.includes('.mp4')) continue;
    
    console.log(`\nTrying to download: ${url.substring(0, 80)}...`);
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': TEST_URL,
          'Origin': 'https://sora.chatgpt.com',
        },
      });
      
      console.log(`Response: ${resp.status} ${resp.statusText}`);
      
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        console.log(`Downloaded: ${buffer.byteLength} bytes`);
        
        if (buffer.byteLength > 10000) {
          fs.writeFileSync(destPath, Buffer.from(buffer));
          console.log(`✅ Saved to: ${destPath}`);
          
          // Check file signature
          const header = Buffer.from(buffer.slice(0, 12));
          console.log(`File header: ${header.toString('hex')}`);
          break;
        }
      }
    } catch (e) {
      console.log(`Failed: ${e}`);
    }
  }
  
  // Also try videoInfo URLs
  if (videoInfo?.src) {
    console.log(`\nTrying video.src: ${videoInfo.src}`);
    try {
      const resp = await fetch(videoInfo.src, {
        headers: { 'Referer': TEST_URL },
      });
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 10000) {
          const outPath = path.join(tmpDir, "video-src.mp4");
          fs.writeFileSync(outPath, Buffer.from(buffer));
          console.log(`✅ Saved video.src to: ${outPath} (${buffer.byteLength} bytes)`);
        }
      }
    } catch (e) {
      console.log(`Failed: ${e}`);
    }
  }
  
  console.log(`\nKeeping browser open for 30s for manual inspection...`);
  console.log(`Check the Network tab in DevTools for video URLs.`);
  await new Promise(r => setTimeout(r, 30000));
  
  await browser.close();
  console.log(`\nDone. Files in ${tmpDir}:`);
  fs.readdirSync(tmpDir).forEach(f => {
    const size = fs.statSync(path.join(tmpDir, f)).size;
    console.log(`  ${f}: ${size} bytes`);
  });
}

main().catch(console.error);

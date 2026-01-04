#!/usr/bin/env npx tsx
/**
 * Real Provider Video Download Test
 * Tests actual video URLs from various platforms
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadVideo } from "./src/download.js";

// Real URLs from actual providers - NO mock/sample URLs
const TEST_CASES = [
  // User-provided URLs
  {
    name: "Instagram",
    url: "https://www.instagram.com/p/DTDs1sbDabr/",
  },
  {
    name: "TikTok", 
    url: "https://www.tiktok.com/@isaiah_dupree/video/7590828336415395086",
  },
  
  // Sora (confirmed working)
  {
    name: "Sora",
    url: "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed",
  },
  
  // YouTube - popular short videos
  {
    name: "YouTube",
    url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  },
  
  // Twitter/X - real video post
  {
    name: "Twitter/X",
    url: "https://x.com/elikiyu07/status/1936552102072406371",
  },
  
  // Vimeo - public video
  {
    name: "Vimeo",
    url: "https://vimeo.com/1048908186",
  },
  
  // Facebook - public video
  {
    name: "Facebook",
    url: "https://www.facebook.com/reel/1185498679606972",
  },
  
  // Dailymotion
  {
    name: "Dailymotion",
    url: "https://www.dailymotion.com/video/x8qzz9o",
  },
];

interface TestResult {
  name: string;
  url: string;
  success: boolean;
  size: number;
  method?: string;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "real-provider-test-"));

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║            REAL PROVIDER VIDEO DOWNLOAD TEST                      ║
╠═══════════════════════════════════════════════════════════════════╣
║  Testing ${TEST_CASES.length} real video URLs
║  Output: ${tmpDir}
╚═══════════════════════════════════════════════════════════════════╝
`);

async function testProvider(testCase: { name: string; url: string }, index: number): Promise<TestResult> {
  const safeName = testCase.name.replace(/[^a-z0-9]/gi, '_');
  const destPath = path.join(tmpDir, `${index + 1}-${safeName}.mp4`);
  
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`[${index + 1}/${TEST_CASES.length}] ${testCase.name}`);
  console.log(`URL: ${testCase.url}`);
  console.log(`${'─'.repeat(65)}`);
  
  const startTime = Date.now();
  
  try {
    const result = await downloadVideo(testCase.url, destPath);
    const duration = Date.now() - startTime;
    
    if (result.success && result.size && result.size > 1000) {
      console.log(`✅ SUCCESS: ${(result.size / 1024 / 1024).toFixed(2)} MB via ${result.method} (${(duration / 1000).toFixed(1)}s)`);
      
      return {
        name: testCase.name,
        url: testCase.url,
        success: true,
        size: result.size,
        method: result.method,
        duration,
      };
    } else {
      console.log(`❌ FAILED: ${result.error || 'Unknown error'}`);
      return {
        name: testCase.name,
        url: testCase.url,
        success: false,
        size: 0,
        duration,
        error: result.error,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ ERROR: ${errorMsg}`);
    return {
      name: testCase.name,
      url: testCase.url,
      success: false,
      size: 0,
      duration,
      error: errorMsg,
    };
  }
}

async function main() {
  // Run tests sequentially
  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await testProvider(TEST_CASES[i], i);
    results.push(result);
  }
  
  // Print summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                         RESULTS SUMMARY                           ║
╠═══════════════════════════════════════════════════════════════════╣`);
  
  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const size = r.size > 0 ? `${(r.size / 1024 / 1024).toFixed(2)} MB` : 'FAILED';
    const method = r.method || '-';
    const time = `${(r.duration / 1000).toFixed(1)}s`;
    console.log(`║ ${status} ${r.name.padEnd(15)} ${size.padStart(12)} ${method.padStart(18)} ${time.padStart(8)} ║`);
  }
  
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  PASSED: ${passed}/${TEST_CASES.length}                                                      ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
  
  // List downloaded files
  console.log(`\n📁 Downloaded files:`);
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`   🎬 ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
  }
  
  console.log(`\n📂 Files saved to: ${tmpDir}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

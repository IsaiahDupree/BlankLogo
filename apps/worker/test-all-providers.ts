#!/usr/bin/env npx tsx
/**
 * Multi-Provider Video Download Test
 * Tests all video providers we claim to support
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadVideo } from "./src/download.js";

interface TestCase {
  name: string;
  url: string;
  type: 'page' | 'direct';
}

const TEST_CASES: TestCase[] = [
  // Direct video URLs
  {
    name: "Direct MP4 (Sample)",
    url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
    type: "direct",
  },
  
  // Sora
  {
    name: "Sora (OpenAI)",
    url: "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed",
    type: "page",
  },
  
  // YouTube (short video)
  {
    name: "YouTube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    type: "page",
  },
  
  // Vimeo
  {
    name: "Vimeo",
    url: "https://vimeo.com/824804225",
    type: "page",
  },
  
  // Twitter/X video
  {
    name: "Twitter/X",
    url: "https://twitter.com/i/status/1734362962091360294",
    type: "page",
  },
  
  // TikTok
  {
    name: "TikTok",
    url: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    type: "page",
  },
  
  // Instagram Reels
  {
    name: "Instagram Reels",
    url: "https://www.instagram.com/reel/C0xFHGNP9OF/",
    type: "page",
  },
];

interface TestResult {
  name: string;
  success: boolean;
  size: number;
  method?: string;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "provider-test-"));

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║              MULTI-PROVIDER VIDEO DOWNLOAD TEST                   ║
╠═══════════════════════════════════════════════════════════════════╣
║  Testing ${TEST_CASES.length} video providers
║  Output: ${tmpDir}
╚═══════════════════════════════════════════════════════════════════╝
`);

async function testProvider(testCase: TestCase, index: number): Promise<TestResult> {
  const destPath = path.join(tmpDir, `${index}-${testCase.name.replace(/[^a-z0-9]/gi, '_')}.mp4`);
  
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`[${index + 1}/${TEST_CASES.length}] Testing: ${testCase.name}`);
  console.log(`URL: ${testCase.url.substring(0, 60)}...`);
  console.log(`Type: ${testCase.type}`);
  console.log(`${'─'.repeat(65)}`);
  
  const startTime = Date.now();
  
  try {
    const result = await downloadVideo(testCase.url, destPath);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      // Verify file
      const stats = fs.statSync(destPath);
      console.log(`✅ SUCCESS: ${(stats.size / 1024 / 1024).toFixed(2)} MB via ${result.method} (${(duration / 1000).toFixed(1)}s)`);
      
      return {
        name: testCase.name,
        success: true,
        size: stats.size,
        method: result.method,
        duration,
      };
    } else {
      console.log(`❌ FAILED: ${result.error}`);
      return {
        name: testCase.name,
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
      success: false,
      size: 0,
      duration,
      error: errorMsg,
    };
  }
}

async function main() {
  // Run tests sequentially to avoid browser conflicts
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
    const size = r.size > 0 ? `${(r.size / 1024 / 1024).toFixed(2)} MB` : 'N/A';
    const method = r.method || 'N/A';
    const time = `${(r.duration / 1000).toFixed(1)}s`;
    console.log(`║ ${status} ${r.name.padEnd(20)} ${size.padStart(10)} ${method.padStart(15)} ${time.padStart(8)} ║`);
  }
  
  console.log(`╠═══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  TOTAL: ${passed} passed, ${failed} failed                                        ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════════╝`);
  
  // List files
  console.log(`\n📁 Downloaded files in ${tmpDir}:`);
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    const filePath = path.join(tmpDir, file);
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      console.log(`   🎬 ${file}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }
  }
  
  // Exit with error if any failed
  if (failed > 0) {
    console.log(`\n⚠️ ${failed} provider(s) failed - check logs above`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

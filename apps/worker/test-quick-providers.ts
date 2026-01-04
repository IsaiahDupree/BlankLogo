#!/usr/bin/env npx tsx
/**
 * Quick Provider Test - Tests key video providers
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadVideo } from "./src/download.js";

const TEST_CASES = [
  { name: "Direct MP4", url: "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4" },
  { name: "Sora", url: "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed" },
  { name: "YouTube", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" }, // First YouTube video ever
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quick-test-"));

console.log(`\n🧪 Quick Provider Test (${TEST_CASES.length} providers)\n`);

async function main() {
  const results: { name: string; ok: boolean; size: string; time: string }[] = [];
  
  for (const tc of TEST_CASES) {
    const dest = path.join(tmpDir, `${tc.name.replace(/\s/g, '_')}.mp4`);
    console.log(`Testing ${tc.name}...`);
    
    const start = Date.now();
    const result = await downloadVideo(tc.url, dest);
    const time = ((Date.now() - start) / 1000).toFixed(1);
    
    const size = result.success ? `${((result.size || 0) / 1024 / 1024).toFixed(2)} MB` : 'N/A';
    results.push({ name: tc.name, ok: result.success, size, time: `${time}s` });
    
    console.log(`  ${result.success ? '✅' : '❌'} ${size} in ${time}s${result.method ? ` via ${result.method}` : ''}\n`);
  }
  
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RESULTS:`);
  console.log(`${'═'.repeat(50)}`);
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(15)} ${r.size.padStart(10)} ${r.time.padStart(8)}`);
  }
  console.log(`${'═'.repeat(50)}`);
  console.log(`Passed: ${results.filter(r => r.ok).length}/${results.length}`);
}

main().catch(console.error);

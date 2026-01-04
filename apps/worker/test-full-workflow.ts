#!/usr/bin/env npx tsx
/**
 * Full Workflow Test - Tests the download module directly
 * Simulates what happens when a job is processed
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadVideo, checkCapabilities } from "./src/download.js";

const TEST_URL = process.argv[2] || "https://sora.chatgpt.com/p/s_69599519b6a0819192ae48a08509d3ed";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-test-"));
const destPath = path.join(tmpDir, "video.mp4");

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Full Workflow Test                                      ║
╠═══════════════════════════════════════════════════════════╣
║  URL: ${TEST_URL.substring(0, 48)}...
║  Output: ${destPath.substring(0, 48)}...
╚═══════════════════════════════════════════════════════════╝
`);

async function main() {
  // Step 1: Check capabilities
  console.log("Step 1: Checking download capabilities...");
  const caps = await checkCapabilities();
  console.log(`   Environment: ${caps.environment}`);
  console.log(`   Chrome: ${caps.chrome}`);
  console.log(`   Chromium: ${caps.chromium}`);
  console.log(`   Browserless: ${caps.browserless}`);
  console.log(`   yt-dlp: ${caps.ytdlp}`);
  console.log(`   curl: ${caps.curl}`);
  
  // Step 2: Download video
  console.log("\nStep 2: Downloading video...");
  const startTime = Date.now();
  
  const result = await downloadVideo(TEST_URL, destPath);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (result.success) {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   ✅ SUCCESS!                                             ║
╠═══════════════════════════════════════════════════════════╣
║  Method: ${result.method}
║  Size: ${((result.size || 0) / 1024 / 1024).toFixed(2)} MB
║  Duration: ${duration}s
║  File: ${destPath}
╚═══════════════════════════════════════════════════════════╝
`);
    
    // Verify file exists and is valid
    if (fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath);
      console.log(`File verification: ${stats.size} bytes`);
      
      // Check MP4 signature
      const buffer = Buffer.alloc(12);
      const fd = fs.openSync(destPath, 'r');
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);
      
      const isMp4 = buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70;
      console.log(`MP4 signature: ${isMp4 ? '✅ Valid' : '❌ Invalid'}`);
    }
  } else {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   ❌ FAILED                                               ║
╠═══════════════════════════════════════════════════════════╣
║  Error: ${result.error}
║  Duration: ${duration}s
╚═══════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

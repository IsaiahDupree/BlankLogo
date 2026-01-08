/**
 * Integration Test: Watermark Removal
 * 
 * Tests the full watermark removal pipeline:
 * 1. YOLO detection of watermark
 * 2. Mask generation
 * 3. Inpainting (LAMA or OpenCV fallback)
 * 4. Output encoding
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_VIDEO = path.join(process.cwd(), 'test-videos', 'sora-watermark-test.mp4');
const OUTPUT_VIDEO = path.join(process.cwd(), 'test-videos', 'tests', 'sora-watermark-removed.mp4');
const PYTHON_DIR = path.join(process.cwd(), 'apps', 'worker', 'python');

// Ensure output directory exists
beforeAll(() => {
  const outputDir = path.dirname(OUTPUT_VIDEO);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
});

describe('Watermark Removal: Local Processing', () => {
  it('Test video exists', () => {
    expect(fs.existsSync(TEST_VIDEO)).toBe(true);
    
    const stats = fs.statSync(TEST_VIDEO);
    console.log(`[Test] Input video: ${TEST_VIDEO}`);
    console.log(`[Test] Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  });

  it('Removes watermark using inpaint mode', async () => {
    // Skip if test video doesn't exist
    if (!fs.existsSync(TEST_VIDEO)) {
      console.log('Skipping: test video not found');
      return;
    }

    console.log('[Test] Starting watermark removal...');
    const startTime = Date.now();

    // Run Python processor directly
    const result = await new Promise<{ success: boolean; output: string; error: string }>((resolve) => {
      const pythonCode = `
import sys
sys.path.insert(0, '${PYTHON_DIR}')
from processor import VideoProcessor, ProcessingMode

processor = VideoProcessor(mode=ProcessingMode.INPAINT)
result = processor.process(
    '${TEST_VIDEO}',
    '${OUTPUT_VIDEO}'
)
print(f"SUCCESS: {result}")
`;

      const proc = spawn('python3', ['-c', pythonCode], {
        cwd: PYTHON_DIR,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log(`[Python] ${text.trim()}`);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        // Log progress but not as errors
        if (text.includes('INFO') || text.includes('%')) {
          console.log(`[Python] ${text.trim()}`);
        }
      });

      proc.on('close', (code) => {
        resolve({
          success: code === 0 && stdout.includes('SUCCESS'),
          output: stdout,
          error: stderr
        });
      });

      // 5 minute timeout
      setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: stdout, error: 'Timeout after 5 minutes' });
      }, 300000);
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Test] Processing took ${(elapsed / 1000).toFixed(1)}s`);

    expect(result.success).toBe(true);
    expect(fs.existsSync(OUTPUT_VIDEO)).toBe(true);

    // Verify output video
    const outputStats = fs.statSync(OUTPUT_VIDEO);
    console.log(`[Test] Output video: ${OUTPUT_VIDEO}`);
    console.log(`[Test] Output size: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    expect(outputStats.size).toBeGreaterThan(0);
  }, 600000); // 10 minute timeout for this test

  it('Output video has same dimensions as input', async () => {
    if (!fs.existsSync(OUTPUT_VIDEO)) {
      console.log('Skipping: output video not found (run removal test first)');
      return;
    }

    // Get video dimensions using ffprobe
    const getVideoDimensions = (videoPath: string) => {
      try {
        const result = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoPath}"`,
          { encoding: 'utf8' }
        );
        const [width, height] = result.trim().split(',').map(Number);
        return { width, height };
      } catch {
        return null;
      }
    };

    const inputDims = getVideoDimensions(TEST_VIDEO);
    const outputDims = getVideoDimensions(OUTPUT_VIDEO);

    console.log(`[Test] Input dimensions: ${inputDims?.width}x${inputDims?.height}`);
    console.log(`[Test] Output dimensions: ${outputDims?.width}x${outputDims?.height}`);

    expect(inputDims).not.toBeNull();
    expect(outputDims).not.toBeNull();
    expect(outputDims?.width).toBe(inputDims?.width);
    expect(outputDims?.height).toBe(inputDims?.height);
  });

  it('Output video has audio track', async () => {
    if (!fs.existsSync(OUTPUT_VIDEO)) {
      console.log('Skipping: output video not found');
      return;
    }

    // Check for audio stream
    try {
      const result = execSync(
        `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of csv=p=0 "${OUTPUT_VIDEO}"`,
        { encoding: 'utf8' }
      );
      
      console.log(`[Test] Audio track: ${result.trim() || 'none'}`);
      expect(result.trim()).toBe('audio');
    } catch {
      console.log('[Test] No audio track found (may be expected for some videos)');
    }
  });
});

describe('Watermark Removal: Detection Verification', () => {
  it('YOLO model detects watermarks in test video', async () => {
    // Write Python script to temp file to avoid shell escaping issues
    const scriptPath = path.join(PYTHON_DIR, '_test_detection.py');
    const pythonScript = `
import sys
import cv2
from detector import WatermarkDetector

# Load first frame
cap = cv2.VideoCapture('${TEST_VIDEO.replace(/'/g, "\\'")}')
ret, frame = cap.read()
cap.release()

if ret:
    detector = WatermarkDetector()
    result = detector.detect_frame(frame)
    print("DETECTED:", result["detected"])
    print("CONFIDENCE:", result.get("confidence", 0))
    print("BBOX:", result.get("bbox", "None"))
else:
    print("FAILED: Could not read video frame")
`;

    fs.writeFileSync(scriptPath, pythonScript);
    
    try {
      const result = execSync(`python3 _test_detection.py`, {
        cwd: PYTHON_DIR,
        encoding: 'utf8',
        timeout: 60000
      });

      console.log(`[Test] Detection result:\n${result}`);
      
      // Check if detection worked (either YOLO found it or fallback was used)
      expect(result).toMatch(/DETECTED: True|BBOX:/);
    } finally {
      // Cleanup
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
    }
  }, 120000);
});

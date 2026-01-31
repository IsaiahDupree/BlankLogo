# Media Poster Server Integration

Integration guide for using BlankLogo watermark removal and AI upscaling with Media Poster Server.

---

## Overview

Media Poster Server can integrate with BlankLogo's video processing pipeline via:

1. **Safari Automation API** - Full-featured REST API with job management
2. **Direct Modal API** - Direct GPU endpoint calls
3. **Local Processing** - FFmpeg-based fallback

---

## Integration Options

### Option 1: Safari Automation API (Recommended)

Best for: Production use with job queuing, status tracking, and automatic fallback.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Media Poster   │ ──── │ Safari Auto API │ ──── │   Modal GPU     │
│     Server      │      │  localhost:7070 │      │  (or fallback)  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Setup:**
```bash
# Terminal 1: Start Safari Automation API
cd "/Users/isaiahdupree/Documents/Software/Safari Automation"
npm run api:start
# Runs on http://localhost:7070

# Terminal 2: Start Media Poster Server
cd "/path/to/media-poster"
npm run dev
```

**Environment Variables (Media Poster):**
```bash
# .env
VIDEO_PROCESSOR_URL=http://localhost:7070
VIDEO_PROCESSOR_ENABLED=true
```

---

### Option 2: Direct Modal API

Best for: Simple integration without running Safari Automation.

```
┌─────────────────┐      ┌─────────────────┐
│  Media Poster   │ ──── │   Modal GPU     │
│     Server      │      │   Endpoints     │
└─────────────────┘      └─────────────────┘
```

**Endpoints:**
| Service | URL |
|---------|-----|
| Watermark + Upscale | `https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run` |
| Health | `https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run` |
| Voice Clone | `https://isaiahdupree33--voice-clone-indextts2-clone-voice.modal.run` |

---

### Option 3: Local Processing Only

Best for: Development/testing without Modal GPU.

```
┌─────────────────┐      ┌─────────────────┐
│  Media Poster   │ ──── │  Local FFmpeg   │
│     Server      │      │   Processing    │
└─────────────────┘      └─────────────────┘
```

Uses FFmpeg for crop-based watermark removal and lanczos upscaling.

---

## TypeScript Integration

### Service Class

```typescript
// services/video-processor.ts

import fs from 'fs';
import path from 'path';

interface ProcessOptions {
  mode?: 'inpaint' | 'crop' | 'auto';
  platform?: 'sora' | 'tiktok' | 'runway';
  upscale?: boolean;
  upscaleFactor?: 2 | 4;
}

interface ProcessResult {
  outputPath: string;
  method: string;
  watermarksDetected: number;
  upscaled: boolean;
  processingTimeS: number;
}

export class VideoProcessor {
  private apiUrl: string;
  private modalUrl: string;
  private useModal: boolean;

  constructor(options?: { apiUrl?: string; modalUrl?: string; useModal?: boolean }) {
    this.apiUrl = options?.apiUrl || 'http://localhost:7070';
    this.modalUrl = options?.modalUrl || 'https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run';
    this.useModal = options?.useModal ?? true;
  }

  /**
   * Process video via Safari Automation API
   */
  async processViaAPI(
    inputPath: string,
    outputPath: string,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const videoBytes = fs.readFileSync(inputPath);
    const base64Video = videoBytes.toString('base64');

    // Submit job
    const submitRes = await fetch(`${this.apiUrl}/api/v1/video/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_bytes: base64Video,
        options: {
          mode: options.mode || 'inpaint',
          platform: options.platform || 'sora',
          upscale: options.upscale ?? true,
          upscale_factor: options.upscaleFactor || 2,
        },
      }),
    });

    const { job_id } = await submitRes.json();

    // Poll for completion
    let result: any;
    while (true) {
      const statusRes = await fetch(`${this.apiUrl}/api/v1/jobs/${job_id}`);
      const status = await statusRes.json();

      if (status.status === 'completed') {
        result = status.result;
        break;
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'Processing failed');
      }

      await new Promise((r) => setTimeout(r, 5000));
    }

    // Download result
    const downloadRes = await fetch(`${this.apiUrl}/api/v1/jobs/${job_id}/download`);
    const outputBuffer = Buffer.from(await downloadRes.arrayBuffer());
    fs.writeFileSync(outputPath, outputBuffer);

    return {
      outputPath,
      method: result.method,
      watermarksDetected: result.watermarks_detected || 0,
      upscaled: result.upscaled || false,
      processingTimeS: result.processing_time_s || 0,
    };
  }

  /**
   * Process video directly via Modal API
   */
  async processViaDirect(
    inputPath: string,
    outputPath: string,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const videoBytes = fs.readFileSync(inputPath);
    const base64Video = videoBytes.toString('base64');

    const res = await fetch(this.modalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_bytes: base64Video,
        mode: options.mode || 'inpaint',
        platform: options.platform || 'sora',
        upscale: options.upscale ?? true,
        upscale_factor: options.upscaleFactor || 2,
      }),
    });

    const result = await res.json();

    if (result.error) {
      throw new Error(result.error);
    }

    // Decode and save
    const outputBuffer = Buffer.from(result.video_bytes, 'base64');
    fs.writeFileSync(outputPath, outputBuffer);

    return {
      outputPath,
      method: result.stats?.method || 'modal',
      watermarksDetected: result.stats?.watermarks_detected || 0,
      upscaled: result.stats?.upscaled || false,
      processingTimeS: result.stats?.processing_time_s || 0,
    };
  }

  /**
   * Process video with automatic method selection
   */
  async process(
    inputPath: string,
    outputPath: string,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    // Try API first (has fallback built-in)
    try {
      return await this.processViaAPI(inputPath, outputPath, options);
    } catch (apiError) {
      console.warn('API unavailable, trying direct Modal...');
    }

    // Try direct Modal
    if (this.useModal) {
      try {
        return await this.processViaDirect(inputPath, outputPath, options);
      } catch (modalError) {
        console.warn('Modal unavailable, using local fallback...');
      }
    }

    // Local fallback
    return await this.processLocal(inputPath, outputPath, options);
  }

  /**
   * Local FFmpeg processing fallback
   */
  async processLocal(
    inputPath: string,
    outputPath: string,
    options: ProcessOptions = {}
  ): Promise<ProcessResult> {
    const { execSync } = await import('child_process');
    const platform = options.platform || 'sora';
    const upscale = options.upscale ?? true;
    const factor = options.upscaleFactor || 2;

    // Platform crop presets
    const crops: Record<string, string> = {
      sora: 'crop=iw:ih-80:0:0',
      tiktok: 'crop=iw:ih-150:0:50',
      runway: 'crop=iw-120:ih-40:0:0',
    };

    const cropFilter = crops[platform] || crops.sora;
    const scaleFilter = upscale ? `,scale=iw*${factor}:ih*${factor}:flags=lanczos` : '';

    const startTime = Date.now();

    execSync(
      `ffmpeg -y -i "${inputPath}" -vf "${cropFilter}${scaleFilter}" -c:v libx265 -crf 18 "${outputPath}"`,
      { stdio: 'pipe' }
    );

    const processingTimeS = (Date.now() - startTime) / 1000;

    return {
      outputPath,
      method: `local-crop${upscale ? '+lanczos' : ''}`,
      watermarksDetected: 0,
      upscaled: upscale,
      processingTimeS,
    };
  }

  /**
   * Check if Modal is available
   */
  async checkHealth(): Promise<{ api: boolean; modal: boolean }> {
    let api = false;
    let modal = false;

    try {
      const res = await fetch(`${this.apiUrl}/health`);
      const data = await res.json();
      api = data.status === 'ok';
      modal = data.services?.modal === true;
    } catch {
      // API not available
    }

    if (!modal) {
      try {
        const res = await fetch('https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run');
        const data = await res.json();
        modal = data.status === 'ok';
      } catch {
        // Modal not available
      }
    }

    return { api, modal };
  }
}

// Export singleton
export const videoProcessor = new VideoProcessor();
```

---

## Usage Examples

### Basic Usage

```typescript
import { videoProcessor } from './services/video-processor';

// Process with automatic method selection
const result = await videoProcessor.process(
  'downloads/sora-video.mp4',
  'processed/clean-video.mp4',
  {
    platform: 'sora',
    upscale: true,
    upscaleFactor: 2,
  }
);

console.log(`Processed in ${result.processingTimeS}s using ${result.method}`);
```

### In Media Poster Workflow

```typescript
// routes/post-video.ts

import { videoProcessor } from '../services/video-processor';

app.post('/api/post-video', async (req, res) => {
  const { videoUrl, platforms, removeWatermark, upscale } = req.body;

  // Download video
  const inputPath = await downloadVideo(videoUrl);

  // Process if needed
  let processedPath = inputPath;
  if (removeWatermark || upscale) {
    const result = await videoProcessor.process(inputPath, `processed-${Date.now()}.mp4`, {
      mode: 'inpaint',
      platform: detectPlatform(videoUrl),
      upscale: upscale,
      upscaleFactor: 2,
    });
    processedPath = result.outputPath;
    console.log(`Video processed: ${result.method}, ${result.watermarksDetected} watermarks removed`);
  }

  // Post to platforms
  const results = await postToMultiplePlatforms(processedPath, platforms);

  res.json({ success: true, results });
});
```

### Batch Processing

```typescript
import { videoProcessor } from './services/video-processor';

async function batchProcess(videos: string[]) {
  const results = [];

  for (const video of videos) {
    const outputPath = video.replace('.mp4', '-processed.mp4');
    
    try {
      const result = await videoProcessor.process(video, outputPath, {
        platform: 'sora',
        upscale: true,
      });
      results.push({ video, success: true, ...result });
    } catch (error) {
      results.push({ video, success: false, error: error.message });
    }
  }

  return results;
}
```

---

## Python Integration

```python
# video_processor.py

import base64
import os
import subprocess
import time
from typing import Optional
import requests

class VideoProcessor:
    def __init__(
        self,
        api_url: str = "http://localhost:7070",
        modal_url: str = "https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run"
    ):
        self.api_url = api_url
        self.modal_url = modal_url

    def process(
        self,
        input_path: str,
        output_path: str,
        mode: str = "inpaint",
        platform: str = "sora",
        upscale: bool = True,
        upscale_factor: int = 2
    ) -> dict:
        """Process video with automatic method selection."""
        
        # Try Safari Automation API first
        try:
            return self._process_via_api(input_path, output_path, mode, platform, upscale, upscale_factor)
        except Exception as e:
            print(f"API unavailable: {e}")
        
        # Try direct Modal
        try:
            return self._process_via_modal(input_path, output_path, mode, platform, upscale, upscale_factor)
        except Exception as e:
            print(f"Modal unavailable: {e}")
        
        # Local fallback
        return self._process_local(input_path, output_path, platform, upscale, upscale_factor)

    def _process_via_api(self, input_path, output_path, mode, platform, upscale, upscale_factor):
        with open(input_path, "rb") as f:
            video_bytes = base64.b64encode(f.read()).decode()
        
        # Submit job
        res = requests.post(f"{self.api_url}/api/v1/video/process", json={
            "video_bytes": video_bytes,
            "options": {
                "mode": mode,
                "platform": platform,
                "upscale": upscale,
                "upscale_factor": upscale_factor
            }
        })
        job_id = res.json()["job_id"]
        
        # Poll for completion
        while True:
            status = requests.get(f"{self.api_url}/api/v1/jobs/{job_id}").json()
            if status["status"] == "completed":
                result = status["result"]
                break
            elif status["status"] == "failed":
                raise Exception(status.get("error", "Processing failed"))
            time.sleep(5)
        
        # Download
        download = requests.get(f"{self.api_url}/api/v1/jobs/{job_id}/download")
        with open(output_path, "wb") as f:
            f.write(download.content)
        
        return {
            "output_path": output_path,
            "method": result.get("method"),
            "watermarks_detected": result.get("watermarks_detected", 0),
            "upscaled": result.get("upscaled", False),
            "processing_time_s": result.get("processing_time_s", 0)
        }

    def _process_via_modal(self, input_path, output_path, mode, platform, upscale, upscale_factor):
        with open(input_path, "rb") as f:
            video_bytes = base64.b64encode(f.read()).decode()
        
        res = requests.post(self.modal_url, json={
            "video_bytes": video_bytes,
            "mode": mode,
            "platform": platform,
            "upscale": upscale,
            "upscale_factor": upscale_factor
        }, timeout=600)
        
        result = res.json()
        if "error" in result:
            raise Exception(result["error"])
        
        output_bytes = base64.b64decode(result["video_bytes"])
        with open(output_path, "wb") as f:
            f.write(output_bytes)
        
        stats = result.get("stats", {})
        return {
            "output_path": output_path,
            "method": stats.get("method", "modal"),
            "watermarks_detected": stats.get("watermarks_detected", 0),
            "upscaled": stats.get("upscaled", False),
            "processing_time_s": stats.get("processing_time_s", 0)
        }

    def _process_local(self, input_path, output_path, platform, upscale, upscale_factor):
        crops = {
            "sora": "crop=iw:ih-80:0:0",
            "tiktok": "crop=iw:ih-150:0:50",
            "runway": "crop=iw-120:ih-40:0:0"
        }
        
        crop_filter = crops.get(platform, crops["sora"])
        scale_filter = f",scale=iw*{upscale_factor}:ih*{upscale_factor}:flags=lanczos" if upscale else ""
        
        start = time.time()
        subprocess.run([
            "ffmpeg", "-y", "-i", input_path,
            "-vf", f"{crop_filter}{scale_filter}",
            "-c:v", "libx265", "-crf", "18",
            output_path
        ], check=True, capture_output=True)
        
        return {
            "output_path": output_path,
            "method": f"local-crop{'+lanczos' if upscale else ''}",
            "watermarks_detected": 0,
            "upscaled": upscale,
            "processing_time_s": time.time() - start
        }


# Usage
if __name__ == "__main__":
    processor = VideoProcessor()
    result = processor.process(
        "input.mp4",
        "output.mp4",
        platform="sora",
        upscale=True
    )
    print(result)
```

---

## Modal Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/process-video-http` | POST | Watermark removal + upscaling |

### Request Schema

```json
{
  "video_bytes": "base64-encoded-video",
  "mode": "inpaint | crop | auto",
  "platform": "sora | tiktok | runway",
  "upscale": true,
  "upscale_factor": 2
}
```

### Response Schema

```json
{
  "video_bytes": "base64-encoded-output",
  "stats": {
    "mode": "inpaint",
    "platform": "sora",
    "input_size_mb": 7.89,
    "output_size_mb": 21.61,
    "watermarks_detected": 246,
    "frames_processed": 180,
    "upscaled": true,
    "upscale_factor": 2,
    "input_resolution": "704x1280",
    "output_resolution": "1408x2560",
    "processing_time_s": 102.4,
    "method": "modal-inpaint+esrgan2x"
  }
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Safari Automation API not responding | Check if running: `curl http://localhost:7070/health` |
| Modal returns 404 | Check Modal deployment: `modal app list` |
| Slow processing | Normal for GPU (100s for 8MB with upscale) |
| "Quota exceeded" error | Modal free tier limit, wait or upgrade |
| FFmpeg not found | Install: `brew install ffmpeg` |

---

## Performance Comparison

| Method | 8MB Video | Quality | Cost |
|--------|-----------|---------|------|
| Modal GPU (inpaint + ESRGAN) | ~100s | ⭐⭐⭐⭐⭐ | Modal credits |
| Safari API (auto-fallback) | ~20-100s | ⭐⭐⭐-⭐⭐⭐⭐⭐ | Free-Modal |
| Local FFmpeg (crop + lanczos) | ~20s | ⭐⭐⭐ | Free |

---

## Quality Test Results (January 31, 2026)

Real-world test with Sora video `badass-01.mp4`:

| Method | Size | Resolution | Time | Notes |
|--------|------|------------|------|-------|
| Original | 974 KB | 480x872 | - | Has watermark |
| Local HEVC | 1.9 MB | 480x772 | 2.7s | Cropped 100px |
| **Modal AI** | **3.9 MB** | **480x872** | 60s | **Full frame preserved** |
| Local H.264 | 4.6 MB | 480x772 | 1.5s | Larger file |

### Recommendation

**Use Modal AI Inpainting** for highest quality:
- Preserves full resolution (no cropping)
- YOLO detects watermark location
- LAMA inpaints the region seamlessly
- 291 frames processed with detection

### Test Files Location

```
~/sora-videos/full-quality-test/
├── 1_local_hevc_crop.mp4    (1.9 MB)
├── 2_modal_ai_inpaint.mp4   (3.9 MB) ← Best quality
└── 3_local_h264_hq.mp4      (4.6 MB)
```

---

*Last updated: January 31, 2026*

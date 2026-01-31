# Media Poster Integration Guide

## Overview

This guide covers integrating watermark removal and video processing into the MediaPoster pipeline. Three integration options are available with automatic fallback logic.

---

## Integration Options

| Option | URL | Best For | Latency |
|--------|-----|----------|---------|
| **Safari API** | `http://localhost:7070` | Full features + job management | ~30s |
| **Direct Modal** | Modal function | Simple direct calls | ~25s |
| **Local FFmpeg** | N/A | Development/fallback | ~10s |

---

## TypeScript Integration

### VideoProcessor Service

```typescript
// services/video-processor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessingResult {
  success: boolean;
  outputPath: string;
  method: 'safari' | 'modal' | 'local';
  duration: number;
  error?: string;
}

interface ProcessingOptions {
  mode?: 'inpaint' | 'crop' | 'auto';
  platform?: 'sora' | 'tiktok' | 'runway' | 'generic';
  quality?: 'low' | 'medium' | 'high' | 'lossless';
}

export class VideoProcessor {
  private safariApiUrl = 'http://localhost:7070';
  private modalEndpoint = 'https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run';

  async processVideo(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Try Safari API first (full features)
    try {
      const result = await this.processSafari(inputPath, outputPath, options);
      return {
        ...result,
        method: 'safari',
        duration: Date.now() - startTime
      };
    } catch (safariError) {
      console.log('Safari API unavailable, trying Modal...');
    }

    // Fallback to Modal direct
    try {
      const result = await this.processModal(inputPath, outputPath, options);
      return {
        ...result,
        method: 'modal',
        duration: Date.now() - startTime
      };
    } catch (modalError) {
      console.log('Modal unavailable, using local FFmpeg...');
    }

    // Final fallback: local FFmpeg crop
    const result = await this.processLocal(inputPath, outputPath, options);
    return {
      ...result,
      method: 'local',
      duration: Date.now() - startTime
    };
  }

  private async processSafari(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions
  ): Promise<{ success: boolean; outputPath: string }> {
    // Start job
    const response = await fetch(`${this.safariApiUrl}/api/v1/video/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_path: inputPath,
        mode: options.mode || 'inpaint',
        platform_preset: options.platform || 'sora',
        quality: options.quality || 'high'
      })
    });

    if (!response.ok) throw new Error('Safari API error');
    const { job_id } = await response.json();

    // Poll for completion
    for (let i = 0; i < 60; i++) {
      const status = await fetch(`${this.safariApiUrl}/api/v1/jobs/${job_id}`);
      const job = await status.json();

      if (job.status === 'complete') {
        // Copy to output path if different
        if (job.output_path !== outputPath) {
          await execAsync(`cp "${job.output_path}" "${outputPath}"`);
        }
        return { success: true, outputPath };
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Processing failed');
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error('Processing timeout');
  }

  private async processModal(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions
  ): Promise<{ success: boolean; outputPath: string }> {
    // Upload to temporary storage for Modal
    const videoUrl = await this.uploadForProcessing(inputPath);

    const response = await fetch(this.modalEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: videoUrl,
        mode: options.mode || 'inpaint'
      })
    });

    if (!response.ok) throw new Error('Modal API error');
    const result = await response.json();

    // Download processed video
    await this.downloadFile(result.output_url, outputPath);
    return { success: true, outputPath };
  }

  private async processLocal(
    inputPath: string,
    outputPath: string,
    options: ProcessingOptions
  ): Promise<{ success: boolean; outputPath: string }> {
    // Use FFmpeg to crop watermark region (fallback method)
    const cropFilter = this.getCropFilter(options.platform);
    
    await execAsync(
      `ffmpeg -i "${inputPath}" -vf "${cropFilter}" -c:a copy "${outputPath}" -y`
    );

    return { success: true, outputPath };
  }

  private getCropFilter(platform?: string): string {
    switch (platform) {
      case 'sora':
        return 'crop=iw:ih-60:0:0'; // Crop bottom 60px
      case 'tiktok':
        return 'crop=iw:ih-80:0:0'; // Crop bottom 80px
      default:
        return 'crop=iw:ih-50:0:0'; // Default crop
    }
  }

  private async uploadForProcessing(filePath: string): Promise<string> {
    // Implement upload to temporary storage (S3, Supabase, etc.)
    // Return public URL
    throw new Error('Implement uploadForProcessing');
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, Buffer.from(buffer));
  }
}
```

### Usage in Media Poster

```typescript
import { VideoProcessor } from './services/video-processor';

const processor = new VideoProcessor();

// Process single video
const result = await processor.processVideo(
  '/path/to/sora-video.mp4',
  '/path/to/cleaned-video.mp4',
  { platform: 'sora', mode: 'inpaint' }
);

console.log(`Processed via ${result.method} in ${result.duration}ms`);
```

---

## Python Integration

### VideoProcessor Class

```python
# services/video_processor.py
import os
import time
import shutil
import subprocess
import requests
from pathlib import Path
from typing import Optional, Literal
from dataclasses import dataclass

@dataclass
class ProcessingResult:
    success: bool
    output_path: str
    method: Literal['safari', 'modal', 'local']
    duration: float
    error: Optional[str] = None

class VideoProcessor:
    def __init__(self):
        self.safari_api_url = 'http://localhost:7070'
        self.modal_endpoint = 'https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run'

    def process_video(
        self,
        input_path: str,
        output_path: str,
        mode: str = 'inpaint',
        platform: str = 'sora',
        quality: str = 'high'
    ) -> ProcessingResult:
        start_time = time.time()

        # Try Safari API first
        try:
            result = self._process_safari(input_path, output_path, mode, platform, quality)
            return ProcessingResult(
                success=True,
                output_path=output_path,
                method='safari',
                duration=time.time() - start_time
            )
        except Exception as e:
            print(f"Safari API unavailable: {e}")

        # Fallback to Modal
        try:
            result = self._process_modal(input_path, output_path, mode)
            return ProcessingResult(
                success=True,
                output_path=output_path,
                method='modal',
                duration=time.time() - start_time
            )
        except Exception as e:
            print(f"Modal unavailable: {e}")

        # Final fallback: local FFmpeg
        result = self._process_local(input_path, output_path, platform)
        return ProcessingResult(
            success=True,
            output_path=output_path,
            method='local',
            duration=time.time() - start_time
        )

    def _process_safari(
        self,
        input_path: str,
        output_path: str,
        mode: str,
        platform: str,
        quality: str
    ) -> bool:
        # Start job
        response = requests.post(
            f'{self.safari_api_url}/api/v1/video/process',
            json={
                'video_path': input_path,
                'mode': mode,
                'platform_preset': platform,
                'quality': quality
            },
            timeout=10
        )
        response.raise_for_status()
        job_id = response.json()['job_id']

        # Poll for completion
        for _ in range(60):
            status = requests.get(f'{self.safari_api_url}/api/v1/jobs/{job_id}')
            job = status.json()

            if job['status'] == 'complete':
                if job.get('output_path') != output_path:
                    shutil.copy(job['output_path'], output_path)
                return True

            if job['status'] == 'failed':
                raise Exception(job.get('error', 'Processing failed'))

            time.sleep(2)

        raise Exception('Processing timeout')

    def _process_modal(
        self,
        input_path: str,
        output_path: str,
        mode: str
    ) -> bool:
        # For Modal, we need to upload the file first
        video_url = self._upload_for_processing(input_path)

        response = requests.post(
            self.modal_endpoint,
            json={'video_url': video_url, 'mode': mode},
            timeout=120
        )
        response.raise_for_status()
        result = response.json()

        # Download processed video
        self._download_file(result['output_url'], output_path)
        return True

    def _process_local(
        self,
        input_path: str,
        output_path: str,
        platform: str
    ) -> bool:
        crop_filter = self._get_crop_filter(platform)
        
        subprocess.run([
            'ffmpeg', '-i', input_path,
            '-vf', crop_filter,
            '-c:a', 'copy',
            output_path, '-y'
        ], check=True, capture_output=True)

        return True

    def _get_crop_filter(self, platform: str) -> str:
        filters = {
            'sora': 'crop=iw:ih-60:0:0',
            'tiktok': 'crop=iw:ih-80:0:0',
            'runway': 'crop=iw:ih-50:0:0',
        }
        return filters.get(platform, 'crop=iw:ih-50:0:0')

    def _upload_for_processing(self, file_path: str) -> str:
        # Implement upload to temporary storage
        raise NotImplementedError("Implement upload to cloud storage")

    def _download_file(self, url: str, output_path: str) -> None:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
```

### Integration with SoraWatermarkCleaner

```python
# automation/sora_watermark_cleaner.py
from services.video_processor import VideoProcessor
from pathlib import Path

class SoraWatermarkCleaner:
    def __init__(self):
        self.processor = VideoProcessor()
        self.input_dir = Path.home() / 'sora-videos'
        self.output_dir = Path.home() / 'sora-videos' / 'cleaned'
        self.output_dir.mkdir(exist_ok=True)

    def clean_video(self, video_path: Path) -> Path:
        output_path = self.output_dir / f"cleaned_{video_path.name}"
        
        result = self.processor.process_video(
            str(video_path),
            str(output_path),
            mode='inpaint',
            platform='sora'
        )
        
        print(f"✓ Cleaned {video_path.name} via {result.method} ({result.duration:.1f}s)")
        return output_path

    def clean_all(self) -> list[Path]:
        cleaned = []
        for video in self.input_dir.glob('*.mp4'):
            if not video.name.startswith('cleaned_'):
                cleaned.append(self.clean_video(video))
        return cleaned
```

---

## Batch Processing

### Process Multiple Videos

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def batch_process(video_paths: list[str], max_concurrent: int = 3):
    processor = VideoProcessor()
    results = []
    
    with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(
                executor,
                processor.process_video,
                path,
                path.replace('.mp4', '_cleaned.mp4'),
                'inpaint',
                'sora'
            )
            for path in video_paths
        ]
        results = await asyncio.gather(*tasks)
    
    return results
```

---

## Media Poster Pipeline Integration

### VideoReadyPipeline Integration

```python
# In services/video_ready_pipeline.py

from services.video_processor import VideoProcessor

class VideoReadyPipeline:
    def __init__(self):
        self.video_processor = VideoProcessor()

    async def process_sora_video(self, video_path: Path) -> dict:
        # Step 1: Remove watermark
        cleaned_path = video_path.parent / 'cleaned' / f"cleaned_{video_path.name}"
        
        result = self.video_processor.process_video(
            str(video_path),
            str(cleaned_path),
            mode='inpaint',
            platform='sora'
        )
        
        if not result.success:
            raise Exception(f"Watermark removal failed: {result.error}")

        # Step 2: Continue with AI analysis
        analysis = await self.analyze_video(cleaned_path)
        
        # Step 3: Save to database
        video_record = await self.save_to_database(cleaned_path, analysis)
        
        # Step 4: Publish via EventBus
        await self.event_bus.publish('PUBLISH_REQUESTED', {
            'video_id': video_record.id,
            'video_path': str(cleaned_path),
            'analysis': analysis
        })

        return {
            'video_id': video_record.id,
            'cleaned_path': str(cleaned_path),
            'processing_method': result.method,
            'processing_time': result.duration
        }
```

---

## Performance Comparison

| Method | Avg Time | Quality | Features |
|--------|----------|---------|----------|
| Safari API + Modal | ~30s | Excellent (AI inpaint) | Full job management |
| Direct Modal | ~25s | Excellent (AI inpaint) | Simple API |
| Local FFmpeg | ~10s | Good (crop only) | Offline, fast |

---

## Environment Variables

```bash
# .env
SAFARI_API_URL=http://localhost:7070
MODAL_ENDPOINT=https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run
WATERMARK_REMOVAL_MODE=inpaint  # inpaint, crop, auto
DEFAULT_PLATFORM=sora
```

---

## Related Documentation

- [Safari Automation API](./SAFARI_AUTOMATION_API.md)
- [Safari Automations Guide](./SAFARI_AUTOMATIONS.md)
- [Pipeline Architecture](./PIPELINE_ARCHITECTURE.md)

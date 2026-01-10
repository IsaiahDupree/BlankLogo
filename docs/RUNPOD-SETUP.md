# RunPod Setup for GPU-Accelerated LAMA Watermark Removal

## Overview

RunPod provides GPU cloud instances for fast AI/ML inference. This guide shows how to deploy BlankLogo's LAMA inpainting service on RunPod for ~10x faster watermark removal.

**Performance Comparison:**
| Platform | Device | Speed | Cost |
|----------|--------|-------|------|
| Render (current) | CPU | ~5-10 min/video | $7/mo starter |
| RunPod | A4000 GPU | ~30-60s/video | ~$0.20/hr |
| RunPod | A100 GPU | ~15-30s/video | ~$1.00/hr |

## Prerequisites

1. RunPod account: https://runpod.io
2. Docker installed locally (for building images)
3. GitHub account (for container registry)

## Option 1: RunPod Serverless (Recommended)

Serverless = pay only when processing, auto-scales to zero.

### Step 1: Create Dockerfile

```dockerfile
# Dockerfile.runpod
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY apps/worker/python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install runpod handler
RUN pip install runpod

# Copy application code
COPY apps/worker/python/ .

# Download models at build time (faster cold starts)
RUN python -c "from detector import get_yolo_model; get_yolo_model()"
RUN python -c "from inpainter import download_lama_model, LAMA_MODEL_URL, LAMA_MODEL_MD5; download_lama_model(LAMA_MODEL_URL, LAMA_MODEL_MD5)"

# Copy RunPod handler
COPY runpod_handler.py .

CMD ["python", "-u", "runpod_handler.py"]
```

### Step 2: Create RunPod Handler

```python
# runpod_handler.py
"""
RunPod Serverless Handler for BlankLogo Watermark Removal
"""
import runpod
import base64
import tempfile
import os
from pathlib import Path
from loguru import logger

from processor import VideoProcessor, ProcessingMode


def handler(event):
    """
    RunPod serverless handler.
    
    Input:
        event["input"]["video_base64"]: Base64 encoded video
        event["input"]["mode"]: "crop" | "inpaint" | "auto"
        event["input"]["platform"]: "sora" | "tiktok" | "runway" | "pika"
    
    Output:
        {"video_base64": "...", "stats": {...}}
    """
    try:
        logger.info("=" * 60)
        logger.info("[RunPod] Starting watermark removal job")
        logger.info("=" * 60)
        
        # Parse input
        input_data = event.get("input", {})
        video_b64 = input_data.get("video_base64")
        mode = input_data.get("mode", "inpaint")
        platform = input_data.get("platform", "sora")
        
        if not video_b64:
            raise ValueError("Missing video_base64 in input")
        
        logger.info(f"[RunPod] Mode: {mode}, Platform: {platform}")
        
        # Decode video to temp file
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = os.path.join(tmp_dir, "input.mp4")
            output_path = os.path.join(tmp_dir, "output.mp4")
            
            # Write input video
            logger.info("[RunPod] Decoding input video...")
            video_bytes = base64.b64decode(video_b64)
            with open(input_path, "wb") as f:
                f.write(video_bytes)
            
            input_size_mb = len(video_bytes) / (1024 * 1024)
            logger.info(f"[RunPod] Input video: {input_size_mb:.2f} MB")
            
            # Process video
            logger.info("[RunPod] Processing video...")
            processor = VideoProcessor(mode=ProcessingMode(mode))
            result = processor.process(input_path, output_path)
            
            logger.info(f"[RunPod] Processing complete: {result}")
            
            # Encode output video
            logger.info("[RunPod] Encoding output video...")
            with open(output_path, "rb") as f:
                output_bytes = f.read()
            output_b64 = base64.b64encode(output_bytes).decode("utf-8")
            
            output_size_mb = len(output_bytes) / (1024 * 1024)
            logger.info(f"[RunPod] Output video: {output_size_mb:.2f} MB")
            
            logger.info("=" * 60)
            logger.info("[RunPod] Job completed successfully!")
            logger.info("=" * 60)
            
            return {
                "video_base64": output_b64,
                "stats": {
                    "mode": mode,
                    "platform": platform,
                    "input_size_mb": round(input_size_mb, 2),
                    "output_size_mb": round(output_size_mb, 2),
                    "frames_processed": result.get("frames_processed", 0),
                    "watermarks_detected": result.get("watermarks_detected", 0)
                }
            }
            
    except Exception as e:
        logger.error(f"[RunPod] ❌ Job failed: {e}")
        import traceback
        logger.error(f"[RunPod] Traceback:\n{traceback.format_exc()}")
        return {"error": str(e)}


# Start RunPod serverless
runpod.serverless.start({"handler": handler})
```

### Step 3: Build and Push Docker Image

```bash
# Build the image
docker build -f Dockerfile.runpod -t blanklogo-inpaint-gpu .

# Tag for Docker Hub (or use GitHub Container Registry)
docker tag blanklogo-inpaint-gpu:latest YOUR_DOCKERHUB_USERNAME/blanklogo-inpaint-gpu:latest

# Push to registry
docker push YOUR_DOCKERHUB_USERNAME/blanklogo-inpaint-gpu:latest
```

### Step 4: Create RunPod Serverless Endpoint

1. Go to https://runpod.io/console/serverless
2. Click "New Endpoint"
3. Configure:
   - **Name**: `blanklogo-inpaint`
   - **Docker Image**: `YOUR_DOCKERHUB_USERNAME/blanklogo-inpaint-gpu:latest`
   - **GPU Type**: RTX A4000 (good balance of cost/performance)
   - **Max Workers**: 3 (adjust based on load)
   - **Idle Timeout**: 30 seconds
   - **Execution Timeout**: 600 seconds (10 min max)

4. Copy your **Endpoint ID** and **API Key**

### Step 5: Call from BlankLogo Worker

```typescript
// apps/worker/src/runpod-client.ts
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

interface RunPodInput {
  video_base64: string;
  mode: 'crop' | 'inpaint' | 'auto';
  platform: string;
}

interface RunPodOutput {
  video_base64?: string;
  stats?: {
    frames_processed: number;
    watermarks_detected: number;
  };
  error?: string;
}

export async function processWithRunPod(
  videoBuffer: Buffer,
  mode: string = 'inpaint',
  platform: string = 'sora'
): Promise<Buffer> {
  const input: RunPodInput = {
    video_base64: videoBuffer.toString('base64'),
    mode: mode as 'inpaint',
    platform
  };

  // Start async job
  const runResponse = await fetch(
    `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({ input })
    }
  );

  const { id: jobId } = await runResponse.json();
  console.log(`[RunPod] Job started: ${jobId}`);

  // Poll for completion
  let result: RunPodOutput | null = null;
  while (!result) {
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
    
    const statusResponse = await fetch(
      `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`,
      {
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
      }
    );
    
    const status = await statusResponse.json();
    console.log(`[RunPod] Job status: ${status.status}`);
    
    if (status.status === 'COMPLETED') {
      result = status.output;
    } else if (status.status === 'FAILED') {
      throw new Error(`RunPod job failed: ${status.error}`);
    }
  }

  if (result.error) {
    throw new Error(result.error);
  }

  // Decode output video
  return Buffer.from(result.video_base64!, 'base64');
}
```

### Step 6: Environment Variables

Add to your `.env` or Render environment:

```bash
# RunPod Configuration
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
RUNPOD_API_KEY=your_api_key_here
USE_RUNPOD_GPU=true  # Toggle GPU processing
```

---

## Option 2: RunPod Pod (Dedicated Instance)

For consistent workloads, a dedicated GPU pod may be cheaper.

### Create a Pod

1. Go to https://runpod.io/console/pods
2. Click "Deploy"
3. Select:
   - **GPU**: RTX A4000 ($0.20/hr) or RTX 3090 ($0.22/hr)
   - **Template**: RunPod PyTorch 2.1
   - **Container Disk**: 20GB
   - **Volume Disk**: 50GB (for model cache)

4. SSH into pod and setup:

```bash
# Clone repo
git clone https://github.com/IsaiahDupree/BlankLogo.git
cd BlankLogo/apps/worker/python

# Install dependencies
pip install -r requirements.txt

# Download models
python -c "from detector import get_yolo_model; get_yolo_model()"
python -c "from inpainter import get_lama_model; get_lama_model()"

# Start server
python server.py
```

5. Expose port 8081 and use the public URL

---

## Cost Estimation

| Usage | Render (CPU) | RunPod Serverless | RunPod Pod |
|-------|--------------|-------------------|------------|
| 10 videos/day | $7/mo | ~$2/mo | ~$15/mo |
| 100 videos/day | $7/mo (slow) | ~$20/mo | ~$50/mo |
| 1000 videos/day | Not viable | ~$200/mo | ~$150/mo |

**Recommendation:**
- < 50 videos/day: Stick with Render (CPU is fine)
- 50-500 videos/day: RunPod Serverless
- > 500 videos/day: RunPod dedicated Pod

---

## Hybrid Setup (Best of Both Worlds)

Use Render for crop mode (fast, no GPU needed) and RunPod for inpaint mode:

```typescript
// apps/worker/src/process-job.ts
async function processVideo(job: Job) {
  const { mode, videoBuffer, platform } = job.data;
  
  if (mode === 'crop') {
    // Use Render (fast, cheap)
    return await processWithRender(videoBuffer, mode);
  } else if (mode === 'inpaint' && process.env.USE_RUNPOD_GPU === 'true') {
    // Use RunPod GPU (fast AI inpainting)
    return await processWithRunPod(videoBuffer, mode, platform);
  } else {
    // Fallback to Render CPU (slow but works)
    return await processWithRender(videoBuffer, mode);
  }
}
```

---

## Monitoring & Logs

RunPod provides logging in the console:
1. Go to https://runpod.io/console/serverless
2. Click on your endpoint
3. View "Logs" tab for real-time output

All `logger.info()` and `logger.error()` calls will appear in RunPod logs.

---

## Troubleshooting

### Model Download Fails
```bash
# Pre-download models in Dockerfile
RUN python -c "from detector import get_yolo_model; get_yolo_model()"
RUN python -c "from inpainter import download_lama_model, LAMA_MODEL_URL, LAMA_MODEL_MD5; download_lama_model(LAMA_MODEL_URL, LAMA_MODEL_MD5)"
```

### Out of Memory
- Use A4000 (16GB VRAM) instead of RTX 3080 (10GB)
- Process shorter videos (< 30s)
- Reduce batch size in processor

### Cold Start Too Slow
- Enable "Active Workers" (keeps 1 worker warm)
- Pre-download models in Docker image
- Use volume storage for model cache

---

## References

- [RunPod Serverless Docs](https://docs.runpod.io/serverless/overview)
- [RunPod Python SDK](https://github.com/runpod/runpod-python)
- [BlankLogo Inpainter](../apps/worker/python/)

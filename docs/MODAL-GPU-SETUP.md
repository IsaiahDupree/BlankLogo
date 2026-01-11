# Modal GPU Setup Guide

## Overview

Modal is a serverless GPU platform that provides on-demand GPU compute. BlankLogo uses Modal for AI-powered watermark removal using YOLO detection and LAMA inpainting.

## Why Modal?

### Comparison of GPU Providers

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| **Modal** ✓ | Scale-to-zero, fast cold start, simple API | Limited GPU types | ~$1.67/hr (A10G) |
| RunPod | Many GPU options, cheap | Slow cold start, queue issues | ~$0.44/hr (A10G) |
| Replicate | Simple API, managed | Expensive, less control | ~$2.50/hr |
| AWS Lambda | Enterprise features | Complex setup, expensive | ~$3+/hr |

We chose **Modal** because:
1. **Scale-to-zero**: No cost when idle
2. **Fast cold start**: ~30-60 seconds vs 5-10 minutes on RunPod
3. **Simple deployment**: Single Python file, no Docker required
4. **Reliable**: No queue starvation issues

## Initial Setup

### 1. Install Modal CLI

```bash
pip install modal
```

### 2. Authenticate

```bash
modal token new
# Opens browser for authentication
```

This creates `~/.modal.toml` with your tokens.

### 3. Deploy the App

```bash
cd apps/worker/python
modal deploy modal_app.py
```

Output:
```
✓ Created objects.
├── 🔨 Created function WatermarkRemover.*
├── 🔨 Created web function process_video_http => https://xxx--blanklogo-watermark-removal-process-video-http.modal.run
└── 🔨 Created web function health => https://xxx--blanklogo-watermark-removal-health.modal.run
```

## Modal App Structure

### `apps/worker/python/modal_app.py`

```python
import modal

app = modal.App("blanklogo-watermark-removal")

# Image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.1.0",
        "torchvision==0.16.0",
        "ultralytics",
        "opencv-python-headless",
        # ... other deps
    )
    .run_commands(
        "git clone --depth 1 https://github.com/IsaiahDupree/BlankLogo.git /app/BlankLogo"
    )
)

# GPU configuration
gpu_config = modal.gpu.A10G()

@app.cls(image=image, gpu=gpu_config, timeout=600, container_idle_timeout=60)
class WatermarkRemover:
    @modal.enter()
    def setup(self):
        # Load models on cold start
        self.yolo = get_yolo_model()
        self.lama = get_lama_model()

    @modal.method()
    def process_video(self, video_bytes, mode, platform):
        # Process video using loaded models
        ...

# HTTP endpoint for Render worker
@app.function(image=image, gpu=gpu_config, timeout=600)
@modal.web_endpoint(method="POST")
def process_video_http(request: dict):
    # Accepts: { video_bytes: base64, mode: str, platform: str }
    # Returns: { video_bytes: base64, stats: {...} }
    ...
```

## Key Configurations

### GPU Selection

```python
# Options (cost per hour as of 2024):
modal.gpu.T4()      # $0.59/hr - Good for testing
modal.gpu.A10G()    # $1.67/hr - Best balance (recommended)
modal.gpu.A100()    # $3.94/hr - Maximum performance
```

### Timeouts

```python
@app.function(
    timeout=600,              # Max 10 minutes per request
    container_idle_timeout=60 # Keep warm for 60s after request
)
```

### Memory

```python
@app.function(
    memory=16384  # 16GB RAM (default is usually sufficient)
)
```

## Integration with Render Worker

### Modal Client (`apps/worker/src/modal-client.ts`)

```typescript
const MODAL_TOKEN_ID = process.env.MODAL_TOKEN_ID;
const MODAL_TOKEN_SECRET = process.env.MODAL_TOKEN_SECRET;
const MODAL_WORKSPACE = "isaiahdupree33";
const MODAL_APP_NAME = "blanklogo-watermark-removal";

export async function processVideoWithModal(
  videoBytes: Buffer,
  mode: string = "inpaint",
  platform: string = "sora"
): Promise<{ outputBytes: Buffer; stats: Stats }> {
  
  const modalUrl = `https://${MODAL_WORKSPACE}--${MODAL_APP_NAME}-process-video-http.modal.run`;
  
  const response = await fetch(modalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MODAL_TOKEN_ID}:${MODAL_TOKEN_SECRET}`,
    },
    body: JSON.stringify({
      video_bytes: videoBytes.toString("base64"),
      mode,
      platform,
    }),
  });
  
  const result = await response.json();
  return {
    outputBytes: Buffer.from(result.video_bytes, "base64"),
    stats: result.stats,
  };
}
```

## Token Management

### Rotate Tokens (if exposed)

```bash
modal token new
```

### Get Current Tokens

```bash
cat ~/.modal.toml | grep -E "token_id|token_secret"
```

### Set Tokens on Render

1. Go to Render Dashboard
2. Select `blanklogo-worker` service
3. Environment tab
4. Add:
   - `MODAL_TOKEN_ID`
   - `MODAL_TOKEN_SECRET`

## Monitoring

### Modal Dashboard

Visit: https://modal.com/apps/isaiahdupree33/main/deployed/blanklogo-watermark-removal

Shows:
- Active containers
- Request logs
- GPU utilization
- Cold start times
- Error rates

### Health Check

```bash
curl https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run
# {"status": "ok", "service": "blanklogo-watermark-removal"}
```

## Cost Optimization

### 1. Scale to Zero
Modal automatically scales to zero when idle. No cost when not processing.

### 2. Container Idle Timeout
```python
container_idle_timeout=60  # Keep warm for 60s
```
Balances cold start latency vs cost.

### 3. Right-size GPU
- Use A10G for production (good balance)
- Use T4 for development/testing

### 4. Batch Processing
Consider batching multiple short videos into single requests to amortize cold start.

## Troubleshooting

### Cold Start Too Slow

**Problem**: First request takes >60 seconds

**Solutions**:
1. Increase `container_idle_timeout` (costs more)
2. Use smaller models
3. Pre-download models in image build:
   ```python
   image = modal.Image.debian_slim().run_commands(
       "python -c 'from ultralytics import YOLO; YOLO(\"yolov8n.pt\")'"
   )
   ```

### Out of Memory

**Problem**: `CUDA out of memory`

**Solutions**:
1. Use larger GPU: `modal.gpu.A100()`
2. Reduce batch size in processing
3. Process fewer frames simultaneously

### Timeout

**Problem**: Request exceeds 600s timeout

**Solutions**:
1. Increase timeout: `timeout=1200`
2. Process shorter video segments
3. Optimize model inference

## Lessons Learned

### RunPod vs Modal

We initially tried RunPod but encountered:
1. **Queue starvation**: Jobs stuck in queue with no workers
2. **Slow cold start**: 5-10 minutes to pull Docker image
3. **Unreliable scaling**: Workers not initializing

Modal solved all these issues with faster cold starts and reliable auto-scaling.

### Base64 vs Signed URLs

Current approach uses base64-encoded video over HTTP. This works but has limits:
- ~50MB practical limit
- Higher memory usage
- Slower transfers

**Future improvement**: Use signed URLs for input/output:
1. Worker uploads input to storage
2. Modal downloads from signed URL
3. Modal uploads output to storage
4. Worker gets output from signed URL

### Model Loading Strategy

Loading models on every request is slow. We use `@modal.enter()` to load once per container:

```python
@modal.enter()
def setup(self):
    self.yolo = get_yolo_model()  # Load once
    self.lama = get_lama_model()  # Keep in memory
```

This reduces processing time from ~90s to ~60s per video.

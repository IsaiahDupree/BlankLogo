# Safari Automation Video Processing API

Complete API documentation for watermark removal and AI upscaling via Safari Automation server.

---

## Quick Start

```bash
# Start the API server
cd "/Users/isaiahdupree/Documents/Software/Safari Automation"
npm run api:start

# Server runs on http://localhost:7070
```

---

## Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T16:05:53.150Z",
  "services": {
    "modal": true,
    "replicate": false,
    "supabase": true
  },
  "config": {
    "modal_configured": true,
    "replicate_configured": false,
    "supabase_configured": true
  }
}
```

---

### Process Video (HQ Pipeline)

Submit a video for watermark removal and/or AI upscaling.

```http
POST /api/v1/video/process
Content-Type: application/json
```

**Request Body:**
```json
{
  "video_bytes": "<base64-encoded video>",
  "options": {
    "mode": "inpaint",
    "platform": "sora",
    "upscale": true,
    "upscale_factor": 2
  }
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `video_bytes` | string | required | Base64-encoded video file |
| `options.mode` | string | `"inpaint"` | `"inpaint"`, `"crop"`, or `"auto"` |
| `options.platform` | string | `"sora"` | `"sora"`, `"tiktok"`, `"runway"` |
| `options.upscale` | boolean | `true` | Enable AI upscaling |
| `options.upscale_factor` | number | `2` | `2` or `4` |

**Response:**
```json
{
  "job_id": "sa-job-5418bbdd",
  "status": "processing",
  "estimated_time": 240
}
```

---

### Get Job Status

```http
GET /api/v1/jobs/:job_id
```

**Response (Processing):**
```json
{
  "job_id": "sa-job-5418bbdd",
  "status": "processing",
  "progress": 55,
  "step": "upscaling"
}
```

**Response (Complete):**
```json
{
  "job_id": "sa-job-5418bbdd",
  "status": "completed",
  "progress": 100,
  "result": {
    "method": "modal-inpaint+esrgan",
    "input_size_mb": 7.89,
    "output_size_mb": 21.61,
    "watermarks_detected": 246,
    "upscaled": true,
    "processing_time_s": 102.4
  }
}
```

**Status Values:**
- `pending` - Job queued
- `processing` - Currently processing
- `completed` - Done, ready for download
- `failed` - Error occurred

---

### Download Processed Video

```http
GET /api/v1/jobs/:job_id/download
```

**Response:** Binary video file (MP4/HEVC)

---

### List Jobs

```http
GET /api/v1/jobs
```

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "sa-job-5418bbdd",
      "status": "completed",
      "progress": 100,
      "created_at": "2026-01-31T16:05:00.000Z",
      "completed_at": "2026-01-31T16:06:42.000Z"
    }
  ]
}
```

---

## Processing Modes

### Mode: `inpaint` (Recommended)

Uses YOLO detection + LAMA inpainting to remove watermarks while preserving video content.

- **Best for:** High-quality removal without cropping
- **GPU:** Required (Modal)
- **Fallback:** Crops to `mode: crop` if Modal unavailable

### Mode: `crop`

Crops out the watermark region based on platform-specific presets.

- **Best for:** Fast processing, guaranteed removal
- **GPU:** Not required (FFmpeg)

### Mode: `auto`

Automatically selects best mode based on video analysis.

---

## Platform Presets

| Platform | Watermark Location | Crop Region |
|----------|-------------------|-------------|
| `sora` | Bottom center | Bottom 80px |
| `tiktok` | Bottom + top | Top 50px, Bottom 100px |
| `runway` | Bottom right corner | Bottom-right 120x40px |

---

## Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    HQ PROCESSING PIPELINE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   INPUT VIDEO                                                   │
│       ↓                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ STEP 1: WATERMARK REMOVAL                                │   │
│   │                                                         │   │
│   │   Modal GPU (Primary)     Local FFmpeg (Fallback)       │   │
│   │   ├─ YOLO Detection       ├─ Platform crop preset       │   │
│   │   └─ LAMA Inpainting      └─ FFmpeg crop filter         │   │
│   └─────────────────────────────────────────────────────────┘   │
│       ↓                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ STEP 2: AI UPSCALING (if enabled)                        │   │
│   │                                                         │   │
│   │   Modal GPU (Primary)     Local FFmpeg (Fallback)       │   │
│   │   └─ Real-ESRGAN 2x/4x    └─ Lanczos scaling            │   │
│   └─────────────────────────────────────────────────────────┘   │
│       ↓                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ STEP 3: ENCODING                                         │   │
│   │   └─ HEVC CRF 18 (high quality)                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│       ↓                                                         │
│   OUTPUT VIDEO                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modal GPU vs Local Processing

| Feature | Modal GPU | Local FFmpeg |
|---------|-----------|--------------|
| **Watermark Removal** | YOLO + LAMA inpaint | Crop only |
| **AI Upscaling** | Real-ESRGAN | Lanczos filter |
| **Quality** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good |
| **Speed** | ~100s for 8MB | ~20s for 8MB |
| **GPU Required** | Yes (T4/A10G) | No |
| **Cost** | Modal credits | Free |

### Automatic Fallback

The API automatically falls back to local processing if Modal is unavailable:

```
Modal Available?
    ├─ YES → Use Modal GPU (YOLO+LAMA, Real-ESRGAN)
    └─ NO  → Use Local FFmpeg (crop, lanczos)
```

---

## Environment Variables

```bash
# Modal GPU (optional but recommended)
MODAL_TOKEN_ID=ak-xxxxxxxx
MODAL_TOKEN_SECRET=as-xxxxxxxx

# Supabase (for job storage)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxxxxx
```

---

## Code Examples

### TypeScript/Node.js

```typescript
import fs from 'fs';

const API_URL = 'http://localhost:7070';

async function processVideo(videoPath: string) {
  // Read and encode video
  const videoBytes = fs.readFileSync(videoPath);
  const base64Video = videoBytes.toString('base64');
  
  // Submit job
  const submitRes = await fetch(`${API_URL}/api/v1/video/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_bytes: base64Video,
      options: {
        mode: 'inpaint',
        platform: 'sora',
        upscale: true,
        upscale_factor: 2
      }
    })
  });
  
  const { job_id } = await submitRes.json();
  console.log(`Job submitted: ${job_id}`);
  
  // Poll for completion
  while (true) {
    const statusRes = await fetch(`${API_URL}/api/v1/jobs/${job_id}`);
    const status = await statusRes.json();
    
    if (status.status === 'completed') {
      console.log('Complete!', status.result);
      break;
    } else if (status.status === 'failed') {
      throw new Error(status.error);
    }
    
    console.log(`Progress: ${status.progress}%`);
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Download result
  const downloadRes = await fetch(`${API_URL}/api/v1/jobs/${job_id}/download`);
  const outputBuffer = Buffer.from(await downloadRes.arrayBuffer());
  fs.writeFileSync('output.mp4', outputBuffer);
  console.log('Saved to output.mp4');
}

processVideo('input.mp4');
```

### Python

```python
import base64
import time
import requests

API_URL = 'http://localhost:7070'

def process_video(video_path: str, output_path: str):
    # Read and encode video
    with open(video_path, 'rb') as f:
        video_bytes = base64.b64encode(f.read()).decode('utf-8')
    
    # Submit job
    response = requests.post(f'{API_URL}/api/v1/video/process', json={
        'video_bytes': video_bytes,
        'options': {
            'mode': 'inpaint',
            'platform': 'sora',
            'upscale': True,
            'upscale_factor': 2
        }
    })
    job_id = response.json()['job_id']
    print(f'Job submitted: {job_id}')
    
    # Poll for completion
    while True:
        status = requests.get(f'{API_URL}/api/v1/jobs/{job_id}').json()
        
        if status['status'] == 'completed':
            print('Complete!', status['result'])
            break
        elif status['status'] == 'failed':
            raise Exception(status['error'])
        
        print(f"Progress: {status['progress']}%")
        time.sleep(5)
    
    # Download result
    response = requests.get(f'{API_URL}/api/v1/jobs/{job_id}/download')
    with open(output_path, 'wb') as f:
        f.write(response.content)
    print(f'Saved to {output_path}')

process_video('input.mp4', 'output.mp4')
```

### cURL

```bash
# Submit job
JOB_ID=$(curl -s -X POST http://localhost:7070/api/v1/video/process \
  -H "Content-Type: application/json" \
  -d "{\"video_bytes\": \"$(base64 -i input.mp4)\", \"options\": {\"mode\": \"inpaint\", \"platform\": \"sora\", \"upscale\": true}}" \
  | jq -r '.job_id')

echo "Job: $JOB_ID"

# Poll status
while true; do
  STATUS=$(curl -s "http://localhost:7070/api/v1/jobs/$JOB_ID" | jq -r '.status')
  echo "Status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 5
done

# Download
curl -o output.mp4 "http://localhost:7070/api/v1/jobs/$JOB_ID/download"
```

---

## Direct Modal API (Bypass Safari Automation)

For direct Modal access without Safari Automation:

### Watermark Removal + Upscale

```bash
curl -X POST "https://isaiahdupree33--blanklogo-watermark-removal-process-video-http.modal.run" \
  -H "Content-Type: application/json" \
  -d '{
    "video_bytes": "<base64>",
    "mode": "inpaint",
    "platform": "sora",
    "upscale": true,
    "upscale_factor": 2
  }'
```

### Health Check

```bash
curl "https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run"
```

---

## Error Handling

| Error Code | Description | Solution |
|------------|-------------|----------|
| `400` | Invalid request | Check video_bytes encoding |
| `404` | Job not found | Verify job_id |
| `500` | Processing error | Check Modal status |
| `503` | Modal unavailable | Uses local fallback automatically |

---

## Performance

| Video Size | Modal GPU | Local FFmpeg |
|------------|-----------|--------------|
| 5 MB | ~60s | ~15s |
| 10 MB | ~120s | ~25s |
| 25 MB | ~180s | ~45s |
| 50 MB | ~300s | ~90s |

*Times include watermark removal + 2x upscaling*

---

## Quality Test Results (January 31, 2026)

Tested with Sora video: `badass-01.mp4` (480x872, HEVC, 974 KB, 9.8s)

### Results

| Method | Output Size | Resolution | Codec | Time | Quality |
|--------|-------------|------------|-------|------|---------|
| **Original** | 974 KB | 480x872 | HEVC | - | Has watermark |
| **Local HEVC Crop** | 1,949 KB | 480x**772** | HEVC | 2.7s | ⭐⭐⭐⭐ Cropped 100px |
| **Modal AI Inpaint** | 3,996 KB | 480x**872** | H.264 | 60s | ⭐⭐⭐⭐⭐ **Full resolution** |
| **Local H.264 HQ** | 4,762 KB | 480x772 | H.264 | 1.5s | ⭐⭐⭐ Larger file |

### Key Findings

| Metric | Local Crop | Modal AI |
|--------|------------|----------|
| **Resolution** | 480x772 (lost 100px) | **480x872** (full) |
| **Watermark** | Cropped off | **AI inpainted** |
| **File Size** | +100% | +310% |
| **Processing** | 2.7s | 60s |

### Winner: Modal AI Inpaint

- ✅ **Preserves full resolution** (no cropping)
- ✅ **AI removes watermark cleanly** (YOLO detect + LAMA inpaint)
- ✅ **291 frames processed** with watermark detection
- ⚠️ Larger file (4x original) due to H.264 re-encode

### Test Output Files

```
~/sora-videos/full-quality-test/
├── 1_local_hevc_crop.mp4    (1.9 MB) - Bottom cropped, HEVC
├── 2_modal_ai_inpaint.mp4   (3.9 MB) - Full frame, watermark AI-removed
└── 3_local_h264_hq.mp4      (4.6 MB) - Bottom cropped, H.264
```

### Run the Test

```bash
cd "/Users/isaiahdupree/Documents/Software/Safari Automation"
npx tsx scripts/full-quality-test.ts ~/sora-videos/badass-marathon/badass-01.mp4
```

---

*Last updated: January 31, 2026*

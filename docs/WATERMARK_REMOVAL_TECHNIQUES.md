# Watermark Removal Techniques - Learnings from SoraWatermarkCleaner

**Source:** https://github.com/linkedlist771/SoraWatermarkCleaner  
**Analyzed:** January 3, 2026  
**Purpose:** Document advanced watermark removal techniques for BlankLogo implementation

---

## Executive Summary

SoraWatermarkCleaner uses a **two-stage deep learning pipeline**:
1. **Detection** - YOLOv11 to locate watermark bounding boxes
2. **Inpainting** - LAMA or E2FGVI-HQ models to remove/reconstruct the watermark region

This is significantly more sophisticated than our current simple crop approach, but also more resource-intensive.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SoraWatermarkCleaner Pipeline                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐    │
│  │   Input     │     │   YOLO      │     │   Frame-by-Frame    │    │
│  │   Video     │────▶│   Detector  │────▶│   BBox Detection    │    │
│  │             │     │  (v11s)     │     │                     │    │
│  └─────────────┘     └─────────────┘     └──────────┬──────────┘    │
│                                                      │               │
│                                          ┌───────────▼───────────┐   │
│                                          │  Missing Frame Fill   │   │
│                                          │  (Interval Averaging) │   │
│                                          └───────────┬───────────┘   │
│                                                      │               │
│                    ┌─────────────────────────────────┼───────────┐   │
│                    │                                 │           │   │
│              ┌─────▼─────┐                    ┌──────▼──────┐    │   │
│              │   LAMA    │                    │  E2FGVI-HQ  │    │   │
│              │  Cleaner  │                    │   Cleaner   │    │   │
│              │  (Fast)   │                    │ (Temporal)  │    │   │
│              └─────┬─────┘                    └──────┬──────┘    │   │
│                    │                                 │           │   │
│                    └─────────────┬───────────────────┘           │   │
│                                  │                               │   │
│                           ┌──────▼──────┐                        │   │
│                           │   FFmpeg    │                        │   │
│                           │   Encode    │                        │   │
│                           │ + Audio Mix │                        │   │
│                           └──────┬──────┘                        │   │
│                                  │                               │   │
│                           ┌──────▼──────┐                        │   │
│                           │   Output    │                        │   │
│                           │   Video     │                        │   │
│                           └─────────────┘                        │   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Watermark Detection (YOLO)

### Approach
- Uses **YOLOv11s** (small variant) trained specifically on Sora watermarks
- Trained on custom-labeled dataset (available on HuggingFace)
- Returns bounding box coordinates `(x1, y1, x2, y2)` and confidence score

### Key Implementation Details

```python
class SoraWaterMarkDetector:
    def __init__(self):
        self.model = YOLO("resources/best.pt")  # Custom trained weights
        self.model.to(device)
        self.model.eval()

    def detect(self, input_image: np.array):
        results = self.model(input_image, verbose=False)
        result = results[0]
        
        if len(result.boxes) == 0:
            return {"detected": False, "bbox": None}
        
        box = result.boxes[0]  # Highest confidence detection
        xyxy = box.xyxy[0].cpu().numpy()
        
        return {
            "detected": True,
            "bbox": (int(x1), int(y1), int(x2), int(y2)),
            "confidence": float(box.conf[0]),
            "center": (int(center_x), int(center_y))
        }
```

### Handling Missed Detections

When YOLO fails to detect watermark in some frames, they use **interval-based averaging**:

1. **Find breakpoints** in bbox center positions (change detection)
2. **Calculate average bbox** for each interval
3. **Fill missed frames** with interval average or neighbor fallback

```python
# Fallback strategy for missed frames
if interval_bbox is None:
    before_box = frame_bboxes[missed_idx - 1]["bbox"]
    after_box = frame_bboxes[missed_idx + 1]["bbox"]
    if before_box:
        frame_bboxes[missed_idx]["bbox"] = before_box
    elif after_box:
        frame_bboxes[missed_idx]["bbox"] = after_box
```

---

## Stage 2: Watermark Removal (Inpainting)

### Option A: LAMA Cleaner (Fast, Per-Frame)

**LAMA** (Large Mask Inpainting) is an image inpainting model that fills masked regions.

**Pros:**
- Fast processing (~5-15 seconds per video)
- Good quality for static watermarks
- Lower GPU memory requirements

**Cons:**
- No temporal consistency (may cause flickering)
- Each frame processed independently

```python
class LamaCleaner:
    def clean(self, input_image: np.array, watermark_mask: np.array):
        # Create binary mask from bbox
        mask = np.zeros((height, width), dtype=np.uint8)
        mask[y1:y2, x1:x2] = 255
        
        # Inpaint using LAMA model
        result = self.model_manager(input_image, mask, self.inpaint_request)
        return result
```

### Option B: E2FGVI-HQ Cleaner (Temporal Consistency)

**E2FGVI-HQ** (End-to-End Flow-Guided Video Inpainting) uses temporal information for smooth results.

**Pros:**
- Temporal consistency (no flickering)
- Better quality for moving watermarks
- Uses reference frames for context

**Cons:**
- Much slower (requires CUDA)
- Higher GPU memory requirements
- Requires chunked processing for long videos

**Key Technique: Overlapping Chunk Processing**

```python
# Process video in overlapping chunks to manage memory
chunk_size = int(0.2 * video_length)  # 20% of video per chunk
overlap_size = int(0.05 * video_length)  # 5% overlap

for chunk_idx in range(num_chunks):
    start_idx = chunk_idx * (chunk_size - overlap_size)
    end_idx = min(start_idx + chunk_size, video_length)
    
    # Process chunk with model
    comp_frames_chunk = self.process_frames_chunk(...)
    
    # Blend overlapping regions
    comp_frames = merge_frames_with_overlap(
        result_frames=comp_frames,
        chunk_frames=comp_frames_chunk,
        start_idx=start_idx,
        overlap_size=overlap_size
    )
```

**Reference Frame Selection for Context:**

```python
def get_ref_index(frame_idx, neighbor_ids, length, ref_length, num_ref):
    """Select reference frames for temporal context"""
    ref_index = []
    for i in range(0, length, ref_length):  # Every ref_length frames
        if i not in neighbor_ids:  # Exclude neighbors
            ref_index.append(i)
    return ref_index
```

---

## Video Processing Pipeline

### FFmpeg Integration

```python
# Output encoding with FFmpeg
output_options = {
    "pix_fmt": "yuv420p",
    "vcodec": "libx264",
    "preset": "slow",
}

# Use original bitrate * 1.2 or CRF 18 for quality
if original_bitrate:
    output_options["video_bitrate"] = str(int(original_bitrate * 1.2))
else:
    output_options["crf"] = "18"

# Stream frames to FFmpeg
process_out = (
    ffmpeg.input("pipe:", format="rawvideo", pix_fmt="bgr24", s=f"{w}x{h}", r=fps)
    .output(str(temp_output_path), **output_options)
    .run_async(pipe_stdin=True)
)

# Write cleaned frames
for frame in cleaned_frames:
    process_out.stdin.write(frame.tobytes())

# Merge audio from original
ffmpeg.output(video_stream, audio_stream, output_path, vcodec="copy", acodec="aac")
```

---

## Performance Considerations

### Memory Management

```python
# Adaptive chunk size based on available VRAM
def profiling_chunk_size(self):
    memory_results = memory_profiling()
    # ~5 frames per GB of VRAM
    self.chunk_size = int(memory_results.free_memory * CHUNK_SIZE_PER_GB_VRAM)
```

### GPU Optimization

```python
# torch.compile for faster inference (PyTorch 2.0+)
if enable_torch_compile:
    self.model = torch.compile(self.model)
    
    # Cache compiled artifacts for faster startup
    artifacts = torch.compiler.save_cache_artifacts()
    cache_path.write_bytes(artifacts)
```

---

## Comparison: Crop vs Inpainting

| Aspect | Simple Crop (Current BlankLogo) | Inpainting (SoraWatermarkCleaner) |
|--------|----------------------------------|-----------------------------------|
| **Quality** | Loses video pixels | Preserves full frame |
| **Speed** | Very fast (<1s) | Slow (10s-2min) |
| **GPU Required** | No | Yes (for best results) |
| **Temporal** | N/A | E2FGVI-HQ is flicker-free |
| **Complexity** | FFmpeg only | YOLO + LAMA/E2FGVI |
| **Use Case** | Fixed position watermarks | Dynamic/moving watermarks |

---

## Recommendations for BlankLogo

### Tier 1: Fast Mode (Current)
- Keep FFmpeg crop for fixed-position platform watermarks
- Fastest option, no GPU required
- Best for Sora, TikTok, etc. with consistent watermark positions

### Tier 2: Quality Mode (New)
- Integrate LAMA inpainting for better quality
- Requires GPU, ~10-30 seconds processing
- Preserves full video dimensions

### Tier 3: Premium Mode (Future)
- Add E2FGVI-HQ for temporal consistency
- Best for professional/commercial use
- Requires significant GPU (8GB+ VRAM)

### Implementation Priority

1. **Phase 1** - Add YOLO watermark detection
   - Train/use existing weights for platform detection
   - Auto-detect watermark position instead of hardcoded presets
   
2. **Phase 2** - Integrate LAMA inpainting
   - Use IOPaint library (Apache licensed)
   - Add as optional "Quality Mode"

3. **Phase 3** - Add E2FGVI-HQ
   - Temporal consistency for pro users
   - Chunked processing for long videos

---

## Key Dependencies

```
# Detection
ultralytics>=8.0.0  # YOLOv11

# Inpainting (LAMA)
torch>=2.0.0
opencv-python
# IOPaint library (https://github.com/Sanster/IOPaint)

# Video Processing
ffmpeg-python
numpy

# E2FGVI-HQ (temporal)
# Custom model from paper: "Towards An End-to-End Framework for Flow-Guided Video Inpainting"
```

---

## References

- **SoraWatermarkCleaner**: https://github.com/linkedlist771/SoraWatermarkCleaner
- **IOPaint (LAMA)**: https://github.com/Sanster/IOPaint
- **Ultralytics YOLO**: https://github.com/ultralytics/ultralytics
- **E2FGVI Paper**: CVPR 2022
- **HuggingFace Dataset**: https://huggingface.co/datasets/LLinked/sora-watermark-dataset

---

## License Note

SoraWatermarkCleaner is Apache 2.0 licensed, which allows commercial use with attribution.
IOPaint is also Apache 2.0 licensed.

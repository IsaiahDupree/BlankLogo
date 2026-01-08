# Watermark Removal Quality Improvements

## Current Issues

After testing on `sora-watermark-test.mp4`, the output shows:
- ✅ Watermark detected (246/246 frames)
- ✅ Video dimensions preserved (704x1280)
- ✅ Audio track preserved
- ❌ **Blurry/ghosting artifacts** in watermark area
- ❌ Using OpenCV TELEA fallback (low quality)

## Root Cause

**LAMA model not loading** - Using OpenCV `cv2.inpaint(TELEA)` fallback instead of AI-based LAMA inpainting.

```
simple-lama-inpainting failed (No module named 'simple_lama_inpainting'), using fallback inpainting
```

## Improvements Roadmap

### 1. Install LAMA Model (High Priority) ⭐

**Problem:** `simple-lama-inpainting` not installed locally

**Solution:**
```bash
# Create Python virtual environment
cd apps/worker/python
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify LAMA loads
python3 -c "from simple_lama_inpainting import SimpleLama; print('✅ LAMA installed')"
```

**Expected Improvement:** 10x better quality, no visible artifacts

---

### 2. Increase Detection Padding (Medium Priority)

**Problem:** Mask may not cover full watermark edges

**Current:**
```python
def create_mask(self, frame_shape, bbox, padding=5):
```

**Improvement:**
```python
def create_mask(self, frame_shape, bbox, padding=15):  # Increased from 5 to 15
```

**Expected Improvement:** Better edge coverage, smoother transitions

---

### 3. Add Mask Dilation (Medium Priority)

**Problem:** Sharp mask edges create visible boundaries

**Solution:**
```python
import cv2

def create_mask(self, frame_shape, bbox, padding=15, dilate=True):
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[y1:y2, x1:x2] = 255
    
    if dilate:
        # Dilate mask for smoother edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        # Gaussian blur for soft edges
        mask = cv2.GaussianBlur(mask, (21, 21), 0)
    
    return mask
```

**Expected Improvement:** Smoother blending, no hard edges

---

### 4. Improve Detection Accuracy (High Priority) ⭐

**Problem:** YOLO model trained on old Sora watermarks, may miss new styles

**Current Approach:**
- YOLO detection with 0.25 confidence threshold
- Fallback bbox for known platforms

**Improvements:**

#### A. Lower Confidence Threshold
```python
detector = WatermarkDetector(confidence_threshold=0.15)  # From 0.25
```

#### B. Use Fallback More Aggressively
```python
# Always use fallback for Sora if confidence < 0.5
if platform == "sora" and (not detected or confidence < 0.5):
    bbox = get_fallback_bbox(frame.shape, "sora")
```

#### C. Retrain YOLO on New Watermarks
```bash
# Collect new Sora watermark samples
# Annotate with labelImg or CVAT
# Fine-tune YOLOv11s model
```

**Expected Improvement:** 100% detection rate, better bbox accuracy

---

### 5. Add Temporal Consistency (Low Priority)

**Problem:** Frame-by-frame inpainting causes flickering

**Solution:** Use video inpainting model (E2FGVI_HQ)

```python
from cleaner.e2fgvi_hq_cleaner import E2FGVIHQCleaner

# Process in chunks for temporal consistency
cleaner = E2FGVIHQCleaner()
result = cleaner.inpaint_video(frames, masks)
```

**Trade-off:** Much slower (3-5 min vs 10s), requires GPU

**Expected Improvement:** No flickering, temporally consistent

---

### 6. Post-Processing Enhancement (Low Priority)

**Problem:** Inpainted area may have slight color/texture mismatch

**Solution:**
```python
def enhance_inpainted_region(frame, mask, inpainted):
    # Color correction
    inpainted = match_color_histogram(inpainted, frame, mask)
    
    # Texture preservation
    inpainted = preserve_high_freq(inpainted, frame, mask)
    
    # Feather edges
    inpainted = feather_blend(inpainted, frame, mask, feather_radius=10)
    
    return inpainted
```

**Expected Improvement:** Better color/texture matching

---

## Implementation Priority

| Priority | Improvement | Effort | Impact | Status |
|----------|-------------|--------|--------|--------|
| 🔴 **P0** | Install LAMA model | Low | High | ⏳ Pending |
| 🔴 **P0** | Improve detection accuracy | Medium | High | ⏳ Pending |
| 🟡 **P1** | Increase mask padding | Low | Medium | ⏳ Pending |
| 🟡 **P1** | Add mask dilation/blur | Low | Medium | ⏳ Pending |
| 🟢 **P2** | Temporal consistency (E2FGVI) | High | Medium | ⏳ Pending |
| 🟢 **P2** | Post-processing enhancement | Medium | Low | ⏳ Pending |

---

## Quick Wins (Do First)

### 1. Install LAMA Locally
```bash
cd apps/worker/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Update Mask Padding
```python
# inpainter.py line 61
padding: int = 15  # Changed from 5
```

### 3. Test Again
```bash
npx vitest run tests/integration/watermark-removal.test.ts
```

---

## Expected Results After Improvements

| Metric | Before | After (LAMA) | After (All) |
|--------|--------|--------------|-------------|
| **Quality** | 3/10 (blurry) | 8/10 (clean) | 9/10 (seamless) |
| **Detection** | 100% (fallback) | 100% (YOLO) | 100% (YOLO) |
| **Processing Time** | 9.2s | 12s | 15s |
| **Artifacts** | Visible blur | Minimal | None |
| **Flickering** | Some | Some | None |

---

## Testing Checklist

After each improvement:

- [ ] Run integration test: `npx vitest run tests/integration/watermark-removal.test.ts`
- [ ] Visual inspection: Compare input vs output side-by-side
- [ ] Check processing time: Should stay under 30s for 8s video
- [ ] Verify no new issues: Audio, dimensions, duration preserved
- [ ] Test on multiple platforms: Sora, TikTok, Runway, Pika

---

## References

- [LAMA Paper](https://arxiv.org/abs/2109.07161)
- [E2FGVI Video Inpainting](https://github.com/MCG-NKU/E2FGVI)
- [SoraWatermarkCleaner](https://github.com/linkedlist771/SoraWatermarkCleaner)
- [YOLOv11 Detection](https://docs.ultralytics.com/)

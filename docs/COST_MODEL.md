# BlankLogo Cost Model & Pricing

Realistic cost model for generating faceless long-form videos with HF TTS + OpenAI Whisper timestamps + OpenAI image generation.

---

## 1) Cost to Generate One 10-Minute Video (COGS)

Assumptions for faceless long-form style:
- **10 min narration**
- **~1 image every ~8 seconds** → ~75 images
- Whisper used once for segment timestamps
- Remotion render on worker

### A) Whisper Timestamps (OpenAI)

OpenAI Whisper transcription: **$0.006/minute**
- 10 minutes → **$0.06**

### B) Images (OpenAI Image Generation)

OpenAI image pricing (1024x1024):

| Quality | Per Image | 75 Images |
|---------|-----------|-----------|
| Low | $0.009 | $0.675 |
| Medium | $0.034 | $2.55 |
| High | $0.133 | $9.975 |

### C) Voice Generation (Hugging Face TTS)

GPU billing ~$0.00012/sec. TTS for 10 min audio takes ~1-5 min GPU time:
- **$0.01 – $0.10** per video (efficient usage)

### D) Remotion Render Compute

- **$0.05 – $0.30** per 10-minute video
- Depends on: resolution, effects, machine type, render speed

### E) Storage + Downloads (Supabase)

- **$0.05 – $0.20** per video
- Reducible with lower bitrate + expiring links

---

### ✅ Total COGS Estimate (10-Minute Video)

| Mode | Image Cost | Total COGS |
|------|------------|------------|
| **Economy** (Low) | $0.68 | **$0.85 – $1.35** |
| **Standard** (Medium) | $2.55 | **$2.70 – $3.40** |
| **High** | $9.98 | **$10.0 – $11.5+** |

**Recommendation:** Default to **Low or Low+** (mostly low, occasional medium hero images)

---

## 2) Pricing Strategy

### Market Anchors
- Pictory: starts ~$19/mo
- InVideo: 50 video mins at ~$28/mo, 200 mins at ~$50/mo

### Pay-as-You-Go
- **$9–$15 per 10-minute video** (standard quality)
- ~3–10× margin on Standard COGS

### Subscription Tiers

| Tier | Price | Credits | Use Case |
|------|-------|---------|----------|
| **Starter** | $19/mo | 60 | Weekly 10-min creator |
| **Pro** | $49/mo | 200 | 3x/week creator |
| **Creator+** | $99/mo | 500 | Daily poster |

---

## 3) Credit System

### Base Rate
**1 credit = 1 minute of finished video (Standard mode)**

Standard mode includes:
- Low image quality
- 1 image per ~8-10 seconds
- Default sound effects pack

### Upsell Modifiers (Protect Margin)

| Feature | Credit Cost |
|---------|-------------|
| Medium images | +0.3 credits/min |
| High images | +1.2 credits/min |
| Faster cuts (more images) | +0.2 credits/min per step |
| 4K export | +10% credits |

---

## 4) Top-Up Packs

| Price | Credits | Per Credit |
|-------|---------|------------|
| $10 | 25 | $0.40 |
| $25 | 80 | $0.31 |
| $60 | 250 | $0.24 |
| $99 | 500 | $0.20 |

---

## 5) Usage Pattern Estimates

| Creator Type | Videos/Month | Credits Needed | Recommended |
|--------------|--------------|----------------|-------------|
| Weekly 10-min | 4 | ~40 | Starter (60) |
| 3x/week 10-min | 12 | ~120 | Pro (200) |
| Daily 10-min | 30 | ~300 | Pro + top-up or Creator+ |

---

## 6) Margin Analysis

| Scenario | COGS | Price | Margin |
|----------|------|-------|--------|
| Starter (60 credits) | ~$8 | $19 | 58% |
| Pro (200 credits) | ~$27 | $49 | 45% |
| Creator+ (500 credits) | ~$68 | $99 | 31% |

---

## References

- [OpenAI Pricing](https://platform.openai.com/docs/pricing)
- [HuggingFace Pricing](https://huggingface.co/pricing)
- [Pictory Pricing](https://pictory.ai/pricing)
- [InVideo Plans](https://help.invideo.io/en/articles/11528140-what-plans-does-invideo-offer-and-what-s-included-in-each)

---

*Last updated: January 2, 2026*

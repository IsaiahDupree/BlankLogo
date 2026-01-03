# Groq Transcription Service

CanvasCast uses **Groq's Whisper API** as the primary transcription provider for audio alignment. Groq offers free, fast, and accurate transcription using Whisper Large V3.

## Overview

| Provider | Model | Cost | Speed | Quality |
|----------|-------|------|-------|---------|
| **Groq** (primary) | whisper-large-v3 | **Free** | ⚡ Fastest | ⭐⭐⭐⭐⭐ |
| OpenAI (fallback) | whisper-1 | $0.006/min | Medium | ⭐⭐⭐⭐⭐ |

**Benefits:**
- 100% free transcription (no cost per token)
- ~10x faster than OpenAI
- High accuracy using Whisper Large V3 model
- Automatic fallback to OpenAI if Groq fails

## Configuration

### Environment Variables

```bash
# apps/worker/.env

# Groq for transcription (FREE - primary)
GROQ_API_KEY=gsk_your-groq-key

# OpenAI (fallback for transcription)
OPENAI_API_KEY=sk-your-openai-key
```

Get your free Groq API key at: https://console.groq.com/keys

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Alignment Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Narration Audio (MP3)                                          │
│      │                                                           │
│      ▼                                                           │
│  ┌─────────────────────┐                                        │
│  │   runAlignment()    │  pipeline/steps/run-alignment.ts       │
│  └──────────┬──────────┘                                        │
│             │                                                    │
│             ▼                                                    │
│  ┌─────────────────────┐     ┌─────────────────────┐            │
│  │    Groq Whisper     │────▶│   OpenAI Whisper    │            │
│  │  (whisper-large-v3) │     │    (whisper-1)      │            │
│  │     PRIMARY         │     │     FALLBACK        │            │
│  └──────────┬──────────┘     └──────────┬──────────┘            │
│             │                           │                        │
│             ▼                           ▼                        │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Transcription Result                │            │
│  │  - segments: [{start, end, text}]               │            │
│  │  - words: [{word, start, end}]                  │            │
│  └──────────────────────┬──────────────────────────┘            │
│                         │                                        │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Output Files                        │            │
│  │  - whisper_segments.json                        │            │
│  │  - captions.srt                                 │            │
│  │  - captions.vtt                                 │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

### `apps/worker/src/pipeline/steps/run-alignment.ts`

Main transcription logic with Groq primary and OpenAI fallback:

```typescript
import Groq from "groq-sdk";
import OpenAI from "openai";

const groq = process.env.GROQ_API_KEY 
  ? new Groq({ apiKey: process.env.GROQ_API_KEY }) 
  : null;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Try Groq first (free), fallback to OpenAI
if (groq) {
  try {
    transcription = await groq.audio.transcriptions.create({
      file: audioBlob,
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });
  } catch (groqError) {
    // Fallback to OpenAI
    provider = "openai";
  }
}

if (provider === "openai") {
  transcription = await openai.audio.transcriptions.create({
    file: audioBlob,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  });
}
```

## Output Format

### Whisper Segments JSON
```json
{
  "segments": [
    { "id": 0, "start": 0.0, "end": 2.5, "text": "Hello everyone" },
    { "id": 1, "start": 2.5, "end": 5.0, "text": "Welcome to my video" }
  ],
  "words": [
    { "word": "Hello", "start": 0.0, "end": 0.4 },
    { "word": "everyone", "start": 0.5, "end": 1.0 }
  ],
  "duration": 5.0
}
```

### SRT Captions
```
1
00:00:00,000 --> 00:00:02,500
Hello everyone

2
00:00:02,500 --> 00:00:05,000
Welcome to my video
```

## Rate Limits

### Groq Free Tier
- **Audio**: 20 requests/minute
- **File size**: 25MB max per audio file
- **Duration**: ~10 hours/day estimated

### Fallback Behavior
If Groq fails (rate limit, error, etc.), the system automatically falls back to OpenAI Whisper with a logged warning.

## Cost Comparison

For 1 hour of audio transcription:

| Provider | Cost |
|----------|------|
| **Groq** | **$0.00** |
| OpenAI | $0.36 |
| Deepgram | $0.26 |
| AssemblyAI | $0.39 |

**CanvasCast saves 100% on transcription costs by using Groq as the primary provider.**

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `GROQ_API_KEY not found` | Missing env var | Add to `apps/worker/.env` |
| `Rate limit exceeded` | Too many requests | System auto-falls back to OpenAI |
| `File too large` | Audio > 25MB | Audio is extracted at 64kbps, should be fine |
| Groq unavailable | Service outage | Automatic OpenAI fallback |

## Related Documentation

- [Worker Pipeline](./WORKER_PIPELINE.md)
- [Voice Generation](./VOICE_GENERATION.md)
- [Cost Model](./COST_MODEL.md)

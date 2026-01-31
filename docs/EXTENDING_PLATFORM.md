# Extending the BlankLogo Platform

This document explains how to leverage the existing BlankLogo scaffolding to build new AI-powered video features and products.

## Architecture Overview

BlankLogo is built on a **job-based processing architecture** that separates concerns cleanly:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Frontend  │────▶│   API Server    │────▶│  Job Queue (DB) │
│   (Next.js)     │     │   (Next.js API) │     │   (Supabase)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   Worker Node   │◀─────────────┘
                        │   (Render.com)  │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   GPU Backend   │
                        │   (Modal.com)   │
                        └─────────────────┘
```

This architecture is **feature-agnostic** - any AI video processing task can plug into this system.

---

## Core Components You Can Reuse

### 1. **Credit System**
- Pre-built credit ledger with transactions
- Credit reservation on job start, release on failure
- Stripe integration for purchasing
- Promo code system

### 2. **Job Queue System**
- Status tracking: `queued` → `claimed` → `processing` → `completed`/`failed`
- Real-time polling from frontend
- Automatic retries with exponential backoff
- Progress updates via database

### 3. **File Handling**
- Upload to Supabase Storage (or URL input)
- Signed URLs for secure access
- Automatic cleanup of temp files

### 4. **User System**
- Supabase Auth (email, Google OAuth)
- User profiles with subscription tiers
- Notification preferences

### 5. **Analytics & Tracking**
- PostHog event tracking
- Meta Pixel conversion tracking
- Google Analytics integration

---

## How to Add a New Feature

### Example: "Auto Text B-Roll" Feature

This feature automatically adds trending text overlays to video clips.

#### Step 1: Define the Job Type

Add to your job types in the database schema:

```sql
-- Add new job type to existing enum or create feature flag
ALTER TYPE job_type ADD VALUE 'auto_text_broll';

-- Or use a separate features table
CREATE TABLE bl_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'
);
```

#### Step 2: Create the Frontend Page

```
apps/web/src/app/app/text-broll/page.tsx
```

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Type, Sparkles, Upload } from "lucide-react";

const TEXT_STYLES = [
  { id: "trending", name: "Trending TikTok", preview: "Bold white text" },
  { id: "subtitle", name: "Subtitles", preview: "Yellow captions" },
  { id: "meme", name: "Meme Style", preview: "Impact font" },
];

export default function TextBRollPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [textStyle, setTextStyle] = useState("trending");
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Use the existing job creation pattern
    const res = await fetch("/api/jobs/text-broll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_url: videoUrl,
        style: textStyle,
        custom_text: customText,
      }),
    });

    const { job_id } = await res.json();
    // Redirect to status page (reuse existing pattern)
    router.push(`/app/jobs/${job_id}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Video input - reuse existing components */}
      {/* Style selection */}
      {/* Custom text input */}
      {/* Submit button */}
    </form>
  );
}
```

#### Step 3: Create the API Endpoint

```
apps/web/src/app/api/jobs/text-broll/route.ts
```

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  
  // Check credits (reuse existing pattern)
  const { data: balance } = await supabase.rpc("bl_get_credit_balance", {
    p_user_id: user.id,
  });
  
  if (balance < 1) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // Reserve credits
  await supabase.rpc("bl_reserve_credits", {
    p_user_id: user.id,
    p_amount: 1,
    p_reason: "text_broll_job",
  });

  // Create job in queue
  const { data: job } = await supabase
    .from("bl_jobs")
    .insert({
      user_id: user.id,
      type: "text_broll",
      status: "queued",
      input_url: body.video_url,
      config: {
        style: body.style,
        custom_text: body.custom_text,
      },
    })
    .select()
    .single();

  return NextResponse.json({ job_id: job.id });
}
```

#### Step 4: Add Worker Handler

```
apps/worker/src/handlers/text-broll.ts
```

```typescript
import { Job } from "../types";
import { callModalEndpoint } from "../modal-client";

export async function processTextBRoll(job: Job): Promise<string> {
  const { input_url, config } = job;
  
  // Call GPU backend for processing
  const result = await callModalEndpoint("text-broll", {
    video_url: input_url,
    style: config.style,
    custom_text: config.custom_text,
  });

  return result.output_url;
}
```

#### Step 5: Add GPU Processing (Modal)

```python
# modal/text_broll.py
import modal

app = modal.App("blanklogo-text-broll")

@app.function(gpu="T4", image=modal.Image.debian_slim().pip_install("moviepy", "pillow"))
def add_text_to_video(video_url: str, style: str, text: str) -> str:
    from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip
    
    # Download video
    # Add text overlay based on style
    # Upload result
    # Return output URL
    pass
```

---

## Feature Ideas & Implementation Patterns

### 1. **YouTube Long-Form Generator**

**Concept**: Generate 10-minute videos from a topic/niche.

**Architecture**:
```
Input: Topic + Niche
   ↓
Script Generator (GPT-4) → Script with timestamps
   ↓
Voice Generator (ElevenLabs/OpenAI TTS) → Audio narration
   ↓
B-Roll Finder (Pexels/Unsplash API) → Stock footage
   ↓
Video Assembler (MoviePy/FFmpeg) → Final video
   ↓
Output: 10-min YouTube-ready video
```

**Job Config Schema**:
```typescript
interface YouTubeGeneratorConfig {
  topic: string;
  niche: string;
  target_duration_minutes: number;
  voice_id: string;
  style: "documentary" | "tutorial" | "entertainment";
  include_captions: boolean;
  music_style?: string;
}
```

**Credit Cost**: 5-10 credits (based on duration)

### 2. **AI Video Repurposing**

**Concept**: Take one long video, extract best clips for shorts.

**Architecture**:
```
Input: Long-form video URL
   ↓
Transcription (Whisper) → Full transcript with timestamps
   ↓
Highlight Detection (GPT-4) → Best moments identified
   ↓
Clip Extraction (FFmpeg) → Multiple short clips
   ↓
Reformat for Platform → Vertical crops for TikTok/Reels
   ↓
Output: Multiple platform-ready shorts
```

### 3. **Faceless Channel Automation**

**Concept**: Fully automated content pipeline for faceless channels.

**Components to Build**:
- Topic research (trending topics API)
- Script generation (GPT-4 with templates)
- AI voiceover (ElevenLabs)
- B-roll assembly (Pexels + custom overlays)
- Thumbnail generation (DALL-E)
- Auto-scheduling (YouTube API)

### 4. **Video Translation & Dubbing**

**Concept**: Translate videos to other languages with lip-sync.

**Pipeline**:
```
Original Video → Transcription → Translation → TTS → Lip Sync → Output
```

---

## Database Schema Pattern for New Features

```sql
-- Generic extensible job table
CREATE TABLE bl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,  -- 'watermark_removal', 'text_broll', 'youtube_gen', etc.
  status TEXT NOT NULL DEFAULT 'queued',
  
  -- Input/Output
  input_url TEXT,
  output_url TEXT,
  
  -- Feature-specific config (JSONB for flexibility)
  config JSONB DEFAULT '{}',
  
  -- Results and metadata
  result JSONB DEFAULT '{}',
  error TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Cost tracking
  credits_used INTEGER DEFAULT 1
);

-- Feature flags for gradual rollout
CREATE TABLE bl_feature_flags (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  rollout_percent INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'
);
```

---

## API Patterns

### Standard Job Creation Response
```typescript
interface JobCreationResponse {
  job_id: string;
  status: "queued";
  estimated_time_seconds: number;
  credits_reserved: number;
}
```

### Standard Job Status Response
```typescript
interface JobStatusResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;  // 0-100
  output_url?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}
```

### Polling Pattern (Reusable)
```typescript
async function pollJobStatus(jobId: string, onUpdate: (status: JobStatus) => void) {
  const poll = async () => {
    const res = await fetch(`/api/jobs/${jobId}/status`);
    const status = await res.json();
    onUpdate(status);
    
    if (status.status === "completed" || status.status === "failed") {
      return;
    }
    
    setTimeout(poll, 2000);  // Poll every 2 seconds
  };
  
  poll();
}
```

---

## Worker Architecture for Multiple Features

```typescript
// apps/worker/src/index.ts
import { processWatermarkRemoval } from "./handlers/watermark";
import { processTextBRoll } from "./handlers/text-broll";
import { processYouTubeGen } from "./handlers/youtube-gen";

const HANDLERS: Record<string, (job: Job) => Promise<string>> = {
  watermark_removal: processWatermarkRemoval,
  text_broll: processTextBRoll,
  youtube_gen: processYouTubeGen,
  // Add new handlers here
};

async function processJob(job: Job) {
  const handler = HANDLERS[job.type];
  if (!handler) {
    throw new Error(`Unknown job type: ${job.type}`);
  }
  return handler(job);
}
```

---

## Deployment Checklist for New Features

1. **Database**
   - [ ] Add migrations for new tables/columns
   - [ ] Update RLS policies
   - [ ] Add indexes for query performance

2. **Frontend**
   - [ ] Create page under `/app/[feature]/page.tsx`
   - [ ] Add navigation link in sidebar
   - [ ] Add analytics tracking events
   - [ ] Create loading/error states

3. **API**
   - [ ] Create endpoint at `/api/jobs/[feature]/route.ts`
   - [ ] Add validation with Zod
   - [ ] Integrate credit system
   - [ ] Add rate limiting

4. **Worker**
   - [ ] Add handler in `handlers/[feature].ts`
   - [ ] Register in handler map
   - [ ] Add error handling and retries

5. **GPU Backend**
   - [ ] Create Modal function
   - [ ] Test locally with `modal run`
   - [ ] Deploy to Modal

6. **Testing**
   - [ ] Unit tests for handler logic
   - [ ] E2E test for full flow
   - [ ] Load test for GPU backend

---

## Cost & Credit Modeling

| Feature | Estimated GPU Time | Suggested Credits |
|---------|-------------------|-------------------|
| Watermark Removal | 30-60s | 1 per minute |
| Text B-Roll | 20-40s | 1 per minute |
| YouTube Generator | 5-15min | 5-10 per video |
| Video Translation | 2-5min | 3-5 per minute |
| Clip Extraction | 1-3min | 2 per source video |

---

## Example: Full Feature Implementation Checklist

### "AI Shorts Generator" Feature

- [ ] **Planning**
  - [ ] Define input/output spec
  - [ ] Estimate processing time
  - [ ] Set credit cost

- [ ] **Database**
  - [ ] Migration: add `shorts_gen` job type
  - [ ] Migration: add config schema validation

- [ ] **Frontend**
  - [ ] `/app/shorts/page.tsx` - main interface
  - [ ] Topic input component
  - [ ] Style/template selector
  - [ ] Duration picker
  - [ ] Preview component

- [ ] **API**
  - [ ] `POST /api/jobs/shorts` - create job
  - [ ] `GET /api/jobs/shorts/[id]` - status
  - [ ] Input validation
  - [ ] Credit check & reservation

- [ ] **Worker**
  - [ ] `handlers/shorts.ts`
  - [ ] Script generation step
  - [ ] Voice synthesis step
  - [ ] B-roll assembly step
  - [ ] Final render step

- [ ] **GPU Backend**
  - [ ] `modal/shorts_gen.py`
  - [ ] Video assembly function
  - [ ] Text overlay function
  - [ ] Audio mixing function

- [ ] **Analytics**
  - [ ] Track `shorts.created`
  - [ ] Track `shorts.completed`
  - [ ] Track `shorts.downloaded`

- [ ] **Testing**
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] E2E golden path test

---

## Summary

The BlankLogo platform provides a complete scaffolding for building AI video features:

1. **Reuse the credit system** - don't rebuild billing
2. **Reuse the job queue** - proven async processing pattern
3. **Reuse the frontend patterns** - consistent UX
4. **Reuse the worker architecture** - just add new handlers
5. **Reuse analytics** - track everything for ML training

Each new feature is essentially:
- A new page in `/app/[feature]/`
- A new API route in `/api/jobs/[feature]/`
- A new handler in `worker/handlers/[feature].ts`
- A new Modal function for GPU processing

The hard infrastructure problems (auth, payments, queuing, storage, tracking) are already solved.

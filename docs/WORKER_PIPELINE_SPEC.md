# BlankLogo Worker Pipeline Specification v1

The worker pipeline processes jobs through a series of steps, producing a final video and asset pack.

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BLANKLOGO WORKER PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │SCRIPTING │ → │   TTS    │ → │ WHISPER  │ → │  IMAGES  │ → │ TIMELINE │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       ↓              ↓              ↓              ↓              ↓        │
│   script.json    audio/*.mp3   captions.srt   images/*.png   timeline.json │
│                  merged.mp3    timestamps.json                             │
│                                                                             │
│                              ┌──────────┐   ┌───────────┐                  │
│                              │  RENDER  │ → │ PACKAGING │                  │
│                              └──────────┘   └───────────┘                  │
│                                   ↓              ↓                         │
│                              final.mp4      assets.zip                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Job Status Flow

```
QUEUED → SCRIPTING → TTS → ALIGNMENT → VISUALS → REMOTION_RENDER → PACKAGING → READY
                                                                            ↓
                                                                         FAILED
```

---

## Step 1: SCRIPTING

### Purpose
Generate a structured video script from user inputs.

### Inputs
- `project.niche_preset` - Topic category
- `project_inputs` - User-provided content (text, extracted from files)
- `project.target_minutes` - Desired video length

### Process
1. **Outline Generation** (GPT-4)
   - Analyze input content
   - Generate 5-8 section outline with hooks
   - Estimate timing per section

2. **Script Expansion** (GPT-4)
   - Expand each section to full narration text
   - Include visual cues in brackets: `[SHOW: diagram of solar system]`
   - Add transitions between sections
   - Target word count: ~150 words/minute

3. **Script Validation**
   - Check total word count matches target duration
   - Verify all sections have visual cues
   - Ensure hook is engaging

### Outputs
```json
// script.json
{
  "version": "1.0",
  "title": "How Solar Panels Work",
  "estimatedDurationMs": 600000,
  "sections": [
    {
      "id": "section_001",
      "order": 0,
      "type": "hook",
      "title": "The Problem",
      "narrationText": "Every hour, the sun delivers enough energy to power humanity for a year...",
      "visualCues": ["sun energy visualization", "earth comparison"],
      "estimatedDurationMs": 45000,
      "wordCount": 112
    }
  ],
  "metadata": {
    "nichePreset": "science",
    "generatedAt": "2026-01-02T10:00:00Z",
    "modelUsed": "gpt-4",
    "tokensUsed": 2450
  }
}
```

### Storage
- `project-assets/u_{userId}/p_{projectId}/script.json`

### Error Handling
- **Retry**: API timeout, rate limit → retry 3x with exponential backoff
- **Fail**: Content policy violation, invalid input → fail with clear message

---

## Step 2: TTS (Text-to-Speech)

### Purpose
Generate audio narration for each script section.

### Inputs
- `script.json` - Generated script
- `project.voice_profile_id` - Optional custom voice
- TTS provider config (IndexTTS-2, OpenAI, etc.)

### Process
1. **Voice Selection**
   - If custom voice: download voice reference from storage
   - Else: use default voice for niche

2. **Per-Section Generation**
   - Generate audio for each section separately
   - Use consistent emotion/pace settings
   - Save as MP3 (128kbps)

3. **Audio Merge**
   - Concatenate all section audio
   - Add 0.5s silence between sections
   - Normalize audio levels

4. **Duration Calculation**
   - Measure actual duration of each section
   - Update script with real timing

### Outputs
```
audio/
├── section_001.mp3
├── section_002.mp3
├── ...
└── merged.mp3
```

```json
// tts_result.json
{
  "sections": [
    {
      "sectionId": "section_001",
      "audioPath": "audio/section_001.mp3",
      "durationMs": 47230,
      "startMs": 0,
      "endMs": 47230
    }
  ],
  "mergedAudioPath": "audio/merged.mp3",
  "totalDurationMs": 612450,
  "provider": "indextts"
}
```

### Storage
- `project-assets/u_{userId}/p_{projectId}/audio/`

### Error Handling
- **Retry**: HuggingFace quota exceeded → fallback to OpenAI TTS
- **Retry**: Network timeout → retry 3x
- **Fail**: All providers fail → fail job

---

## Step 3: ALIGNMENT (Whisper Timestamps)

### Purpose
Generate word-level timestamps and caption segments.

### Inputs
- `audio/merged.mp3` - Complete narration audio
- `script.json` - For validation

### Process
1. **Whisper Transcription**
   - Use OpenAI Whisper API with `timestamp_granularities: ["word", "segment"]`
   - Request verbose JSON output

2. **Caption Generation**
   - Group words into 5-8 word caption segments
   - Ensure natural break points (punctuation, pauses)
   - Max 2 lines per caption

3. **Beat Detection**
   - Identify "beat points" for visual changes
   - Based on: sentence ends, paragraph breaks, emphasis words
   - Minimum 3 seconds between beats

4. **SRT/VTT Generation**
   - Generate standard caption files
   - Include speaker labels if multiple voices

### Outputs
```json
// timestamps.json
{
  "version": "1.0",
  "words": [
    { "word": "Every", "start": 0.0, "end": 0.24 },
    { "word": "hour", "start": 0.24, "end": 0.52 }
  ],
  "segments": [
    {
      "id": 0,
      "start": 0.0,
      "end": 3.2,
      "text": "Every hour, the sun delivers enough energy"
    }
  ],
  "beats": [
    { "time": 0.0, "type": "section_start", "sectionId": "section_001" },
    { "time": 3.2, "type": "emphasis", "visualCue": "sun energy" },
    { "time": 8.5, "type": "sentence_end" }
  ]
}
```

```srt
// captions.srt
1
00:00:00,000 --> 00:00:03,200
Every hour, the sun delivers
enough energy

2
00:00:03,200 --> 00:00:06,800
to power humanity for an
entire year.
```

### Storage
- `project-assets/u_{userId}/p_{projectId}/captions.srt`
- `project-assets/u_{userId}/p_{projectId}/timestamps.json`

### Error Handling
- **Retry**: Whisper API timeout → retry 3x
- **Fallback**: Use estimated timing from TTS if Whisper fails

---

## Step 4: VISUALS (Image Generation)

### Purpose
Generate images for each beat/visual cue.

### Inputs
- `script.json` - Visual cues from script
- `timestamps.json` - Beat timing
- `project.visual_preset_id` - Style settings

### Process
1. **Prompt Planning**
   - Map visual cues to image prompts
   - Apply style preset (prefix/suffix)
   - Deduplicate similar cues

2. **Image Generation**
   - Use OpenAI DALL-E 3
   - Size: 1792x1024 (16:9 aspect ratio)
   - Quality based on user settings

3. **Image Optimization**
   - Compress to WebP or optimized PNG
   - Generate thumbnails for preview
   - Store original + compressed

4. **Cost Optimization**
   - Reuse images for similar beats
   - Skip generation for "continue" beats
   - Track images per minute for billing

### Outputs
```
images/
├── beat_001.png
├── beat_001_thumb.webp
├── beat_002.png
├── ...
```

```json
// images_result.json
{
  "images": [
    {
      "beatId": "beat_001",
      "prompt": "photorealistic sun energy visualization...",
      "imagePath": "images/beat_001.png",
      "thumbnailPath": "images/beat_001_thumb.webp",
      "generatedAt": "2026-01-02T10:05:00Z",
      "model": "dall-e-3",
      "cost": 0.04
    }
  ],
  "totalImages": 45,
  "totalCost": 1.80,
  "reusedCount": 5
}
```

### Storage
- `project-assets/u_{userId}/p_{projectId}/images/`

### Error Handling
- **Retry**: Rate limit → exponential backoff
- **Skip**: Content policy rejection → use placeholder, flag for review
- **Fail**: >50% images fail → fail job

---

## Step 5: TIMELINE (Composition Compiler)

### Purpose
Create the unified timeline.json that Remotion consumes.

### Inputs
- `script.json`
- `tts_result.json`
- `timestamps.json`
- `images_result.json`
- `project.template_id`

### Process
1. **Frame Calculation**
   - Convert all times to frames (fps from template)
   - Align beats to frame boundaries

2. **Segment Assembly**
   - Create segment for each beat
   - Assign image, duration, transition

3. **Caption Placement**
   - Position captions per template rules
   - Handle overflow/wrapping

4. **Audio Track Assembly**
   - Map merged audio path
   - Optional: add background music track

5. **Validation**
   - All frames covered
   - No gaps or overlaps
   - All assets exist

### Outputs
See **Timeline Contract v1** below.

### Storage
- `project-assets/u_{userId}/p_{projectId}/timeline.json`

---

## Step 6: REMOTION_RENDER

### Purpose
Render final video using Remotion.

### Inputs
- `timeline.json`
- All assets (audio, images)
- Template composition ID

### Process
1. **Asset Sync**
   - Download all assets to temp directory
   - Verify file integrity

2. **Render Execution**
   ```bash
   npx remotion render BlankLogoVideo \
     --props=timeline.json \
     --output=final.mp4 \
     --codec=h264 \
     --crf=18
   ```

3. **Quality Check**
   - Verify output duration matches expected
   - Check file size is reasonable
   - Generate preview thumbnail

### Outputs
- `final.mp4` (1080p H.264)
- `thumbnail.jpg` (preview frame)

### Storage
- `project-outputs/u_{userId}/p_{projectId}/final.mp4`
- `project-outputs/u_{userId}/p_{projectId}/thumbnail.jpg`

### Error Handling
- **Retry**: Memory/timeout → retry with lower concurrency
- **Fail**: Render crash → fail with logs

---

## Step 7: PACKAGING

### Purpose
Create downloadable asset pack and finalize job.

### Inputs
- All generated assets
- `final.mp4`

### Process
1. **Asset Collection**
   - Gather: script.json, captions.srt, timeline.json, images/, audio/

2. **ZIP Creation**
   - Create `assets.zip` with folder structure
   - Include README.txt with contents list

3. **Upload Outputs**
   - Upload final.mp4, captions.srt, assets.zip to `project-outputs`

4. **Finalize Job**
   - Update job status to READY
   - Calculate final credit cost
   - Call `finalize_job_credits` RPC

5. **Send Notification**
   - Trigger email via internal API
   - Include download links

### Outputs
```
project-outputs/u_{userId}/p_{projectId}/
├── final.mp4
├── captions.srt
├── thumbnail.jpg
├── timeline.json
└── assets.zip
```

---

## Retry Policy

| Step | Max Retries | Backoff | Fallback |
|------|-------------|---------|----------|
| SCRIPTING | 3 | Exponential 1s-30s | None |
| TTS | 3 | Exponential 2s-60s | OpenAI → Mock |
| ALIGNMENT | 3 | Exponential 1s-30s | Estimated timing |
| VISUALS | 2 per image | Linear 5s | Placeholder image |
| TIMELINE | 1 | - | None |
| RENDER | 2 | 30s | Lower quality |
| PACKAGING | 2 | 5s | None |

---

## Credit Calculation

```typescript
function calculateCredits(job: Job, timeline: Timeline): number {
  const durationMinutes = timeline.durationMs / 60000;
  const baseCredits = Math.ceil(durationMinutes);
  
  // Modifiers
  let modifier = 1.0;
  
  // Image quality
  if (job.imageQuality === 'hd') modifier += 0.3;
  if (job.imageQuality === 'high') modifier += 1.2;
  
  // Resolution
  if (job.resolution === '4k') modifier += 0.1;
  
  // Image density
  if (job.imageDensity === 'high') modifier += 0.2;
  if (job.imageDensity === 'ultra') modifier += 0.4;
  
  // Template premium
  modifier += job.template.creditMultiplier - 1.0;
  
  return Math.ceil(baseCredits * modifier);
}
```

---

## Job Events Logging

Every step logs events to `job_events` table:

```typescript
await logJobEvent(jobId, {
  eventType: 'step_started',
  stepName: 'tts',
  startedAt: new Date(),
  metadata: { sectionsCount: 8, provider: 'indextts' }
});

await logJobEvent(jobId, {
  eventType: 'step_completed',
  stepName: 'tts',
  completedAt: new Date(),
  durationMs: 45230,
  metadata: { totalDurationMs: 612450, audioFiles: 8 }
});
```

---

## Concurrency & Rate Limits

| Resource | Limit | Per |
|----------|-------|-----|
| OpenAI Images | 5 concurrent | Account |
| HuggingFace TTS | 1 concurrent | User |
| Remotion Render | 2 concurrent | Worker |
| Jobs per user | 3 active | User |

---

*Last updated: January 2, 2026*

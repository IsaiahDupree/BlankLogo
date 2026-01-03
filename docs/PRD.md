# CanvasCast PRD

> **One-liner**: CanvasCast turns your notes + niche into a 10-minute YouTube-ready video (narration, visuals, captions), delivered as a downloadable MP4 + asset pack.

## Product Overview

### Who It's For (MVP ICP)
- First-time YouTubers who are passionate but overwhelmed
- "Faceless channel" creators (explainer, facts, docu, motivation, finance, history, sci-fi)
- Busy founders/operators who want content without editing

### Core Promise
**"Pick a niche → paste notes → choose voice → generate 10-minute video."**

### MVP Deliverables
- `final.mp4` - The rendered video
- `captions.srt` (+ optional `.vtt`)
- `script.txt`
- `timeline.json`
- `assets.zip` (images + audio + metadata)

**No YouTube posting in MVP.**

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router) |
| Backend | Next.js API Routes / Server Actions |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Video Rendering | Remotion |
| TTS | Hugging Face (self-hosted) |
| Image Generation | OpenAI DALL-E |
| Email | Resend |
| Queue | Redis + BullMQ (or Supabase polling) |

---

## User Flows

### Flow A — Create Video (Default Voices)
1. User selects **Niche Preset**
2. User pastes notes/uploads doc
3. User selects **Voice** (default voices)
4. User sets **Length** (e.g., 8, 10, 12 min)
5. Click **Generate**
6. Watch status steps (Script → TTS → Images → Assemble → Ready)
7. Download outputs

### Flow B — Bring Your Voice (Gated)
1. User uploads 2–5 minutes of their own voice samples
2. User agrees to consent + ownership policy
3. System creates **Voice Profile** (approval + quality check)
4. Use voice in Flow A

---

## Monetization (Credits)

- **1 credit = 1 minute of final video output**
- Charge = `ceil(target_minutes)` (or actual duration once rendered)
- Default voices: standard rate
- "Bring your voice": premium rate (extra credits)
- HD export: premium rate (later)

### Pricing Tiers (MVP)
| Pack | Credits | Price |
|------|---------|-------|
| Starter | 30 min | $19 |
| Creator | 120 min | $49 |
| Pro | 300 min | $99 |

---

## Features

### Must-Have (MVP)
- [ ] Niche presets (prompt packs)
- [ ] Script generation with beat structure
- [ ] TTS narration (section-by-section)
- [ ] Visual generation (image per beat)
- [ ] Captions (forced align or approximate)
- [ ] Video assembly via Remotion
- [ ] Job queue + progress UI
- [ ] Download MP4 + zip
- [ ] Email notifications (Resend)

### Should-Have (MVP+)
- [ ] Hook variations (generate 3 hooks, user picks)
- [ ] BGM library (simple)
- [ ] "Safe mode" for compliance
- [ ] Template pacing controls (fast/normal/slow)

### Nice-to-Have (Post-MVP)
- [ ] YouTube upload + scheduling
- [ ] Team workspaces
- [ ] Brand kit (colors/fonts/logo intro/outro)
- [ ] Voice cloning marketplace

---

## Job Pipeline

### State Machine
```
QUEUED → SCRIPTING → TTS → ALIGNMENT → VISUALS → REMOTION_RENDER → PACKAGING → READY
                                                                          ↓
                                                                       FAILED
```

### Deterministic Artifact: `timeline.json`
Everything flows from one deterministic "render spec" JSON stored in Supabase Storage.

```typescript
{
  version: 1,
  title: string,
  fps: number,
  width: number,
  height: number,
  bgmPath?: string,
  bgmVolume: number,
  segments: [{
    id: string,
    startFrame: number,
    endFrame: number,
    narrationText: string,
    audioPath: string,
    captions: [{ startMs, endMs, text }],
    visuals: [{ path, motion, overlayText? }]
  }]
}
```

---

## Data Model

### Tables
- **projects** - User projects with niche, target minutes, status
- **jobs** - Job queue with pipeline states
- **assets** - References to Supabase Storage paths
- **credit_ledger** - Credit transactions (purchase, reserve, spend, refund)
- **user_notification_prefs** - Email notification preferences
- **email_log** - Email send history for debugging + compliance
- **voice_profiles** - (Gated) User voice profiles

### Credit System
Uses a ledger pattern, not a single balance column:
- `purchase` - User buys credits
- `reserve` - Credits held when job starts
- `release` - Credits returned if job fails
- `spend` - Final cost deducted on success
- `refund` - Admin refunds
- `admin_adjust` - Manual adjustments

---

## Email Notifications (Resend)

### Transactional
- Job started (optional)
- Job completed ✅ (default ON)
- Job failed ❌ (default ON)
- Credits low (< 10)
- Credits purchase confirmation

### Marketing (Opt-in Only)
- Promotions (credit bundles, template pack launches)
- Product updates (new niche packs, new templates)
- Creator tips/newsletter

---

## Success Criteria

- 80%+ of first jobs finish successfully
- Render output within ±10% of target length
- Captions cover ≥95% of spoken audio
- "Time to first video" feels reasonable
- Video plays end-to-end with audio synced and no black frames
- Download bundle contains all required files

---

## Safety & Compliance

### Voice
- Only allow "Bring your voice" when user uploads samples + affirms rights/consent
- Rate-limit voice profile creation
- Basic abuse detection
- Clear policy: no impersonation / public figure voices

### Content
- Add a "restricted content" filter pass on prompts
- Store prompt + outputs for audit (short-term)

---

## Build Plan

### Week 1: Core Pipeline
- [x] Database schema + RLS
- [ ] Niche presets + script generator
- [ ] Default voice TTS
- [ ] Images per section
- [ ] Remotion assembly
- [ ] Downloads zip

### Week 2: Product Polish
- [ ] Job status UI
- [ ] Captions (basic)
- [ ] Hook variations
- [ ] Credit charging + simple pricing

### Week 3: Moat
- [ ] Voice profiles (gated)
- [ ] Better alignment captions
- [ ] Template packs

---

## Local Development

### Supabase (Local)
```bash
supabase start
```

| Service | URL |
|---------|-----|
| API | http://127.0.0.1:54341 |
| Database | postgresql://postgres:postgres@127.0.0.1:54342/postgres |
| Studio | http://127.0.0.1:54343 |
| Mailpit | http://127.0.0.1:54344 |

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>

# Resend
RESEND_API_KEY=re_...
RESEND_FROM="CanvasCast <hello@yourdomain.com>"

# OpenAI
OPENAI_API_KEY=sk-...

# App
APP_BASE_URL=http://localhost:3000
INTERNAL_NOTIFY_SECRET=<generate-random-secret>
```

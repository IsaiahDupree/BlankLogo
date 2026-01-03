# BlankLogo Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js Web App (apps/web)                           │  │
│  │  - Dashboard, project creation, downloads             │  │
│  │  - API routes for job creation, status                │  │
│  │  - Supabase Auth integration                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase (shared DB + Storage)
                              │
┌─────────────────────────────────────────────────────────────┐
│                        Railway                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Worker Process (apps/worker)                         │  │
│  │  - Claims jobs from queue                             │  │
│  │  - Script generation (OpenAI GPT-4)                   │  │
│  │  - Voice synthesis (OpenAI TTS / IndexTTS)            │  │
│  │  - Whisper alignment                                  │  │
│  │  - Image generation (DALL-E 3)                        │  │
│  │  - Remotion video rendering                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- [Vercel account](https://vercel.com)
- [Railway account](https://railway.app)
- [Supabase project](https://supabase.com) (production)
- OpenAI API key
- (Optional) HuggingFace token for IndexTTS voice cloning

---

## 1. Supabase Production Setup

### Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to your users
3. Save the project URL and keys

### Run Migrations
```bash
# Link to your production project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push

# Create storage buckets
supabase storage create project-assets
supabase storage create project-outputs
```

### Environment Variables (save these)
- `SUPABASE_URL` - Project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)

---

## 2. Vercel Deployment (Web App)

### Connect Repository
1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your GitHub repository
3. Set **Root Directory** to `apps/web`
4. Framework Preset: **Next.js**

### Environment Variables
Add these in Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
RESEND_API_KEY=re_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
INTERNAL_NOTIFY_SECRET=your-random-secret-here
```

### Deploy
```bash
# Or just push to main branch
vercel --prod
```

---

## 3. Railway Deployment (Worker)

### Create Project
1. Go to [railway.app](https://railway.app) → New Project
2. Deploy from GitHub repo
3. Set **Root Directory** to `/` (monorepo root)
4. Railway will auto-detect the Dockerfile at `apps/worker/Dockerfile`

### Environment Variables
Add in Railway dashboard → Variables:

```
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# OpenAI
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4o-mini
OPENAI_TTS_VOICE=onyx

# Worker config
WORKER_ID=worker-prod-1
POLL_INTERVAL_MS=1000
MAX_ACTIVE_PER_USER=1

# TTS Provider
TTS_PROVIDER=openai

# Optional: HuggingFace for IndexTTS
HF_TOKEN=hf_xxxxx

# App URL for notifications
APP_BASE_URL=https://your-app.vercel.app
INTERNAL_NOTIFY_SECRET=your-random-secret-here

# Image generation
IMAGE_PROVIDER=openai
DALLE_SIZE=1024x1024
DALLE_QUALITY=standard

# Remotion
REMOTION_CONCURRENCY=2
NODE_ENV=production
```

### Deploy
Railway auto-deploys on push to main. Manual deploy:
```bash
railway up
```

### Scaling
- **Starter**: 1 replica, 512MB RAM (~$5/mo)
- **Pro**: 2 replicas, 2GB RAM each (~$20/mo)
- Adjust in Railway dashboard → Settings → Deploy

---

## 4. Domain Setup

### Vercel (Web App)
1. Settings → Domains → Add Domain
2. Add your domain (e.g., `app.blanklogo.com`)
3. Configure DNS as instructed

### Update Environment Variables
After setting domains, update:
- `APP_BASE_URL` in Railway worker
- OAuth redirect URLs in Supabase Auth

---

## 5. Monitoring

### Vercel
- Built-in analytics and logs
- Enable Web Analytics in project settings

### Railway
- View logs: Railway dashboard → Deployments → View Logs
- Set up alerts for crashes

### Supabase
- Database usage in dashboard
- Enable logging for debugging

---

## 6. Cost Estimates

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Railway | Starter | $5-20 |
| Supabase | Pro | $25 |
| OpenAI | Pay-as-you-go | $50-200 (usage) |
| **Total** | | **$100-265/mo** |

### Per-Video Costs (10-minute video)
- GPT-4 script: ~$0.10
- OpenAI TTS: ~$0.45
- Whisper: ~$0.06
- DALL-E 3 (10 images): ~$0.40
- **Total**: ~$1.00-1.50

---

## Troubleshooting

### Worker not processing jobs
1. Check Railway logs for errors
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
3. Ensure jobs are in `QUEUED` status in database

### Video rendering fails
1. Check Railway memory usage (may need more RAM)
2. Verify Chromium is installed (check Dockerfile)
3. Check Remotion logs for specific errors

### TTS fails
1. Verify `OPENAI_API_KEY` has TTS access
2. Check OpenAI usage limits
3. If using IndexTTS, verify `HF_TOKEN` and quota

---

## Local Development

```bash
# Terminal 1: Start Supabase
supabase start

# Terminal 2: Start web app
pnpm --filter @blanklogo/web dev

# Terminal 3: Start worker
pnpm --filter @blanklogo/worker dev
```

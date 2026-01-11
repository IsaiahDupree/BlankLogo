# BlankLogo Architecture

## Overview

BlankLogo is a watermark removal service using AI-powered inpainting. The system uses a multi-platform architecture optimized for cost, scalability, and reliability.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLANKLOGO ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                                                          │
│   │    User      │                                                          │
│   │   Browser    │                                                          │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │   Vercel     │────▶│  Supabase    │◀────│    Redis     │               │
│   │  (UI + API)  │     │  (Postgres)  │     │  (BullMQ)    │               │
│   └──────────────┘     └──────┬───────┘     └──────┬───────┘               │
│                               │                    │                        │
│                               │                    │                        │
│                               ▼                    ▼                        │
│                        ┌──────────────┐                                     │
│                        │   Render     │                                     │
│                        │  (Worker)    │                                     │
│                        └──────┬───────┘                                     │
│                               │                                             │
│                               │ HTTP POST (base64 video)                    │
│                               ▼                                             │
│                        ┌──────────────┐                                     │
│                        │  Modal GPU   │                                     │
│                        │  (A10G)      │                                     │
│                        │  YOLO + LAMA │                                     │
│                        └──────────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Vercel (Frontend + API Gateway)
- **Role**: UI hosting, lightweight API endpoints, authentication
- **Cost**: ~$20/month (Pro plan)
- **Scaling**: Auto-scales, serverless
- **Key Files**:
  - `apps/web/` - Next.js frontend
  - `/api/jobs` - Job creation endpoint

### 2. Supabase (Database + Storage)
- **Role**: Source of truth for job state, user data, file storage
- **Cost**: ~$25/month (Pro plan)
- **Features**:
  - PostgreSQL with Row Level Security (RLS)
  - Realtime subscriptions for job status
  - Object storage for videos (bl_videos bucket)
- **Key Tables**:
  - `bl_jobs` - Job records with status tracking
  - `bl_user_profiles` - User profiles and credits
  - `job_events` - Audit log of job lifecycle events

### 3. Redis (Job Queue)
- **Role**: BullMQ job queue for reliable job processing
- **Cost**: ~$7/month (Render Redis)
- **Features**:
  - Guaranteed delivery
  - Retry with exponential backoff
  - Dead letter queue for failed jobs
- **Queue Name**: `watermark-removal`

### 4. Render (Worker Orchestrator)
- **Role**: Always-on worker that orchestrates job processing
- **Cost**: ~$7/month (Starter instance)
- **Responsibilities**:
  - Dequeue jobs from Redis
  - Download input videos
  - Call Modal GPU for processing
  - Upload results to Supabase Storage
  - Update job status in database
- **Key Files**:
  - `apps/worker/src/index.ts` - Main worker process
  - `apps/worker/src/modal-client.ts` - Modal HTTP client

### 5. Modal (GPU Execution)
- **Role**: Serverless GPU for AI inference
- **Cost**: ~$1.67/hour (A10G GPU, pay-per-use)
- **Features**:
  - Scale to zero when idle
  - Cold start ~30-60 seconds
  - YOLO watermark detection + LAMA inpainting
- **Key Files**:
  - `apps/worker/python/modal_app.py` - Modal serverless app

## Data Flow

### Job Lifecycle

```
1. USER uploads video via Vercel UI
   │
   ▼
2. Vercel API creates job in Supabase (status: queued)
   │
   ▼
3. Job added to Redis queue (BullMQ)
   │
   ▼
4. Render worker dequeues job
   │
   ├─▶ Updates status: processing
   │
   ▼
5. Worker downloads input from Supabase Storage
   │
   ▼
6. Worker calls Modal GPU (/process-video-http)
   │
   ├─▶ Modal loads YOLO + LAMA models
   ├─▶ Detects watermarks
   ├─▶ Inpaints detected regions
   │
   ▼
7. Worker receives processed video from Modal
   │
   ▼
8. Worker uploads output to Supabase Storage
   │
   ▼
9. Worker updates job (status: completed, output_url)
   │
   ▼
10. User sees download button via Supabase Realtime
```

### Job Status States

```
queued ──▶ processing ──▶ completed
              │
              └──▶ failed (can retry)
              
queued ──▶ cancelled (terminal)
```

## API Endpoints

### Vercel API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | POST | Create new job |
| `/api/jobs/:id` | GET | Get job status |
| `/api/jobs/:id/cancel` | POST | Cancel job |
| `/api/health` | GET | Service health |

### Modal Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Modal service health |
| `/process-video-http` | POST | Process video (GPU) |

## Environment Variables

### Vercel
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
```

### Render Worker
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
REDIS_URL=redis://xxx
MODAL_TOKEN_ID=xxx
MODAL_TOKEN_SECRET=xxx
```

### Modal
```bash
# Tokens stored in ~/.modal.toml after `modal token new`
```

## Security

### Row Level Security (RLS)
- Users can only read/write their own jobs
- Service role bypasses RLS for worker operations

### API Authentication
- Supabase JWT for user requests
- Service key for internal worker operations
- Modal token for GPU endpoint authentication

### Secrets Management
- Never commit tokens to git
- Use environment variables on each platform
- Rotate tokens if exposed

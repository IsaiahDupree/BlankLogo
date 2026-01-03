# BlankLogo - AI Video Watermark Remover

Remove watermarks from AI-generated videos instantly. Supports Sora, TikTok, Runway, Pika, Kling, Luma, and more.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAILWAY                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Next.js   │    │   Express   │    │   Redis Queue       │  │
│  │  Frontend   │───▶│     API     │───▶│   (BullMQ)          │  │
│  │  (Web UI)   │    │             │    │                     │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                    │             │
│                           ┌────────────────────────▼──────────┐  │
│                           │        Worker Service             │  │
│                           │   (FFmpeg Processing)             │  │
│                           └────────────────────────┬──────────┘  │
└────────────────────────────────────────────────────┼─────────────┘
                                                     │
                              ┌──────────────────────▼──────────┐
                              │     Supabase / Cloudflare R2    │
                              │     (Database + Storage)        │
                              └─────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14, TailwindCSS, Lucide Icons |
| **API** | Express.js, BullMQ |
| **Worker** | Node.js + FFmpeg |
| **Queue** | Redis + BullMQ |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | Supabase Storage / Cloudflare R2 |

## Supported Platforms

| Platform | Default Crop | Position |
|----------|-------------|----------|
| Sora | 100px | bottom |
| TikTok | 80px | bottom |
| Runway | 60px | bottom |
| Pika | 50px | bottom |
| Kling | 70px | bottom |
| Luma | 55px | bottom |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- FFmpeg installed locally
- Supabase account
- Redis (local or Railway)

### Installation

```bash
# Clone the repo
git clone https://github.com/IsaiahDupree/BlankLogo.git
cd BlankLogo

# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env

# Start Supabase locally
pnpm db:start

# Run migrations
pnpm db:migrate

# Start development servers
pnpm dev          # Web frontend
pnpm dev:api      # API server
pnpm dev:worker   # Worker process
```

### Environment Variables

#### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8080
```

#### API (`apps/api/.env`)
```env
PORT=8080
REDIS_URL=redis://localhost:6379
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
```

#### Worker (`apps/worker/.env`)
```env
REDIS_URL=redis://localhost:6379
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key
WORKER_CONCURRENCY=2
```

## API Endpoints

### Create Job
```bash
POST /api/v1/jobs
Content-Type: application/json

{
  "video_url": "https://example.com/video.mp4",
  "platform": "sora",
  "crop_pixels": 100,
  "webhook_url": "https://your-app.com/webhook"
}
```

### Get Job Status
```bash
GET /api/v1/jobs/{job_id}
```

### Batch Processing
```bash
POST /api/v1/jobs/batch
Content-Type: application/json

{
  "videos": [
    {"video_url": "https://example.com/video1.mp4"},
    {"video_url": "https://example.com/video2.mp4"}
  ],
  "platform": "sora"
}
```

## Railway Deployment

### Services Required
1. **web** - Next.js frontend
2. **api** - Express API server
3. **worker** - FFmpeg processing worker
4. **redis** - Redis plugin for job queue
5. **postgres** - PostgreSQL plugin (or use Supabase)

### Deploy Commands
```bash
# Deploy all services
railway up

# Deploy specific service
railway up --service web
railway up --service api
railway up --service worker
```

## Project Structure

```
BlankLogo/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/app/      # App router pages
│   │   └── ...
│   ├── api/              # Express API server
│   │   ├── src/index.ts  # Main API file
│   │   └── ...
│   └── worker/           # FFmpeg worker
│       ├── src/index.ts  # Worker process
│       └── Dockerfile
├── packages/
│   └── shared/           # Shared types & utilities
├── supabase/
│   └── migrations/       # Database migrations
└── package.json
```

## Pricing (Suggested)

| Plan | Price | Videos/Month |
|------|-------|--------------|
| Free | $0 | 10 |
| Pro | $19/mo | 500 |
| Business | $49/mo | 2000 |
| Enterprise | Custom | Unlimited |

## License

MIT

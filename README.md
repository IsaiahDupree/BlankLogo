# BlankLogo - AI Video Watermark Remover

Remove watermarks from AI-generated videos instantly. **Upload your video and get a clean, watermark-free version in seconds.**

## 🎬 How It Works

1. **Upload** - Drag & drop your video (up to 500MB)
2. **Select Platform** - Choose Sora, TikTok, Runway, Pika, or custom crop
3. **Download** - Get your watermark-free video

> **Best Results**: Download your AI-generated video to your device, then upload it directly to BlankLogo. This ensures the highest quality output.

Supports Sora, TikTok, Runway, Pika, Kling, Luma, Instagram, Facebook, and more.

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

| Platform | Default Crop | Position | Notes |
|----------|-------------|----------|-------|
| Sora | 100px | bottom | OpenAI video model |
| TikTok | 80px | bottom | TikTok watermarks |
| Runway | 60px | bottom | Gen-2/Gen-3 |
| Pika | 50px | bottom | Pika Labs |
| Kling | 70px | bottom | Kling AI |
| Luma | 55px | bottom | Dream Machine |
| Instagram | auto | varies | Reels watermarks |
| Facebook | auto | varies | Meta video watermarks |
| Custom | adjustable | any | Set your own crop |

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

### Upload Video (Recommended)
```bash
POST /api/v1/jobs/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

# Form fields:
# - video: <file> (up to 500MB)
# - platform: "sora" | "tiktok" | "runway" | "pika" | "kling" | "luma" | "custom"
# - crop_pixels: 100 (optional, uses platform default)
```

### Create Job from URL
```bash
POST /api/v1/jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "video_url": "https://example.com/video.mp4",
  "platform": "sora",
  "crop_pixels": 100,
  "webhook_url": "https://your-app.com/webhook"
}
```

> **Note**: URL-based jobs may fail for some platforms due to download restrictions. For best results, use the upload endpoint.

### Get Job Status
```bash
GET /api/v1/jobs/{job_id}
```

### Diagnostics (Health Check)
```bash
GET /diagnostics  # Returns detailed service health status
GET /health       # Simple health check
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

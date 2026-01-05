# BlankLogo Deployment Guide

> **Last Updated:** January 4, 2026  
> **Deployment Architecture:** Hybrid (Vercel + Render)  
> **Status:** ✅ Production Ready

## 🎯 Production Deployment Summary

This is the **official production deployment configuration** for BlankLogo.

| Service | Platform | URL | Status |
|---------|----------|-----|--------|
| **Web App** | Vercel | https://www.blanklogo.app | ✅ Live |
| **API** | Render | https://blanklogo-api.onrender.com | ✅ Live |
| **Worker** | Render | Background Worker | ✅ Deployed |
| **Redis** | Render | Internal (Valkey 8) | ✅ Available |
| **Database** | Supabase | https://cwnayaqzslaukjlwkzlo.supabase.co | ✅ Connected |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Next.js 14 Web App (apps/web)                                        │  │
│  │  ─────────────────────────────────────────────────────────────────────│  │
│  │  • Homepage & Landing Pages                                           │  │
│  │  • User Authentication (Supabase Auth)                                │  │
│  │  • Dashboard & App Pages                                              │  │
│  │  • Stripe Payment Integration                                         │  │
│  │  • API Routes (/api/*)                                                │  │
│  │                                                                       │  │
│  │  Domains:                                                             │  │
│  │    - www.blanklogo.app                                                │  │
│  │    - blanklogo-web-git-main-isaiahduprees-projects.vercel.app         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS API Calls
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RENDER                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Express API Server (apps/api)                          [Web Service] │  │
│  │  ─────────────────────────────────────────────────────────────────────│  │
│  │  • RESTful API endpoints (/api/v1/*)                                  │  │
│  │  • Job queue management (BullMQ)                                      │  │
│  │  • Health checks (/health, /healthz, /readyz)                         │  │
│  │  • Platform detection & watermark removal API                         │  │
│  │                                                                       │  │
│  │  URL: https://blanklogo-api.onrender.com                              │  │
│  │  Port: 8989                                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    │ Redis Queue                             │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Redis (Valkey 8)                                     [Redis Service] │  │
│  │  ─────────────────────────────────────────────────────────────────────│  │
│  │  • Job queue (BullMQ watermark-removal queue)                         │  │
│  │  • Session caching                                                    │  │
│  │                                                                       │  │
│  │  Internal URL: redis://red-d5ddu9khg0os73f75170:6379                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│                                    │ Job Processing                          │
│                                    ▼                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Background Worker (apps/worker)                 [Background Worker]  │  │
│  │  ─────────────────────────────────────────────────────────────────────│  │
│  │  • Processes watermark removal jobs                                   │  │
│  │  • Video download (curl, yt-dlp, Puppeteer)                           │  │
│  │  • FFmpeg video processing                                            │  │
│  │  • AI inpainting (YOLO + LAMA)                                        │  │
│  │  • Upload to Supabase Storage                                         │  │
│  │  • User notifications (Resend)                                        │  │
│  │                                                                       │  │
│  │  Type: Background Worker (no HTTP port)                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Database & Storage
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SUPABASE                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                                  │  │
│  │  • Users, jobs, projects, credits tables                              │  │
│  │  • Row Level Security (RLS)                                           │  │
│  │                                                                       │  │
│  │  Object Storage                                                       │  │
│  │  • bl_videos bucket for processed videos                              │  │
│  │                                                                       │  │
│  │  Authentication                                                       │  │
│  │  • Email/password auth                                                │  │
│  │  • OAuth providers (optional)                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
BlankLogo/
├── apps/
│   ├── api/                 # Express API server (Render)
│   │   ├── src/
│   │   │   ├── index.ts     # Main server entry
│   │   │   ├── routes/      # API routes
│   │   │   └── middleware/  # Auth, rate limiting
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                 # Next.js web app (Vercel)
│   │   ├── src/
│   │   │   ├── app/         # App Router pages
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities
│   │   ├── package.json
│   │   ├── vercel.json      # Vercel config
│   │   └── next.config.mjs
│   │
│   └── worker/              # Background worker (Render)
│       ├── src/
│       │   ├── index.ts     # Worker entry
│       │   ├── download.ts  # Video download
│       │   └── userNotify.ts # Notifications
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/              # Shared types & utilities
│
├── scripts/
│   ├── check-render-status.sh    # Check Render deployments
│   └── test-production.sh        # Production test suite
│
├── tests/                   # Test suites
│   ├── api/                 # API tests
│   ├── unit/                # Unit tests
│   ├── worker/              # Worker tests
│   ├── integration/         # Integration tests
│   └── security/            # Security tests
│
├── docs/
│   └── DEPLOYMENT.md        # This file
│
├── render.yaml              # Render Blueprint
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # pnpm workspace config
└── pnpm-lock.yaml           # Lock file
```

---

## 🚀 Deployment Configuration

### Render Blueprint (`render.yaml`)

The `render.yaml` file defines all Render services:

```yaml
services:
  # Redis Database
  - type: redis
    name: blanklogo-redis
    plan: free
    maxmemoryPolicy: allkeys-lru

  # API Server (Web Service)
  - type: web
    name: blanklogo-api
    runtime: node
    plan: free
    region: oregon
    buildCommand: "npm install -g pnpm && NODE_ENV=development pnpm install && pnpm --filter @blanklogo/api build"
    startCommand: "NODE_ENV=production node apps/api/dist/index.js"
    healthCheckPath: /health

  # Background Worker
  - type: worker
    name: blanklogo-worker
    runtime: node
    plan: free
    region: oregon
    buildCommand: "npm install -g pnpm && NODE_ENV=development pnpm install && pnpm --filter @blanklogo/worker build"
    startCommand: "NODE_ENV=production node apps/worker/dist/index.js"
```

### Vercel Configuration (`apps/web/vercel.json`)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

---

## 🔑 Environment Variables

### Render Environment Group: `blanklogo-secrets`

Create an environment group in Render with these variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `RESEND_API_KEY` | Resend email API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

Link this group to both `blanklogo-api` and `blanklogo-worker` services.

### Vercel Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_API_URL` | Render API URL (`https://blanklogo-api.onrender.com`) |
| `RESEND_API_KEY` | Resend email API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

---

## 🧪 Testing

### Run Production Tests

```bash
# Full production test suite
./scripts/test-production.sh

# Local unit tests
pnpm test

# Specific test categories
pnpm test tests/unit/
pnpm test tests/api/
pnpm test tests/worker/
pnpm test tests/integration/
```

### Manual Health Checks

```bash
# API Health
curl https://blanklogo-api.onrender.com/health

# API Capabilities
curl https://blanklogo-api.onrender.com/capabilities

# API Platforms
curl https://blanklogo-api.onrender.com/api/v1/platforms

# Vercel Web
curl -I https://www.blanklogo.app
```

---

## 📊 Monitoring

### Render Dashboard
- https://dashboard.render.com
- View logs, deployments, metrics

### Vercel Dashboard
- https://vercel.com/dashboard
- View deployments, analytics, logs

### Check Deployment Status

```bash
./scripts/check-render-status.sh
```

---

## 🔧 Common Operations

### Deploy Updates

```bash
# Push to main branch triggers auto-deploy
git push origin main

# Check deployment status
./scripts/check-render-status.sh
```

### Rollback

**Render:**
1. Go to Service → Deployments
2. Click on previous successful deployment
3. Click "Rollback to this deploy"

**Vercel:**
1. Go to Deployments
2. Find previous deployment
3. Click "..." → Promote to Production

### View Logs

```bash
# Render logs (requires render CLI)
render logs -r srv-xxx

# Or use dashboard:
# https://dashboard.render.com/web/srv-xxx/logs
```

---

## 💰 Cost Estimates

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Vercel Web | Pro | ~$20 |
| Render API | Free | $0 |
| Render Worker | Free | $0 |
| Render Redis | Free | $0 |
| Supabase | Free/Pro | $0-25 |
| Stripe | Pay-as-you-go | 2.9% + 30¢ |
| Resend | Free tier | $0 |
| **Total** | | **$20-45/mo** |

---

## 🆘 Troubleshooting

### Worker not processing jobs
1. Check Worker logs in Render dashboard
2. Verify Redis connection: API `/health` should show `redis: connected`
3. Verify environment variables are set

### API returning errors
1. Check API logs in Render dashboard
2. Verify Supabase connection
3. Check rate limiting

### Vercel build fails
1. Check build logs in Vercel dashboard
2. Verify environment variables
3. Check for TypeScript errors

### Redis connection issues
1. Verify `REDIS_URL` is set correctly (from Render Redis)
2. Check Redis service is running in Render dashboard

---

## 📚 Additional Documentation

- [API Documentation](./API.md)
- [Worker Pipeline](./WORKER.md)
- [Database Schema](./DATABASE.md)
- [Testing Guide](./TESTING.md)

---

## ✅ Deployment Checklist

- [ ] All environment variables configured in Render
- [ ] All environment variables configured in Vercel
- [ ] Supabase redirect URLs configured
- [ ] Stripe webhook endpoint configured
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificates active
- [ ] Production tests passing (`./scripts/test-production.sh`)
- [ ] Monitoring alerts configured

# Railway Deployment Guide

## Overview

BlankLogo consists of 3 services that need to be deployed:
- **API** - Express.js backend (port 8080)
- **Worker** - BullMQ job processor with FFmpeg
- **Web** - Next.js frontend (port 3838)

## Prerequisites

1. Railway account at [railway.app](https://railway.app)
2. Supabase project (for database)
3. Redis instance (Railway provides this)
4. Resend API key (for email notifications)

## Quick Start

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Add Services

Create 3 services in Railway:
- `api` - Links to `apps/api/Dockerfile`
- `worker` - Links to `apps/worker/Dockerfile`  
- `web` - Links to `apps/web/Dockerfile`

### 3. Add Redis

```bash
railway add --name redis
# Select "Redis" from the list
```

### 4. Configure Environment Variables

#### API Service
```env
NODE_ENV=production
PORT=8080
REDIS_URL=${{Redis.REDIS_URL}}
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
CORS_ORIGINS=https://your-domain.com
```

#### Worker Service
```env
NODE_ENV=production
WORKER_ID=railway-worker
WORKER_CONCURRENCY=2
REDIS_URL=${{Redis.REDIS_URL}}
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=BlankLogo <noreply@yourdomain.com>
INPAINT_SERVICE_URL=http://your-python-service:8081
```

#### Web Service
```env
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

## Environment Variables Reference

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | API, Worker | ✅ | Redis connection string |
| `SUPABASE_URL` | All | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | API, Worker | ✅ | Service role key |
| `SUPABASE_ANON_KEY` | Web | ✅ | Anonymous key for frontend |
| `RESEND_API_KEY` | Worker | ⚠️ | For email notifications |
| `CORS_ORIGINS` | API | ⚠️ | Allowed CORS origins |
| `INPAINT_SERVICE_URL` | Worker | ⚠️ | Python inpainting service |

## Health Checks

Each service has built-in health checks:

- **API**: `GET /health` - Returns service status
- **Worker**: Process health check via node
- **Web**: Next.js built-in health

## Deployment Commands

### Manual Deploy
```bash
# Deploy all services
railway up

# Deploy specific service
railway up -s api
railway up -s worker
railway up -s web
```

### Via GitHub Actions
Push to `main` branch triggers automatic deployment.

## Post-Deployment Verification

### Run Smoke Tests
```bash
DEPLOY_API_URL=https://api.your-domain.com \
DEPLOY_WEB_URL=https://your-domain.com \
pnpm test:deployment:smoke
```

### Run Full Health Checks
```bash
DEPLOY_API_URL=https://api.your-domain.com \
DEPLOY_WEB_URL=https://your-domain.com \
pnpm test:deployment:health
```

## Monitoring

### Logs
```bash
railway logs -s api
railway logs -s worker
railway logs -s web
```

### Metrics
Railway provides built-in metrics for:
- CPU usage
- Memory usage
- Network I/O
- Request count

## Rollback

```bash
# View deployments
railway deployments

# Rollback to previous
railway rollback -s api
```

## Troubleshooting

### API not responding
1. Check Redis connection: `railway logs -s api | grep Redis`
2. Verify CORS settings
3. Check Supabase credentials

### Worker not processing jobs
1. Verify Redis connection
2. Check queue status in logs
3. Ensure Python service is running (if using inpainting)

### Web build failing
1. Check environment variables are set
2. Verify Next.js standalone output mode

## GitHub Secrets Required

For CI/CD, add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway API token |
| `RAILWAY_PROJECT_ID` | Project ID from Railway |
| `PRODUCTION_API_URL` | Deployed API URL |
| `PRODUCTION_WEB_URL` | Deployed web URL |
| `RESEND_API_KEY` | For deployment notifications |
| `DEV_NOTIFICATION_EMAIL` | Email for notifications |

## Cost Estimation

Railway pricing (as of 2024):
- Hobby: $5/month per service
- Pro: Usage-based (~$0.000463/vCPU-minute)

Estimated monthly cost for BlankLogo:
- 3 services: ~$15-30/month (Hobby)
- Redis: Included in Railway
- Usage-based: Varies by traffic

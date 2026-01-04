# CORS Configuration Audit

## Overview

This document audits all CORS configurations across BlankLogo services.

## Services & Endpoints

### 1. API Service (`apps/api`)
**Port:** 8989

**CORS Configuration:** `apps/api/src/index.ts:327-330`
```typescript
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3939', 'http://localhost:3838', 'http://127.0.0.1:3939'],
  credentials: true,
}));
```

**Environment:** `apps/api/.env`
```
CORS_ORIGINS=http://localhost:3939,http://localhost:3838,http://localhost:3000
```

**Endpoints:**
| Endpoint | Method | Auth Required |
|----------|--------|---------------|
| `/health` | GET | No |
| `/healthz` | GET | No |
| `/readyz` | GET | No |
| `/status` | GET | No |
| `/capabilities` | GET | No |
| `/api/v1/jobs` | POST | Yes |
| `/api/v1/jobs/:jobId` | GET | Yes |
| `/api/v1/jobs/:jobId/download` | GET | Yes |
| `/api/v1/jobs/upload` | POST | Yes |
| `/api/v1/jobs/batch` | POST | Yes |
| `/api/v1/jobs/:jobId` | DELETE | Yes |

**Status:** ✅ Configured

---

### 2. Web Service (`apps/web`)
**Port:** 3939

**CORS Configuration:** `apps/web/vercel.json:13-23`
```json
"headers": [
  {
    "source": "/api/(.*)",
    "headers": [
      { "key": "Access-Control-Allow-Credentials", "value": "true" },
      { "key": "Access-Control-Allow-Origin", "value": "*" },
      { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
      { "key": "Access-Control-Allow-Headers", "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
    ]
  }
]
```

**Next.js API Routes (29 total):**

| Category | Endpoints |
|----------|-----------|
| Auth | `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/change-password`, `/api/auth/change-email`, `/api/auth/delete-account`, `/api/auth/me`, `/api/auth/sessions`, `/api/auth/reauth`, `/api/auth/verify-email` |
| Jobs | `/api/jobs`, `/api/jobs/[jobId]`, `/api/jobs/batch` |
| Projects | `/api/projects`, `/api/projects/[id]`, `/api/projects/[id]/generate`, `/api/projects/[id]/downloads`, `/api/projects/[id]/events`, `/api/projects/[id]/inputs`, `/api/projects/[id]/inputs/[inputId]`, `/api/projects/[id]/inputs/upload-url` |
| Stripe | `/api/stripe/checkout`, `/api/stripe/portal`, `/api/stripe/webhook` |
| Other | `/api/voice-profiles`, `/api/emails/welcome`, `/api/internal/job-status-email` |

**Status:** ✅ Configured (via vercel.json for production)

⚠️ **Note:** Local development relies on same-origin requests. For cross-origin local testing, may need Next.js middleware CORS.

---

### 3. Worker Service (`apps/worker`)
**Port:** None (no HTTP server)

**CORS Configuration:** N/A - Worker uses Redis queue, no HTTP endpoints.

**Status:** ✅ Not needed

---

## Required Origins by Environment

### Local Development
| Origin | Purpose |
|--------|---------|
| `http://localhost:3939` | Web frontend |
| `http://localhost:3838` | Legacy/alternate port |
| `http://localhost:3000` | Common dev port |
| `http://127.0.0.1:3939` | Localhost IP variant |
| `http://127.0.0.1:54351` | Supabase local |

### Production
| Origin | Purpose |
|--------|---------|
| `https://blanklogo.com` | Production domain |
| `https://www.blanklogo.com` | WWW variant |
| `https://app.blanklogo.com` | App subdomain (if used) |

---

## Issues Found

### ❌ Issue 1: API CORS_ORIGINS was missing localhost:3939
**Fixed:** Added `http://localhost:3939` to `apps/api/.env`

### ⚠️ Issue 2: Web API routes need local CORS for development
Next.js API routes work same-origin but may need explicit CORS headers for:
- Browser devtools testing
- External tool testing (Postman, etc.)

**Recommendation:** Add CORS middleware to Next.js API routes for development.

---

## Recommendations

### 1. Centralize CORS Configuration
Create a shared CORS config:
```typescript
// packages/shared/src/cors.ts
export const ALLOWED_ORIGINS = {
  development: [
    'http://localhost:3939',
    'http://localhost:3838',
    'http://localhost:3000',
    'http://127.0.0.1:3939',
  ],
  production: [
    'https://blanklogo.com',
    'https://www.blanklogo.com',
  ],
};
```

### 2. Add CORS to Next.js API Routes
For development flexibility, add a shared CORS helper:
```typescript
// lib/cors.ts
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
```

### 3. Environment-Specific Origins
Update API to support environment-specific origins:
```typescript
const CORS_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://blanklogo.com']
  : ['http://localhost:3939', 'http://localhost:3838'];
```

---

## Quick Fix Checklist

- [x] `apps/api/.env` - Add `http://localhost:3939` to CORS_ORIGINS
- [ ] Restart API server after .env change
- [ ] Test cross-origin request from web to API
- [ ] Verify production vercel.json CORS headers

---

## Testing CORS

### Test API CORS
```bash
# Should return CORS headers
curl -I -X OPTIONS http://localhost:8989/api/v1/jobs \
  -H "Origin: http://localhost:3939" \
  -H "Access-Control-Request-Method: POST"
```

### Test Web API CORS
```bash
# Should work from same origin
curl http://localhost:3939/api/auth/me
```

---

*Last Updated: January 3, 2026*

# BlankLogo Deployment Testing Guide

## Overview

This document describes the standard deployment verification workflow for BlankLogo. After every deployment, run the golden path tests to verify core app functionality.

## Quick Start

### Run After Every Deployment:

```bash
./scripts/deploy-and-test.sh
```

Or manually:

```bash
# Golden Path Upload Tests (THE MAIN TEST)
TEST_USER_EMAIL=isaiahdupree33@gmail.com \
TEST_USER_PASSWORD=Frogger12 \
npx playwright test tests/deployment/golden-path-upload.spec.ts --project=deployment --timeout=60000
```

---

## Test Suite Overview

### Golden Path Upload Tests (`tests/deployment/golden-path-upload.spec.ts`)

**This is the primary deployment verification test.** It tests the complete user journey:

| Test | What it verifies |
|------|------------------|
| 1. Remove page loads with Upload File as default | Page renders, no "Failed to fetch" errors |
| 2. Can select and preview video file | File upload works, file recognized |
| 3. Can select platform | Platform buttons work |
| 4. Submit job and see processing | Job submission works, processing starts |
| 5. Full job lifecycle | Job completes or fails properly (no silent failures) |
| API health check | Render API is healthy |
| Inpaint service health | Render Inpaint service is healthy |
| Queue status | BullMQ queue is accessible |

### What This Test Catches:

- ✅ "Failed to fetch" errors (the original bug)
- ✅ Meta Pixel "fbq is not defined" errors
- ✅ Auth/session issues
- ✅ File upload failures
- ✅ API connectivity issues
- ✅ Job submission failures
- ✅ Service health issues (API, Inpaint, Queue)

---

## Services Tested

| Service | URL | Health Endpoint |
|---------|-----|-----------------|
| Web App (Vercel) | https://www.blanklogo.app | / |
| API (Render) | https://blanklogo-api.onrender.com | /health |
| Inpaint (Render) | https://blanklogo-inpaint.onrender.com | /health |
| Worker (Render) | Background process | Via /status queue stats |

---

## Running Tests

### Full Deploy & Test Pipeline

```bash
./scripts/deploy-and-test.sh
```

This runs:
1. Health checks on all services
2. Waits 10s for deployment to stabilize
3. Runs golden path upload tests
4. Reports pass/fail

### Just Golden Path Tests

```bash
SKIP_HEALTH_CHECK=1 \
BASE_URL=https://www.blanklogo.app \
DEPLOY_WEB_URL=https://www.blanklogo.app \
TEST_USER_EMAIL=isaiahdupree33@gmail.com \
TEST_USER_PASSWORD=Frogger12 \
npx playwright test tests/deployment/golden-path-upload.spec.ts \
    --project=deployment \
    --timeout=60000 \
    --reporter=list
```

### With Verbose Output

```bash
npx playwright test tests/deployment/golden-path-upload.spec.ts \
    --project=deployment \
    --timeout=60000 \
    --reporter=list 2>&1 | grep -E "✓|✗|passed|failed|\[Golden|\[API|\[Queue|\[Inpaint"
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_USER_EMAIL` | isaiahdupree33@gmail.com | Test account email |
| `TEST_USER_PASSWORD` | Frogger12 | Test account password |
| `BASE_URL` | https://www.blanklogo.app | Web app URL |
| `DEPLOY_WEB_URL` | https://www.blanklogo.app | Same as BASE_URL |
| `DEPLOY_API_URL` | https://blanklogo-api.onrender.com | API URL |
| `SKIP_HEALTH_CHECK` | - | Skip Playwright's built-in health check |

---

## Test Video

The tests use `test-videos/sora-watermark-test.mp4` (7.89 MB).

Available test videos:
- `sora-watermark-test.mp4` - Main test video (Sora watermark)
- `tiktok_watermarked.mp4` - TikTok watermark
- `runway_watermarked.mp4` - Runway watermark
- `pika_watermarked.mp4` - Pika watermark

---

## Expected Output

### All Tests Passing:

```
[API] Health: { status: 'healthy', ... }
[Inpaint] Health: { status: 'healthy', service: 'blanklogo-inpainter' }
[Queue] Stats: { waiting: 0, active: 0, completed: 4, failed: 11 }
[Golden Path] ✓ Upload page loaded with file upload as default
[Golden Path] Test video: sora-watermark-test.mp4 (7.89 MB)
[Golden Path] ✓ Video file selected and showing
[Golden Path] ✓ Platform selection works
[Golden Path] Uploading video...
[Golden Path] Submitting job...
[Golden Path] ✓ Processing indicator found
[Golden Path] ✓ Job submitted and processing started
[Golden Path] Job submitted, waiting for completion...

8 passed (42.5s)
```

---

## Troubleshooting

### "Failed to fetch" error

1. Check `NEXT_PUBLIC_API_URL` is set in Vercel
2. Check API is healthy: `curl https://blanklogo-api.onrender.com/health`
3. Check CORS headers are correct

### Tests timeout

1. Increase timeout: `--timeout=120000`
2. Check if Render services are cold-starting
3. Check queue depth: `curl https://blanklogo-api.onrender.com/status`

### Job stuck in processing

1. Check worker is running (background service on Render)
2. Check queue stats for failed jobs
3. Check user has credits

---

## CI/CD Integration

Add to your deployment pipeline:

```yaml
# After deployment step
- name: Verify Deployment
  run: ./scripts/deploy-and-test.sh
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

---

## Related Scripts

- `scripts/deploy-and-test.sh` - Full deployment verification
- `scripts/test-deployment.sh` - Endpoint health checks only
- `scripts/check-deployment.sh` - Detailed health checks
- `scripts/test-authenticated-flows.sh` - Auth flow tests

---

## Test Files

- `tests/deployment/golden-path-upload.spec.ts` - **Main test (run this)**
- `tests/deployment/golden-path-full.spec.ts` - Extended tests
- `tests/deployment/golden-path.spec.ts` - Basic golden path
- `tests/deployment/user-flows.spec.ts` - User flow tests
- `tests/deployment/health-checks.spec.ts` - Health check tests
- `tests/deployment/smoke-tests.spec.ts` - Smoke tests

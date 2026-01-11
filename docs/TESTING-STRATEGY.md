# BlankLogo Testing Strategy

## Test Pyramid

```
                    ┌─────────────┐
                    │   E2E       │  Tier C/D - Staging/Nightly
                    │   Tests     │  (few, slow, high confidence)
                    ├─────────────┤
                    │ Integration │  Tier B - Every merge
                    │   Tests     │  (some, medium speed)
                    ├─────────────┤
                    │    Unit     │  Tier A - Every PR
                    │   Tests     │  (many, fast, low confidence)
                    └─────────────┘
```

## Test Tiers

### Tier A - Fast CI (Every PR)
**Runtime**: <2 minutes

| Test Type | Location | What It Tests |
|-----------|----------|---------------|
| Unit tests | `tests/pipeline/worker-unit.test.ts` | State machine, retry logic, backoff |
| Contract tests | `tests/pipeline/modal-contract.test.ts` | HTTP contracts, request/response shapes |
| DB/RLS tests | `tests/db/rls.test.ts` | Row level security policies |
| Queue tests | `tests/pipeline/failure-modes.test.ts` | Idempotency, retry behavior |

Run:
```bash
npx vitest run tests/pipeline tests/db
```

### Tier B - Integration (Every Merge to Main)
**Runtime**: 5-10 minutes

| Test Type | Location | What It Tests |
|-----------|----------|---------------|
| Worker integration | `tests/pipeline/` | Job state transitions, event writing |
| API integration | `tests/api/` | Endpoint behavior with real DB |
| Storage integration | `tests/e2e/` | Upload/download flows |

Run:
```bash
npx vitest run tests/
```

### Tier C - Staging E2E (On Deploy)
**Runtime**: 2-5 minutes

| Test Type | Location | What It Tests |
|-----------|----------|---------------|
| Golden path | `tests/deployment/golden-path-upload.spec.ts` | Full pipeline with real services |
| Health checks | `tests/deployment/health-checks.spec.ts` | All services responding |

Run:
```bash
SKIP_HEALTH_CHECK=1 \
BASE_URL=https://www.blanklogo.app \
TEST_USER_EMAIL=xxx \
TEST_USER_PASSWORD=xxx \
npx playwright test tests/deployment/golden-path-upload.spec.ts
```

### Tier D - Nightly/Weekly
**Runtime**: 30-60 minutes

| Test Type | What It Tests |
|-----------|---------------|
| Load tests | Burst capacity, sustained throughput |
| Chaos tests | Worker crash recovery, Redis outage |
| Cost regression | GPU minutes/job, retries/job |

## Test Files

### Pipeline Tests (`tests/pipeline/`)

#### `modal-contract.test.ts`
Tests Modal HTTP contract:
- Health endpoint returns correct shape
- Process endpoint accepts correct request
- Error responses are properly formatted

```typescript
describe('Modal Contract Tests', () => {
  it('should return correct health response shape', async () => {
    const response = await fetch(MODAL_HEALTH_URL);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('blanklogo-watermark-removal');
  });
});
```

#### `worker-unit.test.ts`
Tests worker logic without external dependencies:
- State machine transitions
- Error classification (retryable vs non-retryable)
- Backoff calculation
- Job payload validation
- Idempotency key generation

```typescript
describe('Worker State Machine', () => {
  it('queued → processing is valid', () => {
    expect(isValidTransition('queued', 'processing')).toBe(true);
  });
  
  it('completed → anything is invalid (terminal)', () => {
    expect(isValidTransition('completed', 'queued')).toBe(false);
  });
});
```

#### `failure-modes.test.ts`
Tests error handling:
- Input validation failures (non-retryable)
- Provider failures (retryable)
- Storage failures
- Retry logic with max attempts
- Idempotency (duplicate handling)
- Worker crash recovery

```typescript
describe('Error Classification', () => {
  it('INVALID_INPUT should not retry', () => {
    expect(classifyError({ code: 'INVALID_INPUT' })).toBe('fail');
  });
  
  it('503 (service unavailable) should retry', () => {
    expect(classifyError({ status: 503 })).toBe('retry');
  });
});
```

#### `golden-path.test.ts`
Full E2E pipeline test:
1. Create job via API
2. Verify DB row with 'queued' status
3. Wait for completion (poll)
4. Verify status transitions
5. Verify output accessible

```typescript
it('should complete full pipeline for small video', async () => {
  // Create job
  const { jobId } = await createJob(testVideo);
  
  // Wait for completion
  await waitForStatus(jobId, 'completed', { timeout: 120000 });
  
  // Verify output
  const job = await getJob(jobId);
  expect(job.output_url).toBeTruthy();
});
```

## Test Matrix

### A) Vercel API Tests

| Scenario | Expected Result | Test File |
|----------|----------------|-----------|
| Valid payload | Job created, returns jobId | `tests/api/` |
| Invalid payload | 400 error, validation message | `tests/api/` |
| DB write fails | 500 error, no job in queue | `tests/api/` |
| Queue fails | DB row reverted or marked failed | `tests/api/` |

### B) Database Tests

| Scenario | Expected Result | Test File |
|----------|----------------|-----------|
| Migrations apply | All tables/indexes created | `tests/db/` |
| RLS: user reads own jobs | Success | `tests/db/rls.test.ts` |
| RLS: user reads other's jobs | Empty result | `tests/db/rls.test.ts` |
| Service role bypasses RLS | Success | `tests/db/rls.test.ts` |

### C) Queue Tests

| Scenario | Expected Result | Test File |
|----------|----------------|-----------|
| Valid job payload | Job enqueued | `tests/pipeline/` |
| Duplicate job ID | Idempotent (no double process) | `tests/pipeline/failure-modes.test.ts` |
| Retry on failure | Exponential backoff | `tests/pipeline/worker-unit.test.ts` |
| Max retries exceeded | Dead letter queue | `tests/pipeline/failure-modes.test.ts` |

### D) Worker Tests

| Scenario | Expected Result | Test File |
|----------|----------------|-----------|
| Valid state transitions | queued→processing→completed | `tests/pipeline/worker-unit.test.ts` |
| Invalid state transitions | Rejected | `tests/pipeline/worker-unit.test.ts` |
| Modal 500 error | Retry up to 3 times | `tests/pipeline/failure-modes.test.ts` |
| Modal timeout | Retry with backoff | `tests/pipeline/failure-modes.test.ts` |
| Invalid input | Fail immediately (no retry) | `tests/pipeline/failure-modes.test.ts` |
| Worker crash mid-job | Lease expires, job retried | `tests/pipeline/failure-modes.test.ts` |

### E) Modal Tests

| Scenario | Expected Result | Test File |
|----------|----------------|-----------|
| Health check | Returns status: ok | `tests/pipeline/modal-contract.test.ts` |
| Valid video | Processed video returned | `tests/pipeline/modal-contract.test.ts` |
| Invalid mode | Error response | `tests/pipeline/modal-contract.test.ts` |
| Empty video | Error response | `tests/pipeline/modal-contract.test.ts` |

## Running Tests

### All Pipeline Tests
```bash
npx vitest run tests/pipeline
```

### With Coverage
```bash
npx vitest run tests/pipeline --coverage
```

### Watch Mode (Development)
```bash
npx vitest tests/pipeline
```

### Specific Test File
```bash
npx vitest run tests/pipeline/worker-unit.test.ts
```

### Golden Path E2E (Requires Credentials)
```bash
SUPABASE_SERVICE_KEY=xxx \
TEST_USER_ID=xxx \
npx vitest run tests/pipeline/golden-path.test.ts
```

### Deployment Tests (Playwright)
```bash
npx playwright test tests/deployment/golden-path-upload.spec.ts \
  --project=deployment \
  --timeout=120000
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run tests/pipeline tests/db
      
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run tests/
      
  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install
      - run: npx playwright test tests/deployment/
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## Test Data Strategy

### Test Users
- Format: `e2e+<runid>@domain.com`
- Created fresh for each E2E run
- Cleanup: Scheduled job deletes data older than 7 days

### Test Videos
- Location: `test-videos/`
- `sora-watermark-test.mp4` - 7.89 MB, has Sora watermark
- Keep fixtures small (<10MB) for fast tests

### Cleanup
```sql
-- Delete old test jobs
DELETE FROM bl_jobs 
WHERE user_id IN (
  SELECT id FROM bl_user_profiles 
  WHERE email LIKE 'e2e+%'
)
AND created_at < NOW() - INTERVAL '7 days';
```

## Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Test pass rate | 100% | <95% |
| Unit test duration | <30s | >60s |
| E2E test duration | <3min | >5min |
| Flaky test rate | 0% | >5% |
| Coverage | >80% | <70% |

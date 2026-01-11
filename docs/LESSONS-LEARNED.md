# Lessons Learned: BlankLogo GPU Integration

## Executive Summary

This document captures key learnings from integrating serverless GPU processing into BlankLogo's watermark removal pipeline. The project involved evaluating multiple GPU providers and ultimately choosing Modal for its reliability and developer experience.

## Timeline

| Date | Milestone |
|------|-----------|
| Day 1 | Attempted RunPod serverless integration |
| Day 1 | Discovered RunPod queue starvation issues |
| Day 1 | Pivoted to Modal platform |
| Day 1 | Deployed Modal app with A10G GPU |
| Day 1 | Integrated Modal into Render worker |
| Day 1 | Full pipeline E2E test passing |

## GPU Provider Evaluation

### RunPod (Not Recommended)

**What We Tried**:
- Built Docker image with PyTorch, YOLO, LAMA
- Deployed to RunPod serverless endpoint
- Attempted to process jobs via REST API

**Problems Encountered**:

1. **Queue Starvation**
   - Jobs stuck in "IN_QUEUE" status indefinitely
   - No workers initializing despite capacity
   - Support suggested "wait for GPU availability"

2. **Slow Cold Start**
   - Docker image ~15GB with PyTorch + models
   - Pull time: 5-10 minutes on cold start
   - Dedicated pods also slow to initialize

3. **Debugging Difficulty**
   - Limited visibility into worker state
   - Logs not available until worker starts
   - No clear error messages for queue issues

**Conclusion**: RunPod serverless is not reliable for production workloads requiring consistent availability.

### Modal (Recommended) ✓

**What Worked**:

1. **Fast Cold Start**
   - Image builds happen during deploy, not runtime
   - Cold start: 30-60 seconds (vs 5-10 minutes on RunPod)
   - Models load on container start via `@modal.enter()`

2. **Reliable Scaling**
   - Auto-scales immediately when requests arrive
   - No queue starvation issues
   - Scale to zero when idle (cost savings)

3. **Simple Deployment**
   - Single Python file defines entire app
   - No Dockerfile required
   - `modal deploy modal_app.py` deploys in seconds

4. **Good Developer Experience**
   - Excellent documentation
   - Clear error messages
   - Dashboard shows real-time container status

## Architecture Decisions

### Decision 1: HTTP vs SDK Integration

**Options Considered**:
1. Modal Python SDK (direct function calls)
2. Modal web endpoints (HTTP REST API)

**Chosen**: HTTP web endpoints

**Rationale**:
- Worker is in TypeScript, not Python
- HTTP is language-agnostic
- Easier to mock in tests
- Simpler error handling

**Trade-offs**:
- Base64 encoding overhead (~33% size increase)
- HTTP timeout limits
- No streaming progress updates

### Decision 2: Base64 vs Signed URLs

**Current**: Base64-encoded video in HTTP body

**Pros**:
- Simple implementation
- Single request/response
- No storage coordination needed

**Cons**:
- ~50MB practical limit
- Higher memory usage
- Slower for large files

**Future Improvement**: Use signed URLs
```
1. Worker uploads input to storage
2. Worker sends signed URL to Modal
3. Modal downloads, processes, uploads
4. Modal returns output signed URL
5. Worker updates job with output URL
```

### Decision 3: Always GPU vs Smart Routing

**Options Considered**:
1. Smart routing (choose GPU or CPU based on job)
2. Always use GPU

**Chosen**: Always GPU

**Rationale**:
- Simpler architecture
- Consistent processing quality
- GPU cost is acceptable (~$1.67/hr)
- User expectation is AI-powered removal

### Decision 4: Model Loading Strategy

**Options Considered**:
1. Load models per request
2. Load models on container start
3. Pre-load models in Docker image

**Chosen**: Load on container start (`@modal.enter()`)

**Rationale**:
```python
@modal.enter()
def setup(self):
    self.yolo = get_yolo_model()  # ~10s
    self.lama = get_lama_model()  # ~20s
```
- Models loaded once per container lifecycle
- Shared across multiple requests
- Container stays warm for `idle_timeout` seconds

**Trade-off**: First request has ~30s model loading overhead

## Technical Challenges

### Challenge 1: Token Exposure

**Problem**: Modal tokens accidentally exposed in code/chat

**Solution**:
1. Removed hardcoded tokens from `modal-client.ts`
2. Required environment variables
3. Rotated tokens via `modal token new`
4. Added warning if tokens not set

**Prevention**:
- Never hardcode secrets
- Use environment variables
- Add `.env*` to `.gitignore`
- Enable GitHub secret scanning

### Challenge 2: TypeScript Type Safety with Supabase

**Problem**: Supabase client returns `never` type without schema

**Solution**: Add type assertions
```typescript
const { data } = await supabase
  .from('bl_jobs')
  .select('*')
  .single() as { data: BlJob | null; error: Error | null };
```

**Better Solution**: Generate types from database
```bash
supabase gen types typescript --project-id xxx > types/database.ts
```

### Challenge 3: Modal Error Responses

**Problem**: Modal returns text for some errors, JSON for others

**Solution**: Check content-type before parsing
```typescript
const contentType = response.headers.get('content-type') || '';
if (contentType.includes('application/json')) {
  const data = await response.json();
} else {
  const text = await response.text();
}
```

### Challenge 4: Cold Start Latency

**Problem**: First request after idle takes 30-60 seconds

**Mitigations**:
1. Set `container_idle_timeout=60` (keep warm 60s)
2. Pre-download models in image build
3. Show "initializing" status to user
4. Consider warm pool for latency-sensitive workloads

## Testing Insights

### What Tests Caught

1. **Contract tests** caught Modal response shape changes
2. **Unit tests** validated state machine correctness
3. **Failure mode tests** ensured proper error classification
4. **E2E tests** verified full pipeline integration

### Test Pyramid Balance

```
Ideal:
- 70% unit tests (fast, focused)
- 20% integration tests (medium speed)
- 10% E2E tests (slow, high confidence)

Actual:
- 60% unit/contract tests
- 30% failure mode tests
- 10% E2E tests
```

### Key Test: Golden Path

The single most valuable test is the golden path E2E:
1. Upload video
2. Submit job
3. Wait for completion
4. Verify output accessible

This one test catches 60-70% of "pipeline broken" issues.

## Cost Analysis

### Per-Job Cost Breakdown

| Component | Cost | Notes |
|-----------|------|-------|
| Modal GPU | $0.028 | ~60s @ $1.67/hr |
| Supabase Storage | $0.001 | ~10MB @ $0.10/GB |
| Render Compute | $0.001 | Amortized |
| **Total** | ~$0.03/job | |

### Monthly Projection

| Jobs/Month | GPU Cost | Total |
|------------|----------|-------|
| 100 | $3 | ~$70 |
| 1,000 | $30 | ~$100 |
| 10,000 | $300 | ~$370 |

### Cost Optimization Opportunities

1. **Batch processing**: Combine multiple short videos
2. **Smaller GPU**: Use T4 for development
3. **Caching**: Cache processed videos by hash
4. **Tiered service**: CPU-only for free tier

## Recommendations for Future

### Short-term (Next Sprint)
1. Implement signed URL pattern for large videos
2. Add progress callbacks from Modal to worker
3. Set up cost alerts on all platforms

### Medium-term (Next Quarter)
1. Add GPU warm pool for instant processing
2. Implement video chunking for long videos
3. Add quality comparison metrics

### Long-term (Next Year)
1. Multi-region deployment for latency
2. Custom model training for specific watermarks
3. Real-time preview during processing

## Key Takeaways

1. **Choose providers carefully**: RunPod looked cheaper but reliability issues made it unusable
2. **Simple beats clever**: HTTP endpoints are easier than SDK integration across languages
3. **Test the happy path first**: One good E2E test is worth 10 mediocre unit tests
4. **Secrets management matters**: One exposed token can compromise everything
5. **Cold starts are real**: Plan for 30-60s initialization in serverless GPU
6. **Scale to zero is valuable**: Pay only for actual GPU usage, not idle time

## References

- [Modal Documentation](https://modal.com/docs)
- [YOLO Documentation](https://docs.ultralytics.com/)
- [LAMA Inpainting Paper](https://arxiv.org/abs/2109.07161)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Supabase Documentation](https://supabase.com/docs)

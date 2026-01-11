# BlankLogo Operations Runbook

## Quick Reference

### Service URLs

| Service | URL | Dashboard |
|---------|-----|-----------|
| **Vercel (Web)** | https://www.blanklogo.app | https://vercel.com/dashboard |
| **Render (API)** | https://blanklogo-api.onrender.com | https://dashboard.render.com |
| **Render (Worker)** | N/A (background) | https://dashboard.render.com |
| **Modal (GPU)** | https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run | https://modal.com/apps |
| **Supabase** | https://ntyobjndcjblnwdwpfgq.supabase.co | https://supabase.com/dashboard |

### Health Checks

```bash
# All services health check
curl -s https://blanklogo-api.onrender.com/health | jq '.'
curl -s https://isaiahdupree33--blanklogo-watermark-removal-health.modal.run | jq '.'
```

## Common Operations

### Deploy Updates

#### Vercel (Frontend)
```bash
git push origin main  # Auto-deploys via GitHub integration
```

#### Render (Worker)
```bash
git push origin main  # Auto-deploys via GitHub integration
# Or manual: Render Dashboard → blanklogo-worker → Manual Deploy
```

#### Modal (GPU)
```bash
cd apps/worker/python
modal deploy modal_app.py
```

### Rotate Credentials

#### Modal Tokens
```bash
# 1. Generate new token
modal token new

# 2. Get new tokens
cat ~/.modal.toml | grep -E "token_id|token_secret"

# 3. Update Render environment
# Dashboard → blanklogo-worker → Environment → Update MODAL_TOKEN_ID, MODAL_TOKEN_SECRET

# 4. Trigger redeploy
# Dashboard → blanklogo-worker → Manual Deploy
```

#### Supabase Keys
```bash
# 1. Supabase Dashboard → Settings → API → Generate new key
# 2. Update all services that use the key
# 3. Redeploy affected services
```

### View Logs

#### Render Worker Logs
```bash
# Dashboard → blanklogo-worker → Logs
# Or use Render CLI:
render logs --service blanklogo-worker --tail
```

#### Modal Logs
```bash
# Dashboard: https://modal.com/apps/isaiahdupree33/main/deployed/blanklogo-watermark-removal
# Or CLI:
modal app logs blanklogo-watermark-removal
```

#### Supabase Logs
```bash
# Dashboard → Logs → Select table/function
```

## Incident Response

### Job Stuck in "Processing"

**Symptoms**: Job status is "processing" for >10 minutes

**Diagnosis**:
```bash
# Check worker logs
# Render Dashboard → blanklogo-worker → Logs

# Check Modal logs
# Modal Dashboard → blanklogo-watermark-removal → Logs

# Check job in database
# Supabase Dashboard → Table Editor → bl_jobs → Filter by ID
```

**Resolution**:
1. If worker crashed: Job will auto-retry after lease expires (~5 min)
2. If Modal timed out: Check Modal dashboard for errors, may need to increase timeout
3. If stuck permanently: Manually update job status:
```sql
UPDATE bl_jobs SET status = 'failed', error_message = 'Manual intervention - stuck job' WHERE id = 'xxx';
```

### Modal Cold Start Too Slow

**Symptoms**: First job takes >2 minutes

**Diagnosis**:
```bash
# Check Modal dashboard for cold start times
# Modal Dashboard → blanklogo-watermark-removal → Metrics
```

**Resolution**:
1. Increase `container_idle_timeout` in `modal_app.py`:
```python
@app.function(container_idle_timeout=120)  # Keep warm for 2 minutes
```
2. Redeploy: `modal deploy modal_app.py`

### Queue Backlog

**Symptoms**: Many jobs in "queued" status

**Diagnosis**:
```bash
# Check queue stats
curl -s https://blanklogo-api.onrender.com/health | jq '.services.queue'
```

**Resolution**:
1. Check worker is running: Render Dashboard → blanklogo-worker → Status
2. Check Redis connection: Worker logs should show "Redis connected"
3. Scale worker if needed (Render paid plans)

### Modal Out of Memory

**Symptoms**: Jobs fail with "CUDA out of memory"

**Diagnosis**:
```bash
# Check Modal logs for OOM errors
# Modal Dashboard → Logs
```

**Resolution**:
1. Use larger GPU:
```python
gpu_config = modal.gpu.A100()  # Upgrade from A10G
```
2. Or reduce memory usage in processing code

### Database Connection Issues

**Symptoms**: API returns 500, worker can't update jobs

**Diagnosis**:
```bash
# Check Supabase status
# https://status.supabase.com

# Check connection from worker logs
# Look for "Supabase connection" messages
```

**Resolution**:
1. Check Supabase dashboard for connection limits
2. Verify environment variables are correct
3. Check if IP allowlist is blocking connections

## Monitoring

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Queue depth | 0-5 | 10-20 | >50 |
| Job completion time | <2 min | 2-5 min | >10 min |
| Modal cold start | <60s | 60-120s | >180s |
| Error rate | <1% | 1-5% | >10% |
| Worker memory | <70% | 70-85% | >90% |

### Setting Up Alerts

#### Render
- Dashboard → blanklogo-worker → Settings → Notifications
- Enable: Deploy failed, Service down, High memory

#### Modal
- Dashboard → Settings → Notifications
- Enable: Function errors, Timeout alerts

#### Supabase
- Dashboard → Settings → Notifications
- Enable: Database errors, Storage quota

## Scaling

### Current Limits

| Resource | Current | Can Scale To |
|----------|---------|--------------|
| Render Worker | 1 instance | 10+ (paid) |
| Modal GPU | Auto-scale | 100+ concurrent |
| Redis | 256MB | 1GB+ (paid) |
| Supabase DB | 500MB | 8GB+ (paid) |
| Supabase Storage | 1GB | 100GB+ (paid) |

### Scaling Procedures

#### Scale Render Worker
1. Dashboard → blanklogo-worker → Settings
2. Change instance type or count
3. Note: Requires paid plan for multiple instances

#### Scale Modal
Modal auto-scales automatically. To adjust limits:
```python
@app.function(
    concurrency_limit=10,  # Max concurrent executions
    allow_concurrent_inputs=5,  # Requests per container
)
```

## Backup & Recovery

### Database Backup

Supabase provides automatic daily backups (Pro plan).

Manual backup:
```bash
# Export via Supabase CLI
supabase db dump -f backup.sql
```

### Recovery Procedures

#### Restore from Backup
```bash
# Supabase Dashboard → Settings → Backups → Restore
# Or:
supabase db reset --db-url $DATABASE_URL < backup.sql
```

#### Rebuild Modal App
```bash
cd apps/worker/python
modal deploy modal_app.py --force
```

## Cost Management

### Current Monthly Costs (Estimated)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | $20 | Pro plan |
| Render API | $7 | Starter |
| Render Worker | $7 | Starter |
| Render Redis | $7 | Starter |
| Modal GPU | ~$50-200 | Pay per use (~$1.67/hr A10G) |
| Supabase | $25 | Pro plan |
| **Total** | ~$116-266 | Varies with usage |

### Cost Optimization

1. **Modal**: Scale to zero when idle (already configured)
2. **Render**: Use starter instances for low traffic
3. **Supabase**: Monitor storage usage, clean up old videos
4. **Videos**: Set expiration (7 days default) to auto-delete

### Cost Alerts

Set budget alerts in each platform:
- Modal: Settings → Usage → Set budget
- Render: Account → Billing → Usage alerts
- Supabase: Settings → Billing → Usage alerts

## Security Checklist

### Monthly Review
- [ ] Rotate Modal tokens
- [ ] Review Supabase RLS policies
- [ ] Check for unused API keys
- [ ] Review access logs for anomalies
- [ ] Update dependencies for security patches

### Incident Response
1. **Credential Leak**: Immediately rotate affected credentials
2. **Unauthorized Access**: Disable affected accounts, audit logs
3. **Data Breach**: Notify affected users, report per regulations

## Contacts

### Escalation Path
1. **L1**: Check dashboards, restart services
2. **L2**: Review logs, check configurations
3. **L3**: Contact platform support

### Platform Support
- Vercel: support@vercel.com
- Render: support@render.com
- Modal: support@modal.com
- Supabase: support@supabase.com

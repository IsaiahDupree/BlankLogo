# BlankLogo Code Improvements PRD

**Document Version:** 1.0  
**Date:** January 4, 2026  
**Status:** In Progress

---

## Executive Summary

This PRD outlines critical bug fixes, missing tests, performance improvements, and security enhancements identified during a comprehensive code audit of the BlankLogo watermark removal application.

---

## 1. Bugs & Issues

### 1.1 Empty Catch Blocks (Priority: High)
**Location:** `apps/worker/src/download.ts` (5 instances)

**Problem:** Silent failures hide errors and make debugging difficult.

**Solution:** Add proper error logging to all catch blocks.

**Files Affected:**
- `apps/worker/src/download.ts` (lines 96, 147, 209, 406, 413)

**Acceptance Criteria:**
- [ ] All catch blocks log errors with context
- [ ] Error messages include operation being attempted
- [ ] No silent failures in download pipeline

---

### 1.2 No Job Retry Logic (Priority: High)
**Location:** `apps/worker/src/index.ts`

**Problem:** Failed jobs are not retried automatically, leading to poor user experience.

**Solution:** Implement BullMQ retry with exponential backoff.

**Configuration:**
```typescript
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000  // 5s, 10s, 20s
  }
}
```

**Acceptance Criteria:**
- [ ] Jobs retry up to 3 times on failure
- [ ] Exponential backoff prevents hammering
- [ ] Final failure triggers user notification
- [ ] Retry count visible in job status

---

### 1.3 Console.logs in Production (Priority: Medium)
**Location:** `apps/web/src/` (179 instances)

**Problem:** Excessive logging in production impacts performance and exposes internal details.

**Solution:** Create logger utility that respects `NODE_ENV`.

**Acceptance Criteria:**
- [ ] Logger utility created
- [ ] Debug logs only in development
- [ ] Error logs always visible
- [ ] No sensitive data logged

---

## 2. Missing Tests

### 2.1 Email Notification Tests (Priority: High)
**Location:** `apps/worker/src/userNotify.ts`

**Tests Needed:**
- [ ] `notifyJobCompleted` sends correct email
- [ ] `notifyJobFailed` includes error details
- [ ] `notifyCreditsLow` triggers at threshold
- [ ] Respects user notification preferences
- [ ] Handles Resend API errors gracefully

---

### 2.2 Credit Flow Tests (Priority: High)

**Tests Needed:**
- [ ] Credits reserved on job creation
- [ ] Credits finalized on job completion
- [ ] Credits refunded on job failure
- [ ] Insufficient credits blocks job creation
- [ ] Credit balance updates in real-time

---

### 2.3 Error Recovery Tests (Priority: Medium)

**Tests Needed:**
- [ ] Job retries on transient failure
- [ ] Job fails permanently after max retries
- [ ] User notified on final failure
- [ ] Credits refunded on permanent failure

---

## 3. Performance Improvements

### 3.1 Redis Caching for User Preferences (Priority: Medium)

**Problem:** Every notification check queries the database.

**Solution:** Cache user preferences in Redis with 5-minute TTL.

**Implementation:**
```typescript
async function getUserPrefs(userId: string) {
  const cacheKey = `user:prefs:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const prefs = await db.getUserPrefs(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(prefs));
  return prefs;
}
```

**Acceptance Criteria:**
- [ ] Preferences cached in Redis
- [ ] Cache invalidated on preference update
- [ ] 5-minute TTL prevents stale data
- [ ] Fallback to DB on cache miss

---

### 3.2 Video File Cleanup (Priority: Medium)

**Problem:** Processed videos accumulate in storage indefinitely.

**Solution:** Implement cleanup job for expired videos (7+ days old).

**Implementation:**
- Cron job runs daily at 3 AM
- Deletes videos where `expires_at < NOW()`
- Logs cleanup statistics

**Acceptance Criteria:**
- [ ] Cleanup job implemented
- [ ] Only deletes expired videos
- [ ] Logs number of files deleted
- [ ] Can be triggered manually

---

## 4. Security Improvements

### 4.1 Remove Debug Endpoint in Production (Priority: High)

**Problem:** `/debug` endpoint exposes internal state.

**Solution:** Guard with `NODE_ENV` check.

```typescript
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug', debugHandler);
}
```

---

### 4.2 Rate Limiting for Auth Endpoints (Priority: High)

**Problem:** No rate limiting on `/login` and `/signup`.

**Solution:** Add stricter rate limits for auth endpoints.

```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts'
});
```

---

### 4.3 URL Validation (Priority: Medium)

**Problem:** Video URLs not validated for SSRF.

**Solution:** Add URL validation before processing.

**Validation Rules:**
- Must be HTTP/HTTPS
- No localhost/private IPs
- Must be from allowed domains (optional whitelist)

---

## 5. Implementation Plan

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | Fix empty catch blocks, Add retry logic | 30 min |
| **Phase 2** | Add logger utility, Remove console.logs | 20 min |
| **Phase 3** | Write email notification tests | 20 min |
| **Phase 4** | Add Redis caching | 15 min |
| **Phase 5** | Security improvements | 15 min |
| **Phase 6** | Video cleanup cron | 15 min |

**Total Estimated Time:** ~2 hours

---

## 6. Success Metrics

- [ ] All tests passing
- [ ] No empty catch blocks
- [ ] Jobs retry on failure
- [ ] Debug logs disabled in production
- [ ] User preferences cached
- [ ] Expired videos cleaned up
- [ ] Auth endpoints rate limited

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-04 | Initial PRD created |

# PRD: Event Tracking & ML User Simulation System

**Status:** In Progress  
**Created:** 2026-01-12  
**Stack:** PostHog + Meta Pixel/CAPI + Supabase + Stripe

---

## Overview

End-to-end event instrumentation from ad → landing → signup → credits → first successful watermark removal → purchase → repeat/churn. Used to:
1. Optimize Meta + onsite funnel
2. Build simulated user model for forecasting

---

## 1. Event Categories

Keep these buckets consistent across all analytics:

| Category | Purpose |
|----------|---------|
| **Acquisition** | Where they came from |
| **Activation** | Did they get to value? |
| **Core Value / Product** | Jobs, outputs, success |
| **Monetization** | Checkout, purchase, subscription, credits |
| **Retention** | Repeat usage, habit signals |
| **Reliability** | Errors, failed jobs, latency |
| **Compliance / Account** | Consent, deletion |

---

## 2. Full Event List

### A) Acquisition (ad → site)

| Event | Description |
|-------|-------------|
| `ad_click` | Capture click ID if possible |
| `landing_view` | First page view from ad |
| `cta_click` | Get Free Credits / Get Started |
| `pricing_view` | Viewed pricing page |
| `faq_expand` | Optional - useful for objection analysis |

**Required Properties:**
```json
{
  "utm_source": "string",
  "utm_campaign": "string",
  "utm_adset": "string",
  "utm_content": "string",
  "fbclid": "string",
  "gclid": "string",
  "referrer": "string",
  "landing_variant": "string",
  "page_path": "string",
  "device": "string",
  "geo": "string",
  "session_id": "string"
}
```

---

### B) Activation (signup + email loop + credits appear)

| Event | Description |
|-------|-------------|
| `signup_start` | Began signup flow |
| `signup_submit` | Submitted signup form |
| `auth_email_sent` | Magic link/OTP sent |
| `auth_email_delivered` | If available from Resend |
| `auth_email_opened` | Optional/hard to track reliably |
| `auth_email_link_clicked` | User clicked auth link |
| `login_success` | Successfully authenticated |
| `credits_granted` | Free credits applied |
| `onboarding_view` | Congrats/instructions page |
| `activation_complete` | Custom "ready" marker |

**`activation_complete` Definition:**  
Fire when user has: `login_success` AND `credits_granted` AND reaches upload screen (`upload_view`)

---

### C) Core Value / Product (watermark removal job machine)

| Event | Description |
|-------|-------------|
| `upload_view` | Viewed upload screen |
| `upload_started` | Began file upload |
| `upload_completed` | File upload finished |
| `job_created` | Job submitted to queue |
| `watermark_detected` | Platform detected + confidence |
| `processing_started` | Worker picked up job |
| `processing_completed` | Job finished successfully |
| `processing_failed` | Job failed |
| `download_clicked` | User clicked download |
| `download_completed` | Download finished (if measurable) |
| `job_refunded` | Credit returned on unrecoverable fail |
| `share_clicked` | Optional: copy link, etc. |

**Required Properties (critical for ML + debugging):**
```json
{
  "job_id": "string",
  "mode": "crop | inpaint",
  "detected_platform": "tiktok | sora | runway | ...",
  "watermark_confidence": "number (0-1)",
  "video_bytes": "number",
  "duration_seconds": "number",
  "resolution": "string",
  "processing_time_ms": "number",
  "success_bool": "boolean",
  "failure_reason": "string | null",
  "error_code": "string | null",
  "credits_before": "number",
  "credits_after": "number"
}
```

---

### D) Monetization (purchase machine)

| Event | Description |
|-------|-------------|
| `paywall_view` | If gated |
| `checkout_started` | Began checkout |
| `checkout_step` | Optional granular steps |
| `purchase_completed` | One-time credits or subscription |
| `subscription_started` | New subscription |
| `subscription_renewed` | Subscription renewed |
| `subscription_canceled` | User canceled |
| `topup_purchased` | Credit pack purchased |
| `invoice_failed` | Payment failed |
| `refund_issued` | Cash refund |
| `plan_changed` | Upgrade/downgrade |

**Required Properties:**
```json
{
  "order_id": "string",
  "sku": "string",
  "plan": "string",
  "billing_period": "monthly | yearly | one-time",
  "price": "number",
  "currency": "string",
  "credits_added": "number",
  "coupon": "string | null",
  "payment_provider": "stripe",
  "is_trial": "boolean",
  "ltv_to_date": "number"
}
```

---

### E) Retention (repeat behavior + intent)

| Event | Description |
|-------|-------------|
| `return_session` | Session start after X hours/days |
| `upload_returning_user` | First upload in returning session |
| `job_completed_returning_user` | Job completed by returning user |
| `low_credits_warning_shown` | User saw low credits warning |
| `low_credits_topup_clicked` | Clicked topup from warning |
| `notification_sent` | Job complete email/webhook sent |
| `notification_clicked` | User clicked notification |

---

### F) Reliability + Trust

| Event | Description |
|-------|-------------|
| `error_shown` | Front-end error toast/modal |
| `api_error` | Backend error |
| `job_timeout` | Job timed out |
| `storage_error` | Storage operation failed |
| `latency_bucket` | e.g., <30s, 30-120s, >120s |

**These correlate strongly with churn.**

---

### G) Compliance / Account Control

| Event | Description |
|-------|-------------|
| `cookie_consent_updated` | Analytics/ads toggles |
| `account_deletion_started` | User initiated deletion |
| `account_deleted` | Account deleted |
| `data_export_requested` | Optional |

---

## 3. ML Event Categorization

### Funnel Stage Labels

| Stage | Events |
|-------|--------|
| **Acq** | `landing_view`, `cta_click` |
| **Act** | `login_success`, `credits_granted`, `activation_complete` |
| **Value** | `job_created`, `processing_completed`, `download_clicked` |
| **Rev** | `checkout_started`, `purchase_completed` |
| **Ret** | `return_session`, `job_completed_returning_user` |
| **Risk** | `processing_failed`, `error_shown`, `invoice_failed` |

### 4 North Star Milestones (Track Hard)

1. **Activated** = `activation_complete`
2. **First Value** = first `processing_completed`
3. **Aha Moment** = first `download_clicked`
4. **Monetized** = `purchase_completed`

Everything else is a driver.

---

## 4. Event Naming + Payload Conventions

### Always Include

```json
{
  "distinct_id": "anon_xxx (anonymous ID)",
  "user_id": "usr_xxx (after login)",
  "session_id": "sess_xxx",
  "timestamp": "ISO 8601 (server-side preferred)",
  "source": "web | server | worker",
  "experiment_variant": "string",
  "utm_source": "string",
  "utm_campaign": "string",
  "utm_content": "string",
  "fbclid": "string",
  "ad_id": "string",
  "adset_id": "string",
  "campaign_id": "string"
}
```

### Identity Stitching Rule

Track anonymously → on `login_success` call identify/alias to merge sessions.

---

## 5. User Simulation State Machine

### User States

```
S0_ClickedAd
S1_Landed
S2_ClickedCTA
S3_SignedUp
S4_LoggedIn
S5_CreditsGranted
S6_Uploaded
S7_JobCompleted
S8_Downloaded
S9_Purchased
S10_Retained
S11_Churned
```

### Transition Probabilities (Learn from Real Events)

| Transition | Description |
|------------|-------------|
| P(S1\|S0) | Landing rate (~1 unless tracking issues) |
| P(S2\|S1) | CTA click-through on landing |
| P(S3\|S2) | Signup completion |
| P(S4\|S3) | Login success via email link |
| P(S7\|S6) | Job success rate |
| P(S9\|S8) | Purchase after aha moment |
| P(S10\|S9) | Renewal / repeat usage probability |
| P(Churn\|...) | Hazard model: time, usage, errors, credits_left |

This becomes a **Markov chain** or **funnel simulator**.

---

## 6. Churn & Purchase Formulas

### Purchase Percentage (Overall from Clicks)

```
P(purchase|click) = 
  P(CTA|land) × 
  P(signup|CTA) × 
  P(login|signup) × 
  P(aha|login) × 
  P(purchase|aha)
```

### Subscription Churn (Monthly)

```
Monthly churn = # canceled in month / # active at start of month
```

### Credit-Pack Churn (Behavioral)

- No return in 30/60/90 days, OR
- No `job_completed` in X days

### Simple Churn Hazard Model

```
P(churn) = f(
  days_since_last_job,
  job_fail_rate,
  processing_time,
  credits_left,
  support_tickets
)
```

---

## 7. ML Models

### Model 1: Purchase Propensity (Who Will Buy)

**Label:** `purchase_completed` within 7 days

**Features:**
- `jobs_completed_24h`
- `time_to_first_job`
- `success_rate`
- `mode_used`
- `credits_remaining`
- `pricing_viewed`
- `device`, `geo`
- `ad_campaign_id` / `creative_id`
- `errors_seen`

### Model 2: Churn Propensity (Who Will Stop)

**Label:** No `job_completed` in 30 days OR `subscription_canceled`

**Features:**
- `days_since_last_job`
- `job_fail_rate`
- `avg_processing_time`
- `download_rate`
- `support_contacted`
- `credits_rollover_balance`

### Model 3: LTV Predictor

**Label:** Revenue in 30/60/90 days

**Features:** Combine Models 1 + 2 + pricing behavior

---

## 8. Implementation Checklist

| Layer | Events |
|-------|--------|
| **Client-side (PostHog)** | Page views, CTA clicks, pricing views, signup start |
| **Server-side (API)** | `job_created`, `processing_*`, `credits_granted`, `purchase_completed` |
| **Worker-side** | `processing_started/completed/failed`, `processing_time_ms`, `failure_reason` |
| **Identity merge** | Anonymous → user_id on login |
| **Meta Pixel / CAPI** | PageView, ViewContent (pricing), Lead (signup), CompleteRegistration (login), InitiateCheckout, Purchase |
| **Everywhere** | `experiment_variant` |

---

## 9. Extra High-Signal Features for ML

### A) Intent + Urgency Signals

- `time_to_first_cta_click`
- `time_on_landing_before_cta`
- `pricing_viewed` + `pricing_time_spent`
- `faq_opened_topics`
- `scroll_depth_bucket` (25/50/75/100)
- `return_within_24h`
- `jobs_attempted_in_first_session`
- `repeat_upload_within_10min`

### B) Content Complexity Signals

- `watermark_type` (sora/tiktok/runway/unknown)
- `watermark_position` (edge/corner/center/unknown)
- `mode_selected` (crop/inpaint)
- `video_duration_bucket` (0-10s, 10-30s, 30-60s, 60s+)
- `resolution_bucket` (720p/1080p/4k)
- `file_size_bucket`
- `audio_present`

### C) Quality Satisfaction Proxies

- `download_clicked` + `download_completed`
- `second_download_attempt`
- `job_reprocessed_same_input` (dissatisfaction signal)
- `refund_credit_returned`
- `support_contacted_after_job`
- Optional: `result_rating` (👍/👎) + `reason_code`

### D) Pricing Sensitivity Signals

- `plan_viewed` (starter/pro/business)
- `topup_pack_viewed` + `selected_pack`
- `coupon_seen` / `applied`
- `credits_balance_at_checkout`
- `low_credits_warning_shown` → `topup_clicked`

### E) Reliability / Performance Telemetry

- `processing_time_ms`
- `queue_wait_ms`
- `failure_reason_code`
- `retry_count`
- `device_network_type`
- `status_poll_count` (anxiety indicator)

### F) Attribution + Creative Features

- `campaign_id`, `adset_id`, `ad_id`, `creative_id`
- `ad_angle` (UGC-deliverable, quality, speed, privacy)
- `landing_variant_id`
- `first_touch_channel` vs `last_touch_channel`

### G) Account Lifecycle & Trust

- `account_age_days`
- `email_domain_type` (gmail/work/custom)
- `consent_state` (ads_allowed, analytics_allowed)

---

## 10. Canonical Event Schema (JSON)

Use this shape for every event (client/server/worker):

```json
{
  "event": "processing_completed",
  "timestamp": "2026-01-12T05:12:34.123Z",
  "source": "worker",
  "environment": "prod",
  "distinct_id": "anon_9b2f...",
  "user_id": "usr_12345",
  "session_id": "sess_abc123",
  "properties": {
    "page_path": "/app",
    "utm_source": "facebook",
    "utm_campaign": "BlankLogo | Purchase | Prospecting | Broad US | Creative Test v1",
    "ad_platform": "meta",
    "campaign_id": "123",
    "adset_id": "456",
    "ad_id": "789",
    "creative_id": "cr_001",
    "ad_angle": "ugc_deliverable",
    "landing_variant_id": "hero_v3",

    "job_id": "job_987",
    "mode": "inpaint",
    "detected_platform": "tiktok",
    "watermark_position": "corner",
    "watermark_confidence": 0.91,
    "video_duration_bucket": "10-30s",
    "resolution_bucket": "1080p",
    "file_size_bucket": "50-150mb",

    "queue_wait_ms": 12000,
    "processing_time_ms": 98000,
    "success": true,
    "failure_reason_code": null,

    "credits_before": 18,
    "credits_after": 17
  }
}
```

**Rule:** Analytics events are "what happened", properties are "why it happened".

---

## 11. Meta Pixel / CAPI Mapping

| Funnel Stage | Meta Event | BlankLogo Event |
|--------------|------------|-----------------|
| Landing | `PageView` | `landing_view` |
| Pricing | `ViewContent` | `pricing_view` |
| Signup Start | `Lead` | `signup_start` |
| Login Success | `CompleteRegistration` | `login_success` |
| Checkout Start | `InitiateCheckout` | `checkout_started` |
| Purchase | `Purchase` | `purchase_completed` |
| First Job | `AddToCart` (optional) | `processing_completed` (first) |

---

## 12. Monte Carlo Simulation Template

See: `scripts/simulate-funnel.py`

```python
import random
from dataclasses import dataclass

@dataclass
class Rates:
    ctr: float                  # impressions -> click
    p_cta: float                # landing -> CTA click
    p_signup: float             # CTA -> signup submit
    p_login: float              # signup -> login success
    p_upload: float             # login -> upload attempt
    p_job_success: float        # upload -> job completed
    p_download: float           # job success -> download clicked
    p_purchase: float           # download -> purchase
    p_repeat_30d: float         # returning usage within 30 days

def simulate_cohort(impressions: int, rates: Rates, base_churn: float = 0.25,
                    extra_churn_if_fail: float = 0.20, extra_churn_if_slow: float = 0.10,
                    slow_rate: float = 0.20):
    clicks = sum(1 for _ in range(impressions) if random.random() < rates.ctr)

    activated = 0
    aha = 0
    purchasers = 0
    retained_30d = 0
    churned_30d = 0

    for _ in range(clicks):
        if random.random() < rates.p_cta and random.random() < rates.p_signup and random.random() < rates.p_login:
            activated += 1

            if random.random() < rates.p_upload:
                slow = (random.random() < slow_rate)
                success = (random.random() < rates.p_job_success)

                if success and random.random() < rates.p_download:
                    aha += 1

                    if random.random() < rates.p_purchase:
                        purchasers += 1

                    churn_prob = base_churn + (0 if success else extra_churn_if_fail) + (extra_churn_if_slow if slow else 0)
                    churn_prob = min(max(churn_prob, 0), 0.95)

                    if random.random() < (1 - churn_prob) and random.random() < rates.p_repeat_30d:
                        retained_30d += 1
                    else:
                        churned_30d += 1
                else:
                    churned_30d += 1

    return {
        "impressions": impressions,
        "clicks": clicks,
        "activated": activated,
        "aha": aha,
        "purchasers": purchasers,
        "retained_30d": retained_30d,
        "churned_30d": churned_30d,
        "purchase_rate_per_click": purchasers / clicks if clicks else 0.0,
        "activation_rate_per_click": activated / clicks if clicks else 0.0
    }

# Usage:
# rates = Rates(ctr=0.02, p_cta=0.30, p_signup=0.50, p_login=0.80, 
#               p_upload=0.90, p_job_success=0.85, p_download=0.95, 
#               p_purchase=0.10, p_repeat_30d=0.40)
# result = simulate_cohort(10000, rates)
# print(result)
```

---

## 13. Queries to Compute Real Transition Rates

### PostHog SQL Examples

```sql
-- Activation Rate (login_success / signup_start)
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'login_success' THEN distinct_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END), 0) as activation_rate
FROM events
WHERE timestamp > now() - interval '30 days';

-- Aha Rate (first download_clicked / activation_complete)
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'download_clicked' THEN distinct_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END), 0) as aha_rate
FROM events
WHERE timestamp > now() - interval '30 days';

-- Purchase Rate (purchase_completed / aha users)
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'purchase_completed' THEN distinct_id END) * 1.0 /
  NULLIF(COUNT(DISTINCT CASE WHEN event = 'download_clicked' THEN distinct_id END), 0) as purchase_rate
FROM events
WHERE timestamp > now() - interval '30 days';

-- 30-Day Churn (no job_completed in 30 days after first job)
WITH first_job AS (
  SELECT distinct_id, MIN(timestamp) as first_job_at
  FROM events WHERE event = 'processing_completed'
  GROUP BY distinct_id
),
recent_job AS (
  SELECT distinct_id, MAX(timestamp) as last_job_at
  FROM events WHERE event = 'processing_completed'
  GROUP BY distinct_id
)
SELECT 
  COUNT(CASE WHEN r.last_job_at < now() - interval '30 days' THEN 1 END) * 1.0 /
  NULLIF(COUNT(*), 0) as churn_rate_30d
FROM first_job f
JOIN recent_job r ON f.distinct_id = r.distinct_id
WHERE f.first_job_at < now() - interval '30 days';
```

---

## Next Steps

1. ✅ PRD Created
2. 🔄 Audit current events vs this spec
3. ⏳ Implement missing client-side events
4. ⏳ Implement missing server-side events
5. ⏳ Implement missing worker events
6. ⏳ Create simulation script
7. ⏳ Set up dashboards

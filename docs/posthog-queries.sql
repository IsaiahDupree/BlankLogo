-- ═══════════════════════════════════════════════════════════════════
-- PostHog SQL Queries for BlankLogo Funnel Analysis
-- Run these in PostHog > Data Management > SQL
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
-- 1. FUNNEL CONVERSION RATES (Last 30 Days)
-- ═══════════════════════════════════════════════════════════════════

-- Landing → Signup Start
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'landing_view' THEN distinct_id END) as landing_views,
  COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END) as signup_starts,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'landing_view' THEN distinct_id END), 0) * 100, 
    2
  ) as landing_to_signup_pct
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND event IN ('landing_view', 'signup_start');

-- Signup Start → Signup Submit → Activation Complete
SELECT 
  COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END) as signup_starts,
  COUNT(DISTINCT CASE WHEN event = 'signup_submit' THEN distinct_id END) as signup_submits,
  COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END) as activations,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'signup_submit' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END), 0) * 100, 
    2
  ) as start_to_submit_pct,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'signup_submit' THEN distinct_id END), 0) * 100, 
    2
  ) as submit_to_activation_pct
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND event IN ('signup_start', 'signup_submit', 'activation_complete');

-- ═══════════════════════════════════════════════════════════════════
-- 2. JOB FUNNEL (Activation → First Job → First Download)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END) as activated_users,
  COUNT(DISTINCT CASE WHEN event = 'job_created' THEN distinct_id END) as users_with_jobs,
  COUNT(DISTINCT CASE WHEN event = 'job_completed' THEN distinct_id END) as users_with_completed_jobs,
  COUNT(DISTINCT CASE WHEN event = 'job_download_clicked' THEN distinct_id END) as users_who_downloaded,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'job_created' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END), 0) * 100, 
    2
  ) as activation_to_job_pct,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'job_download_clicked' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'job_completed' THEN distinct_id END), 0) * 100, 
    2
  ) as completion_to_download_pct
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND event IN ('activation_complete', 'job_created', 'job_completed', 'job_download_clicked');

-- ═══════════════════════════════════════════════════════════════════
-- 3. MONETIZATION FUNNEL
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  COUNT(DISTINCT CASE WHEN event = 'pricing_view' THEN distinct_id END) as pricing_viewers,
  COUNT(DISTINCT CASE WHEN event = 'billing_checkout_started' THEN distinct_id END) as checkout_starters,
  COUNT(DISTINCT CASE WHEN event = 'billing_checkout_completed' THEN distinct_id END) as purchasers,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'billing_checkout_started' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'pricing_view' THEN distinct_id END), 0) * 100, 
    2
  ) as pricing_to_checkout_pct,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'billing_checkout_completed' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'billing_checkout_started' THEN distinct_id END), 0) * 100, 
    2
  ) as checkout_to_purchase_pct
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND event IN ('pricing_view', 'billing_checkout_started', 'billing_checkout_completed');

-- ═══════════════════════════════════════════════════════════════════
-- 4. ATTRIBUTION ANALYSIS (by UTM Source)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  properties->>'utm_source' as utm_source,
  COUNT(DISTINCT CASE WHEN event = 'landing_view' THEN distinct_id END) as landings,
  COUNT(DISTINCT CASE WHEN event = 'signup_start' THEN distinct_id END) as signups,
  COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END) as activations,
  COUNT(DISTINCT CASE WHEN event = 'billing_checkout_completed' THEN distinct_id END) as purchases,
  ROUND(
    COUNT(DISTINCT CASE WHEN event = 'activation_complete' THEN distinct_id END)::numeric / 
    NULLIF(COUNT(DISTINCT CASE WHEN event = 'landing_view' THEN distinct_id END), 0) * 100, 
    2
  ) as landing_to_activation_pct
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
  AND properties->>'utm_source' IS NOT NULL
GROUP BY properties->>'utm_source'
ORDER BY landings DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 5. TIME TO ACTIVATION (Median)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (properties->>'time_to_activate_ms')::numeric / 1000) as median_time_to_activate_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (properties->>'time_to_activate_ms')::numeric / 60000) as median_time_to_activate_minutes,
  AVG((properties->>'time_to_activate_ms')::numeric / 1000) as avg_time_to_activate_seconds
FROM events
WHERE event = 'activation_complete'
  AND timestamp > NOW() - INTERVAL '30 days'
  AND properties->>'time_to_activate_ms' IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 6. CTA CLICK ANALYSIS
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  properties->>'cta_text' as cta_text,
  properties->>'cta_location' as cta_location,
  COUNT(*) as clicks,
  COUNT(DISTINCT distinct_id) as unique_clickers
FROM events
WHERE event = 'cta_click'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY properties->>'cta_text', properties->>'cta_location'
ORDER BY clicks DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 7. SCROLL DEPTH ANALYSIS
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  properties->>'depth' as scroll_depth,
  COUNT(*) as events,
  COUNT(DISTINCT distinct_id) as unique_users
FROM events
WHERE event = 'scroll_depth'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY properties->>'depth'
ORDER BY (properties->>'depth')::int;

-- ═══════════════════════════════════════════════════════════════════
-- 8. RETENTION: RETURN SESSIONS
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  CASE 
    WHEN (properties->>'days_since_last_visit')::int = 0 THEN 'Same day'
    WHEN (properties->>'days_since_last_visit')::int BETWEEN 1 AND 3 THEN '1-3 days'
    WHEN (properties->>'days_since_last_visit')::int BETWEEN 4 AND 7 THEN '4-7 days'
    WHEN (properties->>'days_since_last_visit')::int BETWEEN 8 AND 14 THEN '8-14 days'
    ELSE '15+ days'
  END as return_window,
  COUNT(*) as return_sessions,
  COUNT(DISTINCT distinct_id) as returning_users
FROM events
WHERE event = 'return_session'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY MIN((properties->>'days_since_last_visit')::int);

-- ═══════════════════════════════════════════════════════════════════
-- 9. JOB SUCCESS RATE BY PLATFORM
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  properties->>'platform' as platform,
  COUNT(CASE WHEN event = 'job_completed' THEN 1 END) as completed,
  COUNT(CASE WHEN event = 'job_failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN event = 'job_completed' THEN 1 END)::numeric / 
    NULLIF(COUNT(CASE WHEN event = 'job_completed' THEN 1 END) + COUNT(CASE WHEN event = 'job_failed' THEN 1 END), 0) * 100, 
    2
  ) as success_rate
FROM events
WHERE event IN ('job_completed', 'job_failed')
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY properties->>'platform'
ORDER BY completed DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 10. REVENUE BY PLAN
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  properties->>'plan' as plan,
  COUNT(*) as purchases,
  SUM((properties->>'amount_cents')::numeric / 100) as total_revenue,
  AVG((properties->>'amount_cents')::numeric / 100) as avg_order_value
FROM events
WHERE event = 'billing_checkout_completed'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY properties->>'plan'
ORDER BY total_revenue DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 11. DAILY ACTIVE USERS (DAU)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  DATE(timestamp) as date,
  COUNT(DISTINCT distinct_id) as dau
FROM events
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- ═══════════════════════════════════════════════════════════════════
-- 12. FULL FUNNEL OVERVIEW (Single Query)
-- ═══════════════════════════════════════════════════════════════════

WITH funnel AS (
  SELECT 
    distinct_id,
    MAX(CASE WHEN event = 'landing_view' THEN 1 ELSE 0 END) as landed,
    MAX(CASE WHEN event = 'signup_start' THEN 1 ELSE 0 END) as started_signup,
    MAX(CASE WHEN event = 'signup_submit' THEN 1 ELSE 0 END) as submitted_signup,
    MAX(CASE WHEN event = 'activation_complete' THEN 1 ELSE 0 END) as activated,
    MAX(CASE WHEN event = 'job_created' THEN 1 ELSE 0 END) as created_job,
    MAX(CASE WHEN event = 'job_completed' THEN 1 ELSE 0 END) as completed_job,
    MAX(CASE WHEN event = 'job_download_clicked' THEN 1 ELSE 0 END) as downloaded,
    MAX(CASE WHEN event = 'billing_checkout_completed' THEN 1 ELSE 0 END) as purchased
  FROM events
  WHERE timestamp > NOW() - INTERVAL '30 days'
  GROUP BY distinct_id
)
SELECT 
  'Landing' as stage, SUM(landed) as users, 100 as pct UNION ALL
SELECT 'Signup Start', SUM(started_signup), ROUND(SUM(started_signup)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Signup Submit', SUM(submitted_signup), ROUND(SUM(submitted_signup)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Activated', SUM(activated), ROUND(SUM(activated)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Created Job', SUM(created_job), ROUND(SUM(created_job)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Completed Job', SUM(completed_job), ROUND(SUM(completed_job)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Downloaded', SUM(downloaded), ROUND(SUM(downloaded)::numeric / NULLIF(SUM(landed), 0) * 100, 1) UNION ALL
SELECT 'Purchased', SUM(purchased), ROUND(SUM(purchased)::numeric / NULLIF(SUM(landed), 0) * 100, 1)
FROM funnel;

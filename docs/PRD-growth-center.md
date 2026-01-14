# PRD: BlankLogo Growth Center

**Version:** 1.0  
**Date:** January 13, 2026  
**Author:** Development Team  
**Status:** In Development

---

## 1. Overview

### 1.1 Problem Statement
The current admin dashboard provides basic operational metrics but lacks growth-focused analytics needed to understand user acquisition, conversion, retention, and revenue trends. Product and growth teams need actionable insights to make data-driven decisions.

### 1.2 Objective
Build a comprehensive Growth Center within the admin dashboard that provides real-time visibility into:
- User acquisition and sources
- Conversion funnel performance
- User engagement and retention
- Revenue and monetization metrics

### 1.3 Success Metrics
- Admin can identify top acquisition sources within 10 seconds
- Conversion bottlenecks are visible at a glance
- Retention trends are trackable over 30/60/90 day periods
- All metrics update in real-time on page refresh

---

## 2. User Stories

### 2.1 As an admin, I want to...
1. See where my users are coming from (UTM sources, referrers)
2. Understand my conversion funnel (visitor → signup → first job → paid)
3. Track daily/weekly/monthly active users
4. Identify power users vs casual users
5. Monitor churn and at-risk users
6. View revenue trends and projections

---

## 3. Feature Specifications

### 3.1 Conversion Funnel

**Data Points:**
| Stage | Definition | Source |
|-------|------------|--------|
| Visitors | Unique page views | PostHog/GA |
| Signups | New user registrations | `bl_user_profiles.created_at` |
| Activated | Completed first job | `bl_jobs` WHERE user has ≥1 completed job |
| Paid | Made a purchase | `bl_credit_ledger` WHERE type='purchase' |

**UI Components:**
- Horizontal funnel visualization
- Conversion rate between each stage
- Comparison to previous period (week-over-week)

**Calculations:**
```
signup_rate = signups / visitors * 100
activation_rate = activated_users / signups * 100
paid_rate = paying_users / activated_users * 100
```

### 3.2 Active Users (DAU/WAU/MAU)

**Definitions:**
| Metric | Definition |
|--------|------------|
| DAU | Users with ≥1 job in last 24 hours |
| WAU | Users with ≥1 job in last 7 days |
| MAU | Users with ≥1 job in last 30 days |
| Stickiness | DAU / MAU ratio |

**Data Source:** `bl_jobs` table, grouped by `user_id` and `created_at`

**UI Components:**
- Three large stat cards (DAU, WAU, MAU)
- Stickiness percentage
- Trend sparklines (last 14 days)

### 3.3 UTM/Acquisition Source Breakdown

**Data Points:**
| Field | Source |
|-------|--------|
| utm_source | `bl_user_profiles.metadata` or `bl_auth_events` |
| utm_medium | Same |
| utm_campaign | Same |
| referrer | Same |

**UI Components:**
- Pie/donut chart of top sources
- Table with source, users, conversion rate
- Filter by date range

**Top Sources to Track:**
- Direct
- Google (organic)
- Google Ads
- Facebook/Meta Ads
- Twitter/X
- Reddit
- ProductHunt
- Referral

### 3.4 User Segmentation

**Segments:**
| Segment | Definition |
|---------|------------|
| Power Users | 10+ jobs completed |
| Regular Users | 3-9 jobs completed |
| Casual Users | 1-2 jobs completed |
| Dormant | Signed up, 0 jobs |
| At-Risk | No activity in 14+ days |
| Churned | No activity in 30+ days |

**UI Components:**
- Stacked bar or pie chart
- User counts per segment
- Trend over time

### 3.5 Retention Cohorts

**Cohort Definition:** Users grouped by signup week

**Retention Periods:** Day 1, Day 7, Day 14, Day 30, Day 60, Day 90

**Calculation:**
```
retention_rate = users_active_in_period / cohort_size * 100
```

**UI Components:**
- Cohort retention grid/heatmap
- Row = signup week, Column = retention period
- Color intensity = retention %

### 3.6 Revenue Metrics

**Metrics:**
| Metric | Calculation |
|--------|-------------|
| Total Revenue | Sum of all purchases |
| ARPU | Total Revenue / Total Users |
| ARPPU | Total Revenue / Paying Users |
| Revenue per Job | Total Revenue / Total Jobs |

**UI Components:**
- Revenue trend chart (daily/weekly)
- ARPU/ARPPU cards
- Top paying users list (optional)

---

## 4. Technical Implementation

### 4.1 Database Queries

**Active Users Query:**
```sql
-- DAU
SELECT COUNT(DISTINCT user_id) as dau
FROM bl_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

-- WAU
SELECT COUNT(DISTINCT user_id) as wau
FROM bl_jobs
WHERE created_at > NOW() - INTERVAL '7 days';

-- MAU
SELECT COUNT(DISTINCT user_id) as mau
FROM bl_jobs
WHERE created_at > NOW() - INTERVAL '30 days';
```

**Funnel Query:**
```sql
-- Total signups
SELECT COUNT(*) FROM bl_user_profiles;

-- Activated (has completed job)
SELECT COUNT(DISTINCT user_id) 
FROM bl_jobs 
WHERE status = 'completed';

-- Paid users
SELECT COUNT(DISTINCT user_id) 
FROM bl_credit_ledger 
WHERE delta > 0 AND reason = 'purchase';
```

**User Segments Query:**
```sql
SELECT 
  CASE 
    WHEN job_count >= 10 THEN 'power'
    WHEN job_count >= 3 THEN 'regular'
    WHEN job_count >= 1 THEN 'casual'
    ELSE 'dormant'
  END as segment,
  COUNT(*) as user_count
FROM (
  SELECT u.id, COUNT(j.id) as job_count
  FROM bl_user_profiles u
  LEFT JOIN bl_jobs j ON u.id = j.user_id AND j.status = 'completed'
  GROUP BY u.id
) user_jobs
GROUP BY segment;
```

### 4.2 File Structure

```
apps/web/src/app/admin/
├── page.tsx              # Main admin dashboard (existing)
├── growth/
│   └── page.tsx          # Growth Center page (new)
└── components/
    ├── ConversionFunnel.tsx
    ├── ActiveUsersChart.tsx
    ├── SourceBreakdown.tsx
    ├── UserSegments.tsx
    └── RetentionCohorts.tsx
```

### 4.3 Data Flow

1. Admin navigates to `/admin/growth`
2. Page fetches data from Supabase using service role (RLS bypass)
3. Data is processed client-side for charts
4. Charts render using existing Tailwind styling
5. Refresh button re-fetches all data

---

## 5. UI/UX Design

### 5.1 Layout

```
┌─────────────────────────────────────────────────────┐
│ Growth Center                         [Refresh] 📅  │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ Conversion Funnel                               │ │
│ │ Visitors → Signups → Activated → Paid          │ │
│ │ (100%)     (15%)      (60%)       (10%)        │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────────────────┐│
│ │ DAU   │ │ WAU   │ │ MAU   │ │ Stickiness: 15%  ││
│ │ 12    │ │ 45    │ │ 120   │ │ ████░░░░░░       ││
│ └───────┘ └───────┘ └───────┘ └───────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌────────────────────────┐│
│ │ Traffic Sources      │ │ User Segments          ││
│ │ 🥧 Pie Chart         │ │ 📊 Bar Chart           ││
│ │ - Direct: 45%        │ │ - Power: 5%            ││
│ │ - Google: 30%        │ │ - Regular: 20%         ││
│ │ - Meta: 15%          │ │ - Casual: 35%          ││
│ │ - Other: 10%         │ │ - Dormant: 40%         ││
│ └──────────────────────┘ └────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ Retention Cohorts (Last 8 Weeks)                │ │
│ │      D1    D7    D14   D30   D60   D90         │ │
│ │ W1   ██    ██    █░    █░    ░░    ░░          │ │
│ │ W2   ██    ██    █░    █░    ░░    --          │ │
│ │ W3   ██    █░    █░    ░░    --    --          │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.2 Mobile Responsiveness
- Single column layout on mobile
- Charts stack vertically
- Touch-friendly tap targets
- Horizontal scroll for retention grid

---

## 6. Implementation Phases

### Phase 1: Core Metrics (This Sprint)
- [x] Conversion funnel (signup → activated → paid)
- [x] DAU/WAU/MAU with stickiness
- [x] Basic source breakdown (if UTM data exists)

### Phase 2: Advanced Analytics (Next Sprint)
- [ ] Retention cohort heatmap
- [ ] User segmentation chart
- [ ] Revenue trends over time
- [ ] Date range filters

### Phase 3: Predictive & Alerts (Future)
- [ ] Churn prediction
- [ ] Anomaly detection
- [ ] Email alerts for metrics
- [ ] Goal tracking

---

## 7. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `bl_user_profiles` table | ✅ Exists | User data |
| `bl_jobs` table | ✅ Exists | Job activity |
| `bl_credit_ledger` table | ✅ Exists | Purchases |
| PostHog integration | ✅ Exists | UTM tracking |
| `bl_auth_events` table | ✅ Exists | Signup events |

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| No visitor data (pre-signup) | Use PostHog API or estimate from signups |
| Missing UTM data | Show "Direct" as default, track going forward |
| Large data queries slow | Add database indexes, paginate results |
| RLS blocks admin queries | Use service role key for admin queries |

---

## 9. Success Criteria

- [ ] Growth Center page loads in <2 seconds
- [ ] All metrics display correctly with real data
- [ ] Mobile responsive layout works on iPhone/Android
- [ ] Refresh updates all metrics
- [ ] No console errors or failed queries

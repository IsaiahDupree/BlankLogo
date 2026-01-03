# BlankLogo Business Economics Report
## Customer Acquisition, Pricing Model & Unit Economics Analysis

**Date:** January 2026  
**Product:** BlankLogo - AI Video Watermark Removal Service

---

## Executive Summary

This report analyzes BlankLogo's business economics including:
- Current pricing model and revenue per customer
- Customer Acquisition Cost (CAC) scenarios across ad platforms
- Unit economics and profitability thresholds
- Recommendations for sustainable growth

**Key Findings:**
- Average Revenue Per User (ARPU): **$29-39** (first purchase)
- Target CAC: **$8-15** for profitability
- Recommended monthly ad budget: **$2,000-5,000** initial test phase
- Break-even: **~200 paying customers** at current cost structure

---

## 1. Current Pricing Model

### Credit-Based Pricing Tiers

| Tier | Price | Credits | Price/Credit | Target User |
|------|-------|---------|--------------|-------------|
| **Starter** | $9 | 10 | $0.90 | Casual creators, testers |
| **Pro** | $29 | 50 | $0.58 | Regular content creators |
| **Business** | $79 | 200 | $0.40 | Agencies, power users |

### Revenue Analysis

```
Starter:  $9  / 10 credits  = $0.90/video
Pro:      $29 / 50 credits  = $0.58/video  (35% discount vs Starter)
Business: $79 / 200 credits = $0.40/video  (56% discount vs Starter)
```

### Estimated Tier Distribution (Industry Standard)

| Tier | % of Customers | Revenue Contribution |
|------|---------------|---------------------|
| Starter | 60% | 25% |
| Pro | 30% | 40% |
| Business | 10% | 35% |

### Blended ARPU Calculation

```
Blended First-Purchase ARPU = (0.60 × $9) + (0.30 × $29) + (0.10 × $79)
                            = $5.40 + $8.70 + $7.90
                            = $22.00
```

---

## 2. Customer Acquisition Cost (CAC) Analysis

### 2.1 Ad Platform Benchmarks (SaaS/Creator Tools)

| Platform | Avg CPC | Avg CTR | Conv Rate | Est. CAC |
|----------|---------|---------|-----------|----------|
| **Google Ads** | $2.50-4.00 | 3-5% | 2-4% | $62-200 |
| **Facebook/Meta** | $1.00-2.00 | 0.9-1.5% | 1-3% | $33-222 |
| **TikTok Ads** | $0.50-1.00 | 1-3% | 1-2% | $25-100 |
| **YouTube Ads** | $0.10-0.30 (CPV) | 0.5-1% | 0.5-1% | $10-60 |
| **Reddit Ads** | $0.50-1.50 | 0.5-1% | 0.5-1.5% | $33-300 |
| **Twitter/X Ads** | $0.50-2.00 | 1-3% | 0.5-2% | $25-400 |

### 2.2 Realistic CAC Scenarios for BlankLogo

**Target Audience:** AI video creators (Sora, Runway, Pika users)

#### Scenario A: TikTok Ads (Best Fit - Same Audience)
```
Budget: $1,000/month
CPC: $0.75 average
Clicks: 1,333
Landing Page Conv: 15% (free trial signup)
Signups: 200
Paid Conversion: 10%
Paying Customers: 20

CAC = $1,000 / 20 = $50
```

#### Scenario B: YouTube Pre-roll (AI Video Tutorials)
```
Budget: $1,000/month
CPV: $0.15
Views: 6,667
CTR to site: 2%
Clicks: 133
Signup Rate: 20%
Signups: 27
Paid Conversion: 15%
Paying Customers: 4

CAC = $1,000 / 4 = $250 (expensive but high-intent)
```

#### Scenario C: Reddit (r/StableDiffusion, r/midjourney, r/singularity)
```
Budget: $500/month
CPC: $0.80
Clicks: 625
Signup Rate: 8%
Signups: 50
Paid Conversion: 12%
Paying Customers: 6

CAC = $500 / 6 = $83
```

#### Scenario D: Organic + Influencer Hybrid
```
Budget: $2,000/month (5 micro-influencers @ $400 each)
Reach: 250,000 combined
CTR: 0.5%
Clicks: 1,250
Signup Rate: 25% (trust factor)
Signups: 312
Paid Conversion: 8%
Paying Customers: 25

CAC = $2,000 / 25 = $80
```

---

## 3. Unit Economics

### 3.1 Cost Structure (Estimated)

| Cost Category | Monthly Fixed | Per-Video Variable |
|--------------|---------------|-------------------|
| **Infrastructure** | | |
| - Supabase (DB/Auth/Storage) | $25 | - |
| - Vercel (Frontend) | $20 | - |
| - Railway/Render (API) | $20 | - |
| - FFmpeg Processing (GPU) | - | $0.02-0.05 |
| - Storage (S3/Supabase) | - | $0.01 |
| **Services** | | |
| - Stripe Fees | - | 2.9% + $0.30 |
| - Email (Resend/Postmark) | $20 | $0.001 |
| **Operations** | | |
| - Domain/SSL | $2 | - |
| - Monitoring (Sentry) | $0 (free tier) | - |
| **Total Fixed** | **~$87/month** | |
| **Variable/Video** | | **~$0.05-0.08** |

### 3.2 Gross Margin Analysis

#### Starter Tier ($9 / 10 credits)
```
Revenue:                    $9.00
- Stripe Fee (2.9% + $0.30): -$0.56
- Processing (10 × $0.06):   -$0.60
= Gross Profit:             $7.84
= Gross Margin:             87%
```

#### Pro Tier ($29 / 50 credits)
```
Revenue:                    $29.00
- Stripe Fee (2.9% + $0.30): -$1.14
- Processing (50 × $0.06):   -$3.00
= Gross Profit:             $24.86
= Gross Margin:             86%
```

#### Business Tier ($79 / 200 credits)
```
Revenue:                    $79.00
- Stripe Fee (2.9% + $0.30): -$2.59
- Processing (200 × $0.06):  -$12.00
= Gross Profit:             $64.41
= Gross Margin:             82%
```

### 3.3 Break-Even Analysis

```
Fixed Costs: $87/month
Target Profit Margin: 30%
Average Gross Profit/Customer: $22 (blended)

Break-even Customers = $87 / $22 = 4 customers/month (just to cover infra)

For $5,000/month profit:
  Required Gross Profit = $5,000 + $87 = $5,087
  Required Customers = $5,087 / $22 = 231 customers/month
```

---

## 4. Customer Lifetime Value (LTV)

### 4.1 Retention Assumptions

| Metric | Conservative | Moderate | Optimistic |
|--------|-------------|----------|------------|
| Monthly Churn | 15% | 10% | 5% |
| Avg Lifespan (months) | 6.7 | 10 | 20 |
| Repeat Purchase Rate | 20% | 35% | 50% |
| Avg Purchases/Year | 1.5 | 2.5 | 4 |

### 4.2 LTV Calculations

#### Conservative Scenario
```
First Purchase ARPU: $22
Repeat Rate: 20%
Avg Repeat Value: $29 (Pro tier)
Repeat Purchases: 0.5

LTV = $22 + (0.20 × $29 × 0.5) = $22 + $2.90 = $24.90
```

#### Moderate Scenario
```
First Purchase ARPU: $22
Repeat Rate: 35%
Avg Repeat Value: $35
Repeat Purchases: 1.5

LTV = $22 + (0.35 × $35 × 1.5) = $22 + $18.38 = $40.38
```

#### Optimistic Scenario
```
First Purchase ARPU: $22
Repeat Rate: 50%
Avg Repeat Value: $45
Repeat Purchases: 3

LTV = $22 + (0.50 × $45 × 3) = $22 + $67.50 = $89.50
```

---

## 5. LTV:CAC Ratio Analysis

### Target Ratio: 3:1 or higher (SaaS industry standard)

| Scenario | LTV | Max Profitable CAC | Recommended CAC |
|----------|-----|-------------------|-----------------|
| Conservative | $25 | $8.33 | $5-7 |
| Moderate | $40 | $13.33 | $8-11 |
| Optimistic | $90 | $30.00 | $15-25 |

### Channel Viability Assessment

| Channel | Est. CAC | Viable at Conservative? | Viable at Moderate? |
|---------|----------|------------------------|---------------------|
| TikTok Ads | $50 | ❌ No | ❌ No |
| YouTube | $250 | ❌ No | ❌ No |
| Reddit | $83 | ❌ No | ❌ No |
| Influencer | $80 | ❌ No | ❌ No |
| **Organic/SEO** | $5-10 | ✅ Yes | ✅ Yes |
| **Content Marketing** | $10-20 | ⚠️ Maybe | ✅ Yes |
| **Referral Program** | $5-15 | ✅ Yes | ✅ Yes |

---

## 6. Recommended Growth Strategy

### Phase 1: Foundation (Months 1-3)
**Budget: $500-1,000/month**

1. **Organic SEO** (Primary)
   - Target keywords: "remove sora watermark", "runway watermark remover"
   - Create tutorial content on YouTube
   - Cost: Time investment only

2. **Content Marketing**
   - Post on Reddit communities (organic, not ads)
   - Twitter/X engagement with AI creator community
   - Cost: Time investment only

3. **Referral Program**
   - Give 5 free credits for referrals
   - Referrer gets 5 credits when friend pays
   - Cost: $0.30/credit (processing) = $3 CAC

### Phase 2: Validation (Months 4-6)
**Budget: $2,000-3,000/month**

1. **Micro-Influencer Partnerships**
   - Partner with 3-5 AI tutorial creators
   - Offer affiliate commission (20%)
   - Target CAC: $20-40

2. **Limited Paid Ads Test**
   - TikTok: $500/month (AI creator audience)
   - Google: $500/month (high-intent keywords only)
   - Measure and iterate

### Phase 3: Scale (Months 7-12)
**Budget: $5,000-10,000/month**

1. Double down on winning channels
2. Increase influencer partnerships
3. Consider Product Hunt launch
4. Explore B2B/Agency partnerships

---

## 7. Revenue Projections

### Conservative Growth Scenario

| Month | New Customers | Cumulative | Revenue | Ad Spend | Net |
|-------|--------------|------------|---------|----------|-----|
| 1 | 20 | 20 | $440 | $500 | -$60 |
| 2 | 30 | 45 | $660 | $500 | $160 |
| 3 | 40 | 75 | $880 | $750 | $130 |
| 4 | 60 | 120 | $1,320 | $1,000 | $320 |
| 5 | 80 | 175 | $1,760 | $1,500 | $260 |
| 6 | 100 | 240 | $2,200 | $2,000 | $200 |
| **6-Mo Total** | **330** | | **$7,260** | **$6,250** | **$1,010** |

### Moderate Growth Scenario

| Month | New Customers | Cumulative | Revenue | Ad Spend | Net |
|-------|--------------|------------|---------|----------|-----|
| 1 | 30 | 30 | $660 | $500 | $160 |
| 2 | 50 | 70 | $1,100 | $750 | $350 |
| 3 | 75 | 130 | $1,650 | $1,000 | $650 |
| 4 | 100 | 200 | $2,200 | $1,500 | $700 |
| 5 | 150 | 310 | $3,300 | $2,000 | $1,300 |
| 6 | 200 | 450 | $4,400 | $2,500 | $1,900 |
| **6-Mo Total** | **605** | | **$13,310** | **$8,250** | **$5,060** |

---

## 8. Key Metrics to Track

### Acquisition Metrics
- **CAC by Channel** - Cost per paying customer
- **Conversion Rate** - Visitor → Signup → Paid
- **Time to First Purchase** - Days from signup to payment

### Revenue Metrics
- **ARPU** - Average revenue per user
- **MRR** (if subscription added) - Monthly recurring revenue
- **Revenue by Tier** - Distribution across pricing tiers

### Retention Metrics
- **Repeat Purchase Rate** - % who buy again within 90 days
- **Credit Usage Rate** - % of purchased credits used
- **Churn Rate** - % who don't return

### Unit Economics
- **Gross Margin** - Revenue minus direct costs
- **LTV** - Lifetime value per customer
- **LTV:CAC Ratio** - Profitability indicator

---

## 9. Recommendations

### Immediate Actions

1. **Launch Referral Program**
   - Lowest CAC channel ($3-5)
   - Builds viral loop
   - Implementation: Add referral codes to user dashboard

2. **SEO Investment**
   - Create landing pages for each platform (Sora, Runway, etc.)
   - Target long-tail keywords
   - Blog content: "How to remove watermark from [platform]"

3. **Set Up Analytics**
   - Track conversion funnel in Mixpanel/PostHog
   - Attribution tracking for all channels
   - A/B test pricing page

### Pricing Optimization Opportunities

1. **Add Free Tier** (3-5 free credits)
   - Reduces friction
   - Increases conversion to paid
   - Low cost ($0.30 max)

2. **Consider Subscription Model**
   - Monthly subscription with included credits
   - Higher LTV, more predictable revenue
   - Example: $19/month for 20 credits + rollover

3. **Volume Discounts**
   - Enterprise tier: 500 credits for $149 ($0.30/credit)
   - Attracts agencies, higher ARPU

### Ad Spend Guardrails

| Metric | Red Flag | Action |
|--------|----------|--------|
| CAC > $50 | Stop spend | Pivot to organic |
| Conv Rate < 1% | Pause campaign | Improve landing page |
| LTV:CAC < 2:1 | Reduce budget | Optimize funnel |

---

## 10. Summary

### Business Viability Assessment

| Factor | Status | Notes |
|--------|--------|-------|
| Product-Market Fit | ✅ Strong | Clear pain point, growing market |
| Gross Margins | ✅ Excellent | 82-87% margins |
| Unit Economics | ⚠️ Requires Care | Need CAC < $15 |
| Scalability | ✅ Good | Low marginal costs |
| Competition | ⚠️ Moderate | Free tools exist, but lower quality |

### Key Numbers to Remember

```
Target CAC:         $8-15
First Purchase ARPU: $22
Target LTV:         $40+
Target LTV:CAC:     3:1+
Break-even:         ~200 customers/month
Gross Margin:       85%
```

### Next Steps

1. ✅ Launch with organic/SEO focus
2. ✅ Implement referral program
3. ⏳ Test $500-1000/month in TikTok ads
4. ⏳ Partner with 3-5 micro-influencers
5. ⏳ Add free tier to pricing model
6. ⏳ Consider subscription option

---

*Report generated: January 2026*  
*Review quarterly and update assumptions based on actual data*

# Analytics Integration

BlankLogo integrates with multiple analytics platforms for comprehensive tracking.

## Platforms

| Platform | Type | Purpose |
|----------|------|---------|
| **Meta Pixel** | Client + Server | Ad attribution, conversion tracking |
| **Google Analytics 4** | Client | Traffic analysis, user behavior |
| **PostHog** | Client | Product analytics, feature flags, session recording |

## Environment Variables

```env
# Frontend (apps/web/.env.local)

# Meta Pixel
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id

# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

```env
# API (apps/api/.env)

# Meta Conversions API (server-side)
META_PIXEL_ID=your_pixel_id
META_ACCESS_TOKEN=your_access_token
META_TEST_EVENT_CODE=TEST12345  # Optional
```

## Setup

### Google Analytics 4

1. Go to [Google Analytics](https://analytics.google.com)
2. Create property → Web stream
3. Copy **Measurement ID** (starts with `G-`)
4. Add to `NEXT_PUBLIC_GA_MEASUREMENT_ID`

### PostHog

1. Go to [PostHog](https://posthog.com)
2. Create project
3. Copy **Project API Key** (starts with `phc_`)
4. Add to `NEXT_PUBLIC_POSTHOG_KEY`
5. Set `NEXT_PUBLIC_POSTHOG_HOST` (US: `https://us.i.posthog.com`, EU: `https://eu.i.posthog.com`)

### Meta Pixel

See `docs/META_ADS_INTEGRATION.md` for detailed setup.

## Events Tracked

### E-commerce Funnel

| Event | Trigger | Platforms |
|-------|---------|-----------|
| `PageView` | Route change | All |
| `ViewContent` | Credits page | Meta, GA |
| `AddToCart` | Pack selected | All |
| `InitiateCheckout` | Checkout started | All |
| `Purchase` | Payment success | All |

### User Events

| Event | Trigger | Platforms |
|-------|---------|-----------|
| `SignUp` | Registration complete | GA, PostHog |
| `Login` | User logs in | GA, PostHog |

### Product Events

| Event | Trigger | Platforms |
|-------|---------|-----------|
| `job_created` | Job submitted | GA, PostHog |
| `job_completed` | Job finished | GA, PostHog |

## Usage

### Basic Tracking

```typescript
import * as ga from '@/lib/google-analytics';
import * as ph from '@/lib/posthog';
import { trackEvent } from '@/lib/meta-pixel';

// Track custom event
ga.trackEvent('button_click', 'engagement', 'hero_cta');
ph.trackEvent('button_click', { location: 'hero' });
trackEvent('CustomEvent', { content_name: 'hero_cta' });
```

### E-commerce Tracking

```typescript
// Track purchase
ga.trackCreditPurchase({
  packId: 'pack_50',
  packName: '50 Credits',
  price: 35,
  credits: 50,
  transactionId: 'order_123',
});

ph.trackCreditPurchase({
  packId: 'pack_50',
  packName: '50 Credits',
  price: 35,
  credits: 50,
  orderId: 'order_123',
});
```

### User Identification

```typescript
// After login
ga.setUserId(user.id);
ph.identify(user.id, { email: user.email });

// After logout
ph.reset();
```

### Feature Flags (PostHog)

```typescript
import { isFeatureEnabled, getFeatureFlag } from '@/lib/posthog';

// Boolean flag
if (isFeatureEnabled('new-pricing-page')) {
  // Show new pricing
}

// Multivariate flag
const variant = getFeatureFlag('checkout-button-color');
// 'blue' | 'green' | 'red'
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
├─────────────────────────────────────────────────────────┤
│  AnalyticsProvider                                      │
│  ├── initGA()      → Google Analytics 4                 │
│  ├── initPostHog() → PostHog                            │
│  └── MetaPixelProvider                                  │
│      └── initMetaPixel() → Meta Pixel                   │
├─────────────────────────────────────────────────────────┤
│  Credits Page                                           │
│  ├── trackViewContent()                                 │
│  ├── trackAddToCart()                                   │
│  ├── trackBeginCheckout()                               │
│  └── trackPurchase()                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Server                             │
├─────────────────────────────────────────────────────────┤
│  Stripe Webhook                                         │
│  └── metaConversions.trackCreditPurchase()              │
│      → Meta Conversions API (server-side)               │
└─────────────────────────────────────────────────────────┘
```

## Testing

### Google Analytics

1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger)
2. Open browser console
3. Events appear in Realtime → Events

### PostHog

1. Open PostHog dashboard
2. Go to Activity → Live Events
3. Events appear in real-time

### Meta Pixel

1. Install [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper)
2. Open Events Manager → Test Events
3. See `docs/META_ADS_INTEGRATION.md`

## Privacy

All platforms respect:
- User consent preferences
- Do Not Track headers (configurable)
- GDPR/CCPA compliance settings

### Disable Tracking

```typescript
// PostHog
import posthog from 'posthog-js';
posthog.opt_out_capturing();

// GA4 - handled via Google consent mode
```

## Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/google-analytics.ts` | GA4 client library |
| `apps/web/src/lib/posthog.ts` | PostHog client library |
| `apps/web/src/lib/meta-pixel.ts` | Meta Pixel client library |
| `apps/api/src/meta-conversions.ts` | Meta CAPI server library |
| `apps/web/src/components/analytics-provider.tsx` | GA + PostHog provider |
| `apps/web/src/components/meta-pixel-provider.tsx` | Meta Pixel provider |

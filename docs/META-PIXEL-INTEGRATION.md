# Meta Pixel & Conversions API Integration

## Overview

BlankLogo uses Meta Pixel (client-side) and Conversions API (server-side) for tracking user actions and optimizing Meta ad campaigns.

## Configuration

### Environment Variables

```bash
# Client-side Pixel (public)
NEXT_PUBLIC_META_PIXEL_ID=10039038026189444

# Server-side Conversions API (secret)
META_CAPI_ACCESS_TOKEN=EAAOhwkTLb4MBQ...  # Dataset Quality API token
```

### Meta Business Manager Details

| Field | Value |
|-------|-------|
| **Dataset Name** | Dupree Ops Meta Pixel |
| **Dataset ID** | `10039038026189444` |
| **Ad Account** | Dupree Ops Ads (`120226380372710481`) |
| **Business Manager** | TechMeStuff (`3364807517151319`) |

---

## Client-Side Tracking (Meta Pixel)

### Implementation

The Meta Pixel base code is loaded in `apps/web/src/app/layout.tsx` using Next.js Script component:

```tsx
import Script from "next/script";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "10039038026189444";

// In the body:
<Script id="meta-pixel" strategy="afterInteractive">
  {`
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${META_PIXEL_ID}');
    fbq('track', 'PageView');
  `}
</Script>
```

### Standard Events Tracked

| Event | When Fired | Location |
|-------|------------|----------|
| `PageView` | Every page load | Automatic (layout.tsx) |
| `ViewContent` | Landing, pricing, features pages | Page components |
| `Lead` | Signup form submission | Signup page |
| `CompleteRegistration` | Account created | Post-signup |
| `InitiateCheckout` | Start Stripe checkout | Credits page |
| `Purchase` | Credit pack purchased | Stripe webhook |
| `Subscribe` | Subscription activated | Stripe webhook |

### Custom Events

| Event | When Fired | Purpose |
|-------|------------|---------|
| `GenerateRequested` | User clicks "Remove Watermark" | Track intent |
| `JobStarted` | Job status → processing | Track engagement |
| `MediaReady` | Job completed | Track value delivery |
| `Download` | User downloads artifact | Track conversion |

### Usage Example

```typescript
import { trackViewPricing, trackStartCheckout, trackCreditPurchase } from '@/lib/meta-pixel';

// Track pricing page view
trackViewPricing();

// Track checkout start (returns event_id for CAPI dedup)
const eventId = trackStartCheckout({
  packId: 'credits_10',
  packName: '10 Credits',
  price: 9.99,
  credits: 10,
});

// Track purchase (after webhook confirms)
trackCreditPurchase({
  packId: 'credits_10',
  packName: '10 Credits',
  price: 9.99,
  credits: 10,
  orderId: 'pi_xxx',
});
```

---

## Server-Side Tracking (Conversions API)

### Why CAPI?

- **iOS 14.5+**: Client-side tracking is limited by ATT
- **Ad Blockers**: Many users block fbevents.js
- **Attribution**: Server events are more reliable for conversion optimization
- **Deduplication**: Use `event_id` to prevent double-counting

### API Endpoint

```
POST https://graph.facebook.com/v18.0/{PIXEL_ID}/events
```

### Request Format

```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1704931200,
    "action_source": "website",
    "event_source_url": "https://www.blanklogo.app/app/credits",
    "event_id": "purchase_abc123",
    "user_data": {
      "em": ["hashed_email"],
      "ph": ["hashed_phone"],
      "client_ip_address": "1.2.3.4",
      "client_user_agent": "Mozilla/5.0...",
      "fbc": "_fbc cookie value",
      "fbp": "_fbp cookie value"
    },
    "custom_data": {
      "currency": "USD",
      "value": 9.99,
      "content_name": "10 Credits Pack",
      "content_ids": ["credits_10"],
      "content_type": "product"
    }
  }],
  "access_token": "EAAOhwkTLb4MBQ..."
}
```

### Implementation Location

Server-side events are sent from:
- `apps/web/src/app/api/stripe/webhook/route.ts` - Purchase, Subscribe events
- `apps/api/src/routes/jobs.ts` - Job completion events
- `packages/workers/src/job-processor.ts` - Processing events

### CAPI Helper

```typescript
// apps/web/src/lib/meta-capi.ts

export async function sendServerEvent(event: MetaServerEvent) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [event],
        access_token: process.env.META_CAPI_ACCESS_TOKEN,
      }),
    }
  );
  return response.json();
}
```

---

## Event Deduplication

To prevent double-counting when both Pixel and CAPI fire:

1. **Generate unique `event_id`** on client before action
2. **Pass `event_id`** to both Pixel and server
3. **Include same `event_id`** in CAPI request
4. Meta automatically deduplicates within 48-hour window

```typescript
// Client-side
const eventId = generateEventId('purchase');
trackPurchase({ ...params, event_id: eventId });

// Pass eventId to server via Stripe metadata
const session = await stripe.checkout.sessions.create({
  metadata: { meta_event_id: eventId },
  ...
});

// Server-side (webhook)
await sendServerEvent({
  event_name: 'Purchase',
  event_id: metadata.meta_event_id,
  ...
});
```

---

## Testing

### Test Event Code

Use test events to verify setup without affecting production data:

```bash
# Current test code (regenerates periodically)
TEST_EVENT_CODE=TEST54053
```

### Send Test Event via cURL

```bash
curl -X POST "https://graph.facebook.com/v18.0/10039038026189444/events" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "event_name": "PageView",
      "event_time": '"$(date +%s)"',
      "action_source": "website",
      "event_source_url": "https://www.blanklogo.app",
      "user_data": {
        "client_ip_address": "1.2.3.4",
        "client_user_agent": "Mozilla/5.0 Test"
      }
    }],
    "test_event_code": "TEST54053",
    "access_token": "$META_CAPI_ACCESS_TOKEN"
  }'
```

### Verify in Events Manager

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager)
2. Select "Dupree Ops Meta Pixel" dataset
3. Click "Test Events" tab
4. Enter website URL or check server events
5. Verify events appear with correct parameters

---

## Verified Events (Jan 11, 2026)

| Event | Source | Status |
|-------|--------|--------|
| PageView | Server | ✅ Processed |
| Lead | Server | ✅ Processed |
| CompleteRegistration | Server | ✅ Processed |
| Purchase | Server | ✅ Processed |

---

## Troubleshooting

### Pixel Not Firing

1. Check browser console for `fbq` function
2. Verify `NEXT_PUBLIC_META_PIXEL_ID` is set
3. Check for ad blockers
4. Use Meta Pixel Helper extension

### CAPI Events Not Received

1. Verify `META_CAPI_ACCESS_TOKEN` is valid
2. Check API response for errors
3. Ensure `event_time` is within 7 days
4. Verify dataset ID matches

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid OAuth access token` | Token expired | Regenerate in Events Manager |
| `Object does not exist` | Wrong pixel/dataset ID | Verify ID in dashboard |
| `event_time too old` | Timestamp > 7 days old | Use current timestamp |

---

## Resources

- [Meta Pixel Documentation](https://developers.facebook.com/docs/meta-pixel)
- [Conversions API Guide](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Events Manager](https://business.facebook.com/events_manager)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer)

# Meta Ads Integration

BlankLogo integrates with Meta Ads (Facebook/Instagram) for conversion tracking and attribution.

## Overview

The integration consists of two parts:
1. **Meta Pixel (Client-side)** - Tracks user interactions in the browser
2. **Meta Conversions API (Server-side)** - Sends conversion events from the server (more reliable)

## Setup

### 1. Get Your Pixel ID and Access Token

1. Go to [Meta Events Manager](https://business.facebook.com/events_manager)
2. Create or select your Pixel
3. Copy your **Pixel ID** (a numeric ID like `123456789012345`)
4. Generate an **Access Token** in Settings → Conversions API

### 2. Environment Variables

**Frontend (apps/web/.env.local):**
```env
# Meta Pixel ID (client-side)
NEXT_PUBLIC_META_PIXEL_ID=your_pixel_id_here
```

**API (apps/api/.env):**
```env
# Meta Conversions API (server-side)
META_PIXEL_ID=your_pixel_id_here
META_ACCESS_TOKEN=your_access_token_here

# Optional: Test Event Code (for debugging in Events Manager)
META_TEST_EVENT_CODE=TEST12345
```

## Events Tracked

### Client-Side (Meta Pixel)

| Event | When Fired | Parameters |
|-------|------------|------------|
| `PageView` | Every page navigation | - |
| `ViewContent` | Credits page viewed | content_name, content_category |
| `AddToCart` | Credit pack selected | content_ids, value, currency |
| `InitiateCheckout` | Checkout started | content_ids, value, currency |
| `Purchase` | Payment success | content_ids, value, currency, order_id |
| `Lead` | User signs up | content_name |
| `CompleteRegistration` | Signup complete | status |

### Server-Side (Conversions API)

| Event | When Fired | User Data |
|-------|------------|-----------|
| `Purchase` | Stripe webhook success | email, external_id, IP, user_agent |
| `InitiateCheckout` | Checkout session created | email, external_id, IP, user_agent |
| `CompleteRegistration` | User signup | email, external_id, IP, user_agent |

## Usage

### Client-Side Tracking

```typescript
import { 
  trackViewContent, 
  trackAddToCart, 
  trackPurchase,
  trackCustomEvent 
} from '@/lib/meta-pixel';

// Track content view
trackViewContent({
  contentName: 'Pricing Page',
  contentCategory: 'pricing',
});

// Track add to cart
trackAddToCart({
  contentName: '50 Credits',
  contentId: 'pack_50',
  value: 35,
  quantity: 1,
});

// Track purchase
trackPurchase({
  contentIds: ['pack_50'],
  value: 35,
  orderId: 'order_123',
});

// Custom event
trackCustomEvent('JobCreated', {
  content_category: 'watermark_removal',
  content_name: 'sora',
});
```

### Server-Side Tracking

```typescript
import metaConversions from './meta-conversions';

// Track purchase (from Stripe webhook)
await metaConversions.trackCreditPurchase({
  userId: 'user_123',
  email: 'user@example.com',
  packId: 'pack_50',
  packName: '50 Credits',
  price: 35,
  credits: 50,
  orderId: 'stripe_session_id',
  clientIp: req.ip,
  userAgent: req.headers['user-agent'],
  fbc: req.cookies._fbc,
  fbp: req.cookies._fbp,
});

// Track user signup
await metaConversions.trackUserSignup({
  userId: 'user_123',
  email: 'user@example.com',
  clientIp: req.ip,
  userAgent: req.headers['user-agent'],
});
```

## Testing

### Test Mode

Set `META_TEST_EVENT_CODE` to a test code from Events Manager to send events in test mode:
1. Go to Events Manager → Test Events
2. Copy the test code
3. Add to your `.env`: `META_TEST_EVENT_CODE=TEST12345`

### Verify Events

1. Open [Events Manager → Test Events](https://business.facebook.com/events_manager)
2. Trigger events in your app
3. Events should appear in the "Test Events" tab within 20 seconds

### Debug Mode

Set `debug: true` in tracking calls to see console output:

```typescript
trackPurchase({ ... }, true); // true enables debug logging
```

## Deduplication

Events sent from both client (Pixel) and server (CAPI) are deduplicated by Meta using:
- `event_id` - Unique ID per event
- `event_time` - Timestamp (within 48 hours)

The server-side events include an `event_id` that should match the client-side event for proper deduplication.

## Privacy

User data sent to Meta is hashed (SHA-256) before transmission:
- Email addresses
- Phone numbers
- Names
- Addresses
- External IDs

Only IP addresses and user agents are sent unhashed (required for attribution).

## Troubleshooting

### Events Not Showing

1. Check Pixel ID is correct
2. Verify Access Token hasn't expired
3. Check browser console for errors
4. Use Test Events mode to verify

### Purchase Events Missing

1. Ensure server-side tracking is configured
2. Check Stripe webhook is calling the right endpoint
3. Verify `fbc` and `fbp` cookies are being passed

### Low Match Rate

To improve match rate:
- Send email when available
- Include `fbc` and `fbp` cookies from the browser
- Send IP address and user agent

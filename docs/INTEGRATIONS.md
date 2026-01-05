# BlankLogo External Integrations

> **Last Updated:** January 4, 2026

This document covers the setup and configuration of external service integrations.

---

## 📋 Table of Contents

1. [Stripe Payments](#stripe-payments)
2. [Resend Email](#resend-email)
3. [Meta Ads (Facebook Pixel)](#meta-ads)
4. [Supabase](#supabase)

---

## 💳 Stripe Payments

### Overview

BlankLogo uses Stripe for:
- One-time credit pack purchases
- Subscription billing
- Customer portal for managing subscriptions

### Webhook Configuration

**Production Webhook URL:**
```
https://www.blanklogo.app/api/stripe/webhook
```

**Events to Subscribe:**
| Event | Description |
|-------|-------------|
| `checkout.session.completed` | Customer completes checkout - triggers credit addition |
| `invoice.paid` | Subscription invoice paid - triggers monthly credits |
| `customer.subscription.deleted` | Subscription canceled - updates user status |

### Setup Steps

1. **Go to Stripe Dashboard:**
   ```
   https://dashboard.stripe.com/webhooks
   ```

2. **Add Endpoint:**
   - Click "Add endpoint"
   - Endpoint URL: `https://www.blanklogo.app/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `invoice.paid`
     - `customer.subscription.deleted`

3. **Copy Webhook Secret:**
   - After creating, click the endpoint
   - Copy the "Signing secret" (starts with `whsec_`)
   - Add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

4. **Test the Webhook:**
   ```bash
   # Using Stripe CLI
   stripe listen --forward-to localhost:3939/api/stripe/webhook
   stripe trigger checkout.session.completed
   ```

### Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Vercel, Render | Stripe secret API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Vercel | Webhook signing secret |

### Credit Packs Configuration

Located in `apps/web/src/lib/stripe.ts`:

```typescript
export const CREDITS_BY_PACK = {
  starter_pack: 10,
  pro_pack: 50,
  business_pack: 200,
};

export const CREDITS_BY_SUBSCRIPTION = {
  pro_monthly: 100,
  business_monthly: 500,
};
```

---

## 📧 Resend Email

### Overview

Resend handles all transactional emails:
- Welcome sequence (Day 0, Day 3, Day 7)
- Job completion notifications
- Low credits warnings
- Re-engagement emails

### Email Templates

| Template | Trigger | Description |
|----------|---------|-------------|
| `welcome` | Signup | Welcome email with getting started guide |
| `day3_education` | Day 3 | Educational content about features |
| `day7_social_proof` | Day 7 | Social proof and success stories |
| `job_completed` | Job done | Download link and next steps |
| `low_credits` | Credits < 3 | Reminder to buy more credits |
| `reengagement` | 14 days inactive | Win-back email |

### Setup Steps

1. **Create Resend Account:**
   ```
   https://resend.com/signup
   ```

2. **Verify Domain:**
   - Go to Resend Dashboard → Domains
   - Add `blanklogo.app` (or your domain)
   - Add the DNS records provided

3. **Get API Key:**
   - Go to API Keys → Create API Key
   - Copy the key (starts with `re_`)

4. **Configure Environment:**
   ```
   RESEND_API_KEY=re_xxxxx
   RESEND_FROM=BlankLogo <hello@blanklogo.app>
   ```

### Test Emails

**Test Endpoint:**
```bash
# Test all email templates
curl -X POST https://www.blanklogo.app/api/test/emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{"email": "test@example.com", "template": "all"}'

# Test specific template
curl -X POST https://www.blanklogo.app/api/test/emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{"email": "test@example.com", "template": "welcome", "userName": "John"}'
```

### Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Vercel, Render | Resend API key |
| `RESEND_FROM` | Vercel | From address (optional, defaults to `BlankLogo <hello@blanklogo.com>`) |

---

## 📊 Meta Ads (Facebook Pixel)

### Overview

Meta Pixel tracks:
- Page views
- User signups (Lead, CompleteRegistration)
- Credit purchases (AddToCart, InitiateCheckout, Purchase)
- Job creation (custom events)

### Events Tracked

| Event | Trigger | Parameters |
|-------|---------|------------|
| `PageView` | Every page | Automatic |
| `ViewContent` | View pricing page | content_name, content_category |
| `Lead` | Email signup | - |
| `CompleteRegistration` | Complete signup | status |
| `AddToCart` | Select credit pack | content_id, value, currency |
| `InitiateCheckout` | Start Stripe checkout | content_ids, value |
| `Purchase` | Complete purchase | content_ids, value, currency |
| `JobCreated` (custom) | Create job | platform, processing_mode |

### Setup Steps

1. **Create Meta Pixel:**
   - Go to [Meta Events Manager](https://business.facebook.com/events_manager)
   - Click "Connect Data Sources" → "Web"
   - Create a new pixel named "BlankLogo"
   - Copy the Pixel ID

2. **Configure Environment:**
   ```
   NEXT_PUBLIC_META_PIXEL_ID=123456789012345
   ```

3. **Verify Installation:**
   - Install [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper) Chrome extension
   - Visit your site
   - Check that PageView events are firing

### Integration Code

The pixel is automatically loaded via `MetaPixelProvider` in the app layout.

**Track Events in Components:**
```typescript
import { 
  trackViewPricing, 
  trackSelectCreditPack,
  trackStartCheckout,
  trackCreditPurchase 
} from '@/lib/meta-pixel';

// On pricing page view
trackViewPricing();

// On credit pack selection
trackSelectCreditPack({
  packName: 'Pro Pack',
  packId: 'pro_pack',
  price: 29.99,
  credits: 50,
});

// On checkout start
trackStartCheckout({
  packId: 'pro_pack',
  price: 29.99,
  credits: 50,
});

// On successful purchase
trackCreditPurchase({
  packId: 'pro_pack',
  packName: 'Pro Pack',
  price: 29.99,
  credits: 50,
  orderId: 'ord_123',
});
```

### Conversions API (Server-Side)

For better attribution, implement server-side events:

```typescript
// In API routes
import { hash } from 'crypto';

async function sendServerEvent(event: {
  event_name: string;
  event_time: number;
  user_data: {
    em?: string; // hashed email
    client_ip_address?: string;
    client_user_agent?: string;
  };
  custom_data?: Record<string, unknown>;
}) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [event],
        access_token: process.env.META_CONVERSIONS_API_TOKEN,
      }),
    }
  );
  return response.json();
}
```

### Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_META_PIXEL_ID` | Vercel | Meta Pixel ID |
| `META_CONVERSIONS_API_TOKEN` | Vercel | (Optional) Server-side events token |

---

## 🗄️ Supabase

### Overview

Supabase provides:
- PostgreSQL database
- User authentication
- Object storage (videos)
- Row Level Security (RLS)

### Configuration

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Supabase setup.

### Environment Variables

| Variable | Platform | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel, Render | Service role key (server-side only) |
| `SUPABASE_URL` | Render | Same as NEXT_PUBLIC_SUPABASE_URL |

---

## ✅ Integration Checklist

### Stripe
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] `STRIPE_SECRET_KEY` set in Vercel
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set in Vercel
- [ ] `STRIPE_WEBHOOK_SECRET` set in Vercel
- [ ] Test webhook with Stripe CLI

### Resend
- [ ] Domain verified in Resend
- [ ] `RESEND_API_KEY` set in Vercel and Render
- [ ] Test emails sent successfully

### Meta Ads
- [ ] Pixel created in Meta Events Manager
- [ ] `NEXT_PUBLIC_META_PIXEL_ID` set in Vercel
- [ ] Pixel Helper shows events firing
- [ ] (Optional) Conversions API configured

### Supabase
- [ ] Project created
- [ ] All environment variables set
- [ ] Auth redirect URLs configured
- [ ] Storage buckets created

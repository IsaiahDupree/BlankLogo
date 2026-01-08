/**
 * Meta Conversions API (CAPI) - Server-side tracking
 * 
 * Used for reliable Purchase/Subscribe tracking from Stripe webhooks.
 * Must use same event_id as client-side Pixel for deduplication.
 * 
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
const API_VERSION = 'v18.0';

interface CAPIEventData {
  event_name: string;
  event_time: number;
  event_id: string; // Must match client-side for dedup
  event_source_url?: string;
  action_source: 'website';
  user_data: {
    em?: string[]; // Hashed email
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
    external_id?: string[]; // Your user ID (hashed)
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_name?: string;
    content_type?: string;
    num_items?: number;
    order_id?: string;
    predicted_ltv?: number;
  };
}

// SHA-256 hash for user data (Meta requires hashed PII)
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Send event to Meta CAPI
export async function sendCAPIEvent(eventData: CAPIEventData): Promise<boolean> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.log('[CAPI] Skipping - no PIXEL_ID or ACCESS_TOKEN configured');
    return false;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
        access_token: ACCESS_TOKEN,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`[CAPI] ✅ ${eventData.event_name} sent successfully`, result);
      return true;
    } else {
      console.error(`[CAPI] ❌ ${eventData.event_name} failed:`, result);
      return false;
    }
  } catch (error) {
    console.error(`[CAPI] ❌ Network error:`, error);
    return false;
  }
}

// Track Purchase event (one-time credit pack)
export async function trackPurchaseCAPI(params: {
  eventId: string;
  userId: string;
  email?: string;
  value: number;
  currency?: string;
  contentIds: string[];
  contentName: string;
  orderId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  const hashedEmail = params.email ? [await sha256(params.email)] : undefined;
  const hashedUserId = [await sha256(params.userId)];

  return sendCAPIEvent({
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: 'website',
    user_data: {
      em: hashedEmail,
      external_id: hashedUserId,
      client_ip_address: params.ipAddress,
      client_user_agent: params.userAgent,
    },
    custom_data: {
      value: params.value,
      currency: params.currency || 'USD',
      content_ids: params.contentIds,
      content_name: params.contentName,
      content_type: 'product',
      num_items: 1,
      order_id: params.orderId,
    },
  });
}

// Track Subscribe event (subscription)
export async function trackSubscribeCAPI(params: {
  eventId: string;
  userId: string;
  email?: string;
  value: number;
  currency?: string;
  contentIds: string[];
  contentName: string;
  predictedLtv?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<boolean> {
  const hashedEmail = params.email ? [await sha256(params.email)] : undefined;
  const hashedUserId = [await sha256(params.userId)];

  return sendCAPIEvent({
    event_name: 'Subscribe',
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    action_source: 'website',
    user_data: {
      em: hashedEmail,
      external_id: hashedUserId,
      client_ip_address: params.ipAddress,
      client_user_agent: params.userAgent,
    },
    custom_data: {
      value: params.value,
      currency: params.currency || 'USD',
      content_ids: params.contentIds,
      content_name: params.contentName,
      content_type: 'product',
      predicted_ltv: params.predictedLtv,
    },
  });
}

// Generate event_id for CAPI (same format as client-side)
export function generateEventId(prefix: string = 'evt'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

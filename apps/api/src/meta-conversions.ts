/**
 * Meta Conversions API (Server-Side)
 * 
 * Server-side event tracking for Meta Ads
 * More reliable than client-side pixel for purchase/conversion events
 * 
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import crypto from 'crypto';

// Configuration
const PIXEL_ID = process.env.META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const API_VERSION = 'v18.0';
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || ''; // For testing

// Types
export interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string; // Facebook click ID from _fbc cookie
  fbp?: string; // Facebook browser ID from _fbp cookie
}

export interface CustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: string;
  numItems?: number;
  orderId?: string;
  status?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    itemPrice?: number;
  }>;
}

export interface ServerEvent {
  eventName: string;
  eventTime: number;
  eventId?: string;
  eventSourceUrl?: string;
  actionSource: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  userData: UserData;
  customData?: CustomData;
}

// Hash function for PII (Meta requires SHA-256 hashing)
function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// Normalize and hash user data
function normalizeUserData(userData: UserData): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (userData.email) {
    normalized.em = hashValue(userData.email);
  }
  if (userData.phone) {
    // Remove all non-digits
    const phone = userData.phone.replace(/\D/g, '');
    normalized.ph = hashValue(phone);
  }
  if (userData.firstName) {
    normalized.fn = hashValue(userData.firstName);
  }
  if (userData.lastName) {
    normalized.ln = hashValue(userData.lastName);
  }
  if (userData.city) {
    normalized.ct = hashValue(userData.city);
  }
  if (userData.state) {
    normalized.st = hashValue(userData.state.toLowerCase());
  }
  if (userData.zipCode) {
    normalized.zp = hashValue(userData.zipCode);
  }
  if (userData.country) {
    normalized.country = hashValue(userData.country.toLowerCase());
  }
  if (userData.externalId) {
    normalized.external_id = hashValue(userData.externalId);
  }
  if (userData.clientIpAddress) {
    normalized.client_ip_address = userData.clientIpAddress;
  }
  if (userData.clientUserAgent) {
    normalized.client_user_agent = userData.clientUserAgent;
  }
  if (userData.fbc) {
    normalized.fbc = userData.fbc;
  }
  if (userData.fbp) {
    normalized.fbp = userData.fbp;
  }

  return normalized;
}

// Format custom data
function formatCustomData(customData: CustomData): Record<string, unknown> {
  const formatted: Record<string, unknown> = {};

  if (customData.value !== undefined) {
    formatted.value = customData.value;
  }
  if (customData.currency) {
    formatted.currency = customData.currency;
  }
  if (customData.contentName) {
    formatted.content_name = customData.contentName;
  }
  if (customData.contentCategory) {
    formatted.content_category = customData.contentCategory;
  }
  if (customData.contentIds) {
    formatted.content_ids = customData.contentIds;
  }
  if (customData.contentType) {
    formatted.content_type = customData.contentType;
  }
  if (customData.numItems !== undefined) {
    formatted.num_items = customData.numItems;
  }
  if (customData.orderId) {
    formatted.order_id = customData.orderId;
  }
  if (customData.status) {
    formatted.status = customData.status;
  }
  if (customData.contents) {
    formatted.contents = customData.contents.map(c => ({
      id: c.id,
      quantity: c.quantity,
      item_price: c.itemPrice,
    }));
  }

  return formatted;
}

// Send event to Meta Conversions API
export async function sendEvent(event: ServerEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn('[Meta CAPI] Missing PIXEL_ID or ACCESS_TOKEN');
    return { success: false, error: 'Meta Conversions API not configured' };
  }

  const eventId = event.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  const payload = {
    data: [{
      event_name: event.eventName,
      event_time: event.eventTime,
      event_id: eventId,
      event_source_url: event.eventSourceUrl,
      action_source: event.actionSource,
      user_data: normalizeUserData(event.userData),
      custom_data: event.customData ? formatCustomData(event.customData) : undefined,
    }],
    ...(TEST_EVENT_CODE && { test_event_code: TEST_EVENT_CODE }),
  };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as { error?: { message?: string } };

    if (!response.ok) {
      console.error('[Meta CAPI] Error:', result);
      return { success: false, error: result.error?.message || 'Unknown error' };
    }

    console.log('[Meta CAPI] Event sent:', event.eventName, eventId);
    return { success: true, eventId };
  } catch (error) {
    console.error('[Meta CAPI] Request failed:', error);
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// STANDARD EVENT HELPERS
// ═══════════════════════════════════════════════════════════════════

// Track Purchase event (server-side)
export async function trackPurchase(params: {
  userData: UserData;
  value: number;
  currency?: string;
  contentIds: string[];
  contentName?: string;
  orderId?: string;
  numItems?: number;
  eventSourceUrl?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return sendEvent({
    eventName: 'Purchase',
    eventTime: Math.floor(Date.now() / 1000),
    actionSource: 'website',
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: {
      value: params.value,
      currency: params.currency || 'USD',
      contentIds: params.contentIds,
      contentName: params.contentName,
      orderId: params.orderId,
      numItems: params.numItems || 1,
      contentType: 'product',
    },
  });
}

// Track InitiateCheckout event (server-side)
export async function trackInitiateCheckout(params: {
  userData: UserData;
  value: number;
  currency?: string;
  contentIds: string[];
  numItems?: number;
  eventSourceUrl?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return sendEvent({
    eventName: 'InitiateCheckout',
    eventTime: Math.floor(Date.now() / 1000),
    actionSource: 'website',
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: {
      value: params.value,
      currency: params.currency || 'USD',
      contentIds: params.contentIds,
      numItems: params.numItems || 1,
      contentType: 'product',
    },
  });
}

// Track Lead event (server-side)
export async function trackLead(params: {
  userData: UserData;
  contentName?: string;
  value?: number;
  eventSourceUrl?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return sendEvent({
    eventName: 'Lead',
    eventTime: Math.floor(Date.now() / 1000),
    actionSource: 'website',
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: params.value ? {
      value: params.value,
      currency: 'USD',
      contentName: params.contentName,
    } : undefined,
  });
}

// Track CompleteRegistration event (server-side)
export async function trackCompleteRegistration(params: {
  userData: UserData;
  status?: string;
  eventSourceUrl?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return sendEvent({
    eventName: 'CompleteRegistration',
    eventTime: Math.floor(Date.now() / 1000),
    actionSource: 'website',
    eventSourceUrl: params.eventSourceUrl,
    userData: params.userData,
    customData: {
      status: params.status || 'complete',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// BLANKLOGO-SPECIFIC EVENTS
// ═══════════════════════════════════════════════════════════════════

// Track credit pack purchase
export async function trackCreditPurchase(params: {
  userId: string;
  email?: string;
  packId: string;
  packName: string;
  price: number;
  credits: number;
  orderId?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return trackPurchase({
    userData: {
      externalId: params.userId,
      email: params.email,
      clientIpAddress: params.clientIp,
      clientUserAgent: params.userAgent,
      fbc: params.fbc,
      fbp: params.fbp,
    },
    value: params.price,
    currency: 'USD',
    contentIds: [params.packId],
    contentName: params.packName,
    orderId: params.orderId,
    numItems: 1,
    eventSourceUrl: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/app/credits` : undefined,
  });
}

// Track checkout initiated
export async function trackCheckoutStarted(params: {
  userId: string;
  email?: string;
  packId: string;
  price: number;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return trackInitiateCheckout({
    userData: {
      externalId: params.userId,
      email: params.email,
      clientIpAddress: params.clientIp,
      clientUserAgent: params.userAgent,
      fbc: params.fbc,
      fbp: params.fbp,
    },
    value: params.price,
    currency: 'USD',
    contentIds: [params.packId],
    numItems: 1,
    eventSourceUrl: process.env.APP_BASE_URL ? `${process.env.APP_BASE_URL}/app/credits` : undefined,
  });
}

// Track user signup
export async function trackUserSignup(params: {
  userId: string;
  email?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  return trackCompleteRegistration({
    userData: {
      externalId: params.userId,
      email: params.email,
      clientIpAddress: params.clientIp,
      clientUserAgent: params.userAgent,
      fbc: params.fbc,
      fbp: params.fbp,
    },
    status: 'complete',
    eventSourceUrl: process.env.APP_BASE_URL,
  });
}

// Check if Meta CAPI is configured
export function isConfigured(): boolean {
  return !!(PIXEL_ID && ACCESS_TOKEN);
}

export default {
  sendEvent,
  trackPurchase,
  trackInitiateCheckout,
  trackLead,
  trackCompleteRegistration,
  trackCreditPurchase,
  trackCheckoutStarted,
  trackUserSignup,
  isConfigured,
};

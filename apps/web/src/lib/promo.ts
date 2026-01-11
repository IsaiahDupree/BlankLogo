import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';

const PROMO_JWT_SECRET = process.env.PROMO_JWT_SECRET || 'blanklogo-promo-secret-change-in-production';
const PROMO_COOKIE_NAME = 'bl_promo_token';
const DEFAULT_EXPIRY_DAYS = 7;

export interface PromoTokenPayload {
  campaign_id: string;
  issued_at: number;
  expires_at: number;
  nonce: string;
  ip_hash?: string;
  ua_hash?: string;
  utm_source?: string;
  utm_campaign?: string;
  fbclid?: string;
}

/**
 * Create a signed promo JWT token
 */
export async function createPromoToken(payload: Omit<PromoTokenPayload, 'issued_at' | 'expires_at' | 'nonce'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (DEFAULT_EXPIRY_DAYS * 24 * 60 * 60);
  const nonce = crypto.randomUUID();

  const secret = new TextEncoder().encode(PROMO_JWT_SECRET);
  
  const token = await new SignJWT({
    ...payload,
    issued_at: now,
    expires_at: expiresAt,
    nonce,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(secret);

  return token;
}

/**
 * Verify and decode a promo JWT token
 */
export async function verifyPromoToken(token: string): Promise<PromoTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(PROMO_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    // Check expiration
    if (payload.expires_at && (payload.expires_at as number) < Math.floor(Date.now() / 1000)) {
      console.log('[Promo] Token expired');
      return null;
    }
    
    return payload as unknown as PromoTokenPayload;
  } catch (error) {
    console.error('[Promo] Token verification failed:', error);
    return null;
  }
}

/**
 * Set the promo token cookie
 */
export async function setPromoTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PROMO_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEFAULT_EXPIRY_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

/**
 * Get the promo token from cookie
 */
export async function getPromoTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(PROMO_COOKIE_NAME);
  return cookie?.value || null;
}

/**
 * Clear the promo token cookie
 */
export async function clearPromoTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PROMO_COOKIE_NAME);
}

/**
 * Hash a string for privacy (IP, user agent)
 */
export function hashForPrivacy(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

/**
 * Validate campaign ID format
 */
export function isValidCampaignId(campaignId: string): boolean {
  // Allow alphanumeric, underscore, hyphen, max 64 chars
  return /^[a-zA-Z0-9_-]{1,64}$/.test(campaignId);
}

/**
 * Known campaign IDs (can be extended to DB lookup)
 */
export const KNOWN_CAMPAIGNS = [
  'blanklogo_10credits',
  'tiktok_launch',
  'welcome_bonus',
] as const;

export type KnownCampaign = typeof KNOWN_CAMPAIGNS[number];

export function isKnownCampaign(campaignId: string): campaignId is KnownCampaign {
  return KNOWN_CAMPAIGNS.includes(campaignId as KnownCampaign);
}

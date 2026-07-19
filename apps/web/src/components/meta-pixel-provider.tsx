'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Generate unique event ID for CAPI deduplication
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pv_${timestamp}_${random}`;
}

/**
 * Get Facebook cookies for CAPI user matching
 */
function getFacebookCookies(): { fbc?: string; fbp?: string } {
  if (typeof document === 'undefined') return {};
  
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return {
    fbc: cookies['_fbc'],
    fbp: cookies['_fbp'],
  };
}

/**
 * Send PageView to CAPI for deduplication
 */
async function sendPageViewToCAPI(eventId: string, sourceUrl: string) {
  try {
    const { fbc, fbp } = getFacebookCookies();
    
    await fetch('/api/track/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        sourceUrl,
        fbc,
        fbp,
      }),
      // Don't block navigation
      keepalive: true,
    });
  } catch (error) {
    // Silent fail - don't break user experience for analytics
    console.debug('[MetaPixel] CAPI send failed:', error);
  }
}

/**
 * Meta Pixel Provider
 * 
 * Note: The base Meta Pixel code is loaded in layout.tsx via Next.js Script component.
 * This provider handles SPA route change tracking with CAPI deduplication.
 * 
 * For each PageView:
 * 1. Generate unique event_id
 * 2. Send to client-side Pixel with event_id
 * 3. Send to server-side CAPI with same event_id (for deduplication)
 */
export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInitialMount = useRef(true);

  // Track page views on client-side route changes (SPA navigation)
  useEffect(() => {
    // Skip initial mount - layout.tsx handles the first PageView
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (typeof window !== 'undefined' && window.fbq && pathname) {
      // Generate unique event_id for deduplication
      const eventId = generateEventId();
      const sourceUrl = window.location.href;

      // Send to Pixel with event_id
      window.fbq('track', 'PageView', { eventId });

      // Send to CAPI with same event_id (async, non-blocking)
      sendPageViewToCAPI(eventId, sourceUrl);
    }
  }, [pathname]);

  return <>{children}</>;
}

export default MetaPixelProvider;

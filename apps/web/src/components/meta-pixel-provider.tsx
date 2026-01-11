'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Meta Pixel Provider
 * 
 * Note: The base Meta Pixel code is loaded in layout.tsx via Next.js Script component.
 * This provider only handles SPA route change tracking since the base code
 * only fires PageView on initial page load.
 */
export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Track page views on client-side route changes (SPA navigation)
  useEffect(() => {
    // Only track if fbq is available and this is a route change (not initial load)
    if (typeof window !== 'undefined' && window.fbq && pathname) {
      // Small delay to avoid double-firing on initial load
      const timer = setTimeout(() => {
        window.fbq('track', 'PageView');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return <>{children}</>;
}

export default MetaPixelProvider;

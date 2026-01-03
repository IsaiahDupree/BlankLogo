'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initMetaPixel, trackPageView } from '@/lib/meta-pixel';

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

export function MetaPixelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Initialize Meta Pixel on mount
  useEffect(() => {
    if (META_PIXEL_ID) {
      initMetaPixel({
        pixelId: META_PIXEL_ID,
        autoConfig: true,
        debug: process.env.NODE_ENV === 'development',
      });
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (META_PIXEL_ID && pathname) {
      trackPageView(process.env.NODE_ENV === 'development');
    }
  }, [pathname]);

  return <>{children}</>;
}

export default MetaPixelProvider;

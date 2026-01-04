'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initGA, trackPageView as gaPageView } from '@/lib/google-analytics';
import { initPostHog, trackPageView as phPageView } from '@/lib/posthog';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize analytics on mount
  useEffect(() => {
    initGA();
    initPostHog();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (pathname) {
      const url = searchParams.toString() 
        ? `${pathname}?${searchParams.toString()}` 
        : pathname;
      
      gaPageView(url);
      phPageView(url);
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}

export default AnalyticsProvider;

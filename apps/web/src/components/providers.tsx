"use client";

import { ReactNode, Suspense } from "react";
import { ToastProvider } from "./toast";
import ErrorBoundary from "./error-boundary";
import { MetaPixelProvider } from "./meta-pixel-provider";
import { AnalyticsProvider } from "./analytics-provider";
import { CelebrationProvider } from "./credits-celebration";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <AnalyticsProvider>
          <MetaPixelProvider>
            <ToastProvider>
              <CelebrationProvider>{children}</CelebrationProvider>
            </ToastProvider>
          </MetaPixelProvider>
        </AnalyticsProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default Providers;

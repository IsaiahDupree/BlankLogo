"use client";

import { ReactNode, Suspense } from "react";
import { ToastProvider } from "./toast";
import ErrorBoundary from "./error-boundary";
import { MetaPixelProvider } from "./meta-pixel-provider";
import { AnalyticsProvider } from "./analytics-provider";
import { CelebrationProvider } from "./credits-celebration";
import { BehaviorTracker } from "./behavior-tracker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <AnalyticsProvider>{null}</AnalyticsProvider>
      </Suspense>
      <BehaviorTracker>
        <MetaPixelProvider>
          <ToastProvider>
            <CelebrationProvider>{children}</CelebrationProvider>
          </ToastProvider>
        </MetaPixelProvider>
      </BehaviorTracker>
    </ErrorBoundary>
  );
}

export default Providers;

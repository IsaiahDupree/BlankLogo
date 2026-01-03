"use client";

import { ReactNode } from "react";
import { ToastProvider } from "./toast";
import ErrorBoundary from "./error-boundary";
import { MetaPixelProvider } from "./meta-pixel-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <MetaPixelProvider>
        <ToastProvider>{children}</ToastProvider>
      </MetaPixelProvider>
    </ErrorBoundary>
  );
}

export default Providers;

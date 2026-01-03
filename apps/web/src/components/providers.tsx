"use client";

import { ReactNode } from "react";
import { ToastProvider } from "./toast";
import ErrorBoundary from "./error-boundary";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>{children}</ToastProvider>
    </ErrorBoundary>
  );
}

export default Providers;

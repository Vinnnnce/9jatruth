"use client";

import type { ReactNode } from "react";

/**
 * SelfHealingProvider
 *
 * NOTE: The self-healing UI (auto-retry fallback, "Attempting to self-heal
 * automatically…" messaging, and the floating "Recovering from issues (N)"
 * badge) has been DISABLED by request. This component is now a pass-through
 * that renders its children directly with no error boundary, no retry logic,
 * and no health indicator. The exports below are kept so existing imports
 * (e.g. `SelfHealingErrorBoundary`) do not break; they now resolve to a
 * trivial boundary that renders children or nothing on error.
 */

export interface SelfHealingProviderProps {
  children: ReactNode;
  /** Kept for API compatibility; no longer rendered. */
  showHealthIndicator?: boolean;
  /** Kept for API compatibility; no longer rendered. */
  fallback?: (retry: () => void, attempts: number) => ReactNode;
}

export function SelfHealingProvider({ children }: SelfHealingProviderProps) {
  return <>{children}</>;
}

/**
 * Minimal no-op error boundary kept for import compatibility.
 * On error it renders the fallback (if provided) or null — it does NOT show
 * any "self-healing" UI or auto-retry.
 */
import { Component, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (retry: () => void, attempts: number) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  onRetry?: () => void;
  componentId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class SelfHealingErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  handleManualRetry = () => {
    this.props.onRetry?.();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.handleManualRetry, 0);
      }
      return null;
    }
    return this.props.children;
  }
}

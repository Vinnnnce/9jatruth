"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Optional custom fallback rendered when an error is caught. */
  fallback?: ReactNode;
  /** Optional component id used for diagnostics logging. */
  componentId?: string;
  /**
   * Kept for API compatibility with prior callers. Auto-retry / "self-healing"
   * behavior has been disabled; this value is accepted but ignored.
   */
  maxAutoRetries?: number;
  /** Kept for API compatibility; ignored. */
  baseRetryDelayMs?: number;
  /** Called when an error is caught, for integration with a diagnostics system. */
  onError?: (error: Error, info: ErrorInfo, componentId: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary
 *
 * Catches render errors in its subtree and renders a friendly fallback with a
 * manual "Try again" button. The previous automatic "self-healing" retry
 * behavior (auto-retry with exponential backoff, "Self-healing… (N/3)" and
 * "Attempting to recover automatically…" UI) has been DISABLED by request.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentId = this.props.componentId ?? "error-boundary";
    console.error(`[error-boundary] [render-error] ${componentId}: ${error.message}`, {
      componentStack: info.componentStack,
    });
    this.props.onError?.(error, info, componentId);
  }

  handleManualRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="rounded-xl p-6 space-y-3 bg-card border border-red-500/30"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message ||
              "An unexpected error occurred while loading this section."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleManualRetry}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw className={cn("h-3 w-3")} />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

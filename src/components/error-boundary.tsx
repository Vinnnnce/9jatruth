"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Optional custom fallback rendered when an error is caught. */
  fallback?: ReactNode;
  /** Optional component id used for diagnostics logging. */
  componentId?: string;
  /** Maximum automatic retry attempts before showing the fallback. Defaults to 3. */
  maxAutoRetries?: number;
  /** Base delay (ms) for exponential backoff between retries. Defaults to 800. */
  baseRetryDelayMs?: number;
  /** Called when an error is caught, for integration with a diagnostics system. */
  onError?: (error: Error, info: ErrorInfo, componentId: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  attempts: number;
  isRetrying: boolean;
}

/**
 * ErrorBoundary with self-healing behavior.
 *
 * - Catches render errors and automatically retries mounting the children up
 *   to `maxAutoRetries` times, using exponential backoff between attempts.
 * - Reports each error via the optional `onError` callback so a parent
 *   self-healing diagnostics system can log/track it.
 * - Renders a friendly fallback UI once retries are exhausted, with a manual
 *   "Try again" button that resets the boundary.
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined, attempts: 0, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, attempts: 0, isRetrying: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentId = this.props.componentId ?? "error-boundary";
    // Log to console for live diagnostics.
    console.error(`[self-healing] [render-error] ${componentId}: ${error.message}`, {
      componentStack: info.componentStack,
      attempts: this.state.attempts,
    });
    this.props.onError?.(error, info, componentId);

    // Auto-retry with exponential backoff up to the configured limit.
    const maxRetries = this.props.maxAutoRetries ?? 3;
    if (this.state.attempts < maxRetries) {
      this.setState({ isRetrying: true });
      const base = this.props.baseRetryDelayMs ?? 800;
      // Exponential backoff: base * 2^attempts + small jitter.
      const delay = base * Math.pow(2, this.state.attempts) + Math.random() * 150;
      this.retryTimeout = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: undefined,
          isRetrying: false,
          attempts: prev.attempts + 1,
        }));
      }, delay);
    } else {
      this.setState({ isRetrying: false });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
  }

  handleManualRetry = () => {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.setState((prev) => ({
      hasError: false,
      error: undefined,
      isRetrying: false,
      attempts: prev.attempts + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const maxRetries = this.props.maxAutoRetries ?? 3;
      const exhausted = this.state.attempts >= maxRetries;
      return (
        <div
          className="rounded-xl p-6 space-y-3 bg-card border border-red-500/30"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-medium text-foreground">Something went wrong</p>
            {this.state.isRetrying && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                <Activity className="h-3 w-3 animate-pulse" />
                Self-healing… ({this.state.attempts}/{maxRetries})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {this.state.isRetrying
              ? "Attempting to recover automatically…"
              : this.state.error?.message ||
                "An unexpected error occurred while loading this section."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleManualRetry}
            className="h-7 text-xs gap-1.5"
            disabled={this.state.isRetrying}
          >
            <RefreshCw className={cn("h-3 w-3", this.state.isRetrying && "animate-spin")} />
            {exhausted ? "Try again" : "Retry now"}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

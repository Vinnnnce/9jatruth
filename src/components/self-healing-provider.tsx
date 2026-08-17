"use client";

import {
  Component,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Shield, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSelfHealing,
  type HealthStatus,
  type ReportIssueInput,
  type SelfHealingIssue,
} from "@/components/hooks/use-self-healing";

const RETRY_DELAY_MS = 1200;
const MAX_AUTO_RETRIES = 3;

interface SelfHealingContextValue {
  reportError: (input: ReportIssueInput) => SelfHealingIssue;
  issues: SelfHealingIssue[];
  healthStatus: HealthStatus;
}

const SelfHealingContext = createContext<SelfHealingContextValue | undefined>(undefined);

export function useSelfHealingContext() {
  const ctx = useContext(SelfHealingContext);
  if (!ctx) {
    throw new Error("useSelfHealingContext must be used within a SelfHealingProvider");
  }
  return ctx;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (retry: () => void, attempts: number) => ReactNode;
  onError: (error: Error, info: ErrorInfo) => void;
  onRetry?: () => void;
  componentId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  attempts: number;
  isRetrying: boolean;
}

/**
 * Class-based Error Boundary. React requires class components for
 * componentDidCatch / getDerivedStateFromError — this is wired into the
 * self-healing diagnostics system via the onError callback, and attempts
 * an automatic re-render after a short delay (bounded by MAX_AUTO_RETRIES).
 */
class SelfHealingErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, attempts: 0, isRetrying: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, info);
    if (this.state.attempts < MAX_AUTO_RETRIES) {
      this.setState({ isRetrying: true });
      this.retryTimeout = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          isRetrying: false,
          attempts: prev.attempts + 1,
        }));
        this.props.onRetry?.();
      }, RETRY_DELAY_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
  }

  handleManualRetry = () => {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.setState((prev) => ({ hasError: false, error: null, isRetrying: false, attempts: prev.attempts + 1 }));
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.handleManualRetry, this.state.attempts);
      }
      return (
        <DefaultFallback
          error={this.state.error}
          isRetrying={this.state.isRetrying}
          attempts={this.state.attempts}
          onRetry={this.handleManualRetry}
        />
      );
    }
    return this.props.children;
  }
}

function DefaultFallback({
  error,
  isRetrying,
  attempts,
  onRetry,
}: {
  error: Error | null;
  isRetrying: boolean;
  attempts: number;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      role="alert"
    >
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Something went wrong loading this section.</p>
        <p className="text-xs text-muted-foreground">
          {isRetrying
            ? "Attempting to self-heal automatically…"
            : error?.message ?? "An unexpected error occurred."}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} aria-hidden="true" />
        {isRetrying ? `Retrying (${attempts}/${MAX_AUTO_RETRIES})…` : "Retry now"}
      </button>
    </motion.div>
  );
}

interface HealthIndicatorProps {
  healthStatus: HealthStatus;
  issueCount: number;
}

function HealthIndicator({ healthStatus, issueCount }: HealthIndicatorProps) {
  if (healthStatus === "healthy") return null;

  const config = {
    degraded: { icon: Activity, label: "Minor issues detected", tone: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
    critical: { icon: Shield, label: "Recovering from issues", tone: "text-destructive border-destructive/30 bg-destructive/10" },
  } as const;

  const { icon: Icon, label, tone } = config[healthStatus];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
          tone
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {label} ({issueCount})
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export interface SelfHealingProviderProps {
  children: ReactNode;
  /** Show the floating health indicator badge. Defaults to true. */
  showHealthIndicator?: boolean;
  /** Custom fallback renderer for the top-level boundary. */
  fallback?: (retry: () => void, attempts: number) => ReactNode;
}

export function SelfHealingProvider({
  children,
  showHealthIndicator = true,
  fallback,
}: SelfHealingProviderProps) {
  const { reportIssue, issues, healthStatus } = useSelfHealing();
  const [renderKey, setRenderKey] = useState(0);
  const attemptsRef = useRef(0);

  const reportError = useCallback(
    (input: ReportIssueInput) => reportIssue(input),
    [reportIssue]
  );

  const handleBoundaryError = useCallback(
    (error: Error, info: ErrorInfo) => {
      reportIssue({
        componentId: "app-root",
        type: "render-error",
        message: error.message || "Unhandled render error",
        severity: "critical",
        meta: { stack: info.componentStack ?? undefined },
      });
    },
    [reportIssue]
  );

  const handleRetry = useCallback(() => {
    attemptsRef.current += 1;
    setRenderKey((k) => k + 1);
  }, []);

  const contextValue = useMemo<SelfHealingContextValue>(
    () => ({ reportError, issues, healthStatus }),
    [reportError, issues, healthStatus]
  );

  return (
    <SelfHealingContext.Provider value={contextValue}>
      <SelfHealingErrorBoundary key={renderKey} onError={handleBoundaryError} onRetry={handleRetry} fallback={fallback}>
        {children}
      </SelfHealingErrorBoundary>
      {showHealthIndicator && <HealthIndicator healthStatus={healthStatus} issueCount={issues.filter((i) => !i.resolved).length} />}
    </SelfHealingContext.Provider>
  );
}

export { SelfHealingErrorBoundary };

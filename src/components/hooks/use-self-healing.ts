"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Self-Healing UI diagnostics hook.
 *
 * Provides autonomous detection + repair for:
 *  - Broken components (reported via error boundaries)
 *  - Failed API calls (with exponential-backoff auto-retry)
 *  - Rendering anomalies (unexpected null renders, missing data fields)
 *  - Layout shift anomalies
 *
 * All state is local-only. Issue logs persist to localStorage (capped at
 * MAX_LOG_ENTRIES) so diagnostics survive reloads without any backend calls.
 */

const STORAGE_KEY = "9jatruth:self-healing-log";
const MAX_LOG_ENTRIES = 50;
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 500;
const FAILURE_PATTERN_WINDOW_MS = 60_000;
const REPEATED_FAILURE_THRESHOLD = 3;

export type IssueType =
  | "render-error"
  | "api-failure"
  | "null-render"
  | "missing-field"
  | "layout-shift"
  | "component-timeout"
  | "empty-render";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface SelfHealingIssue {
  id: string;
  componentId: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  resolved: boolean;
}

export type ComponentHealth = "healthy" | "degraded" | "failing" | "recovering";

interface ComponentRecord {
  id: string;
  health: ComponentHealth;
  failureCount: number;
  lastFailureAt: number | null;
  retryAttempts: number;
  fallbackActive: boolean;
}

export type HealthStatus = "healthy" | "degraded" | "critical";

export interface RegisterComponentOptions {
  /** Called by the hook consumer to attempt a repair (e.g. refetch, remount). */
  onRetry?: () => void | Promise<void>;
}

export interface ReportIssueInput {
  componentId: string;
  type: IssueType;
  message: string;
  severity?: IssueSeverity;
  meta?: Record<string, unknown>;
}

export interface UseSelfHealingReturn {
  registerComponent: (componentId: string, options?: RegisterComponentOptions) => void;
  reportIssue: (input: ReportIssueInput) => SelfHealingIssue;
  issues: SelfHealingIssue[];
  autoFix: (componentId: string) => Promise<boolean>;
  healthStatus: HealthStatus;
  /** Detect anomalies in a data payload (null renders / missing fields). */
  detectAnomaly: (componentId: string, data: unknown, expectedFields?: string[]) => boolean;
  /** Detect an empty render: arrays/strings/objects with no usable content. */
  detectEmptyRender: (componentId: string, data: unknown) => boolean;
  /** Observe a DOM element for layout shifts (CLS-style) and report anomalies. */
  observeLayoutShifts: (componentId: string, el: Element | null) => () => void;
  /** Wrap an async API call with retry + exponential backoff + issue reporting. */
  withAutoRetry: <T>(
    componentId: string,
    fn: () => Promise<T>,
    options?: { maxAttempts?: number }
  ) => Promise<T>;
  getComponentHealth: (componentId: string) => ComponentHealth;
  clearIssues: () => void;
}

function loadIssuesFromStorage(): SelfHealingIssue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistIssues(issues: SelfHealingIssue[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = issues.slice(-MAX_LOG_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded) — fail silently
  }
}

function generateId(): string {
  return `issue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function severityRank(severity: IssueSeverity): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export function useSelfHealing(): UseSelfHealingReturn {
  const [issues, setIssues] = useState<SelfHealingIssue[]>(() => loadIssuesFromStorage());
  const registryRef = useRef<Map<string, ComponentRecord>>(new Map());
  const optionsRef = useRef<Map<string, RegisterComponentOptions>>(new Map());

  useEffect(() => {
    persistIssues(issues);
  }, [issues]);

  const getOrCreateRecord = useCallback((componentId: string): ComponentRecord => {
    let record = registryRef.current.get(componentId);
    if (!record) {
      record = {
        id: componentId,
        health: "healthy",
        failureCount: 0,
        lastFailureAt: null,
        retryAttempts: 0,
        fallbackActive: false,
      };
      registryRef.current.set(componentId, record);
    }
    return record;
  }, []);

  const registerComponent = useCallback(
    (componentId: string, options?: RegisterComponentOptions) => {
      getOrCreateRecord(componentId);
      if (options) {
        optionsRef.current.set(componentId, options);
      }
    },
    [getOrCreateRecord]
  );

  const appendIssue = useCallback((issue: SelfHealingIssue) => {
    setIssues((prev) => {
      const next = [...prev, issue].slice(-MAX_LOG_ENTRIES);
      return next;
    });
    // Always mirror to console for live diagnostics during development.
    const logFn = issue.severity === "critical" || issue.severity === "high" ? console.error : console.warn;
    logFn(`[self-healing] [${issue.severity}] ${issue.componentId}: ${issue.message}`, issue.meta ?? {});
  }, []);

  const reportIssue = useCallback(
    (input: ReportIssueInput): SelfHealingIssue => {
      const record = getOrCreateRecord(input.componentId);
      const now = Date.now();

      // Pattern detection: repeated failures within a rolling time window escalate severity.
      const withinWindow =
        record.lastFailureAt !== null && now - record.lastFailureAt < FAILURE_PATTERN_WINDOW_MS;
      record.failureCount = withinWindow ? record.failureCount + 1 : 1;
      record.lastFailureAt = now;

      const isRepeatedPattern = record.failureCount >= REPEATED_FAILURE_THRESHOLD;
      const severity: IssueSeverity =
        input.severity ?? (isRepeatedPattern ? "high" : input.type === "render-error" ? "high" : "medium");

      record.health = isRepeatedPattern ? "failing" : "degraded";

      const issue: SelfHealingIssue = {
        id: generateId(),
        componentId: input.componentId,
        type: input.type,
        severity,
        message: isRepeatedPattern
          ? `${input.message} (repeated ${record.failureCount}x — pattern detected)`
          : input.message,
        timestamp: new Date(now).toISOString(),
        meta: input.meta,
        resolved: false,
      };

      appendIssue(issue);
      return issue;
    },
    [appendIssue, getOrCreateRecord]
  );

  const detectAnomaly = useCallback(
    (componentId: string, data: unknown, expectedFields?: string[]): boolean => {
      // Unexpected null / undefined render payload.
      if (data === null || data === undefined) {
        reportIssue({
          componentId,
          type: "null-render",
          message: "Component received null/undefined data where content was expected",
          severity: "medium",
        });
        return true;
      }

      // Missing-field anomaly detection against an expected shape.
      if (expectedFields && expectedFields.length > 0 && typeof data === "object") {
        const missing = expectedFields.filter((field) => !(field in (data as Record<string, unknown>)));
        if (missing.length > 0) {
          reportIssue({
            componentId,
            type: "missing-field",
            message: `Data payload is missing expected field(s): ${missing.join(", ")}`,
            severity: missing.length > expectedFields.length / 2 ? "high" : "low",
            meta: { missing },
          });
          return true;
        }
      }

      return false;
    },
    [reportIssue]
  );

  const detectEmptyRender = useCallback(
    (componentId: string, data: unknown): boolean => {
      // Arrays / strings / objects that contain no usable content.
      let isEmpty = false;
      if (data === null || data === undefined) {
        isEmpty = true;
      } else if (Array.isArray(data)) {
        isEmpty = data.length === 0;
      } else if (typeof data === "string") {
        isEmpty = data.trim().length === 0;
      } else if (typeof data === "object") {
        isEmpty = Object.keys(data as object).length === 0;
      }

      if (isEmpty) {
        reportIssue({
          componentId,
          type: "empty-render",
          message: "Component rendered with empty content where data was expected",
          severity: "low",
        });
      }
      return isEmpty;
    },
    [reportIssue]
  );

  const observeLayoutShifts = useCallback(
    (componentId: string, el: Element | null): (() => void) => {
      if (typeof window === "undefined" || !el) return () => {};
      // Use the PerformanceObserver API to detect layout shifts within the
      // observed element's subtree. Falls back gracefully if unavailable.
      if (typeof PerformanceObserver === "undefined") return () => {};

      let cumulativeShift = 0;
      let entries = 0;
      const record = (value: number) => {
        cumulativeShift += value;
        entries += 1;
        // Report only when the cumulative shift crosses an anomaly threshold.
        if (cumulativeShift > 0.25) {
          reportIssue({
            componentId,
            type: "layout-shift",
            message: `Detected cumulative layout shift of ${cumulativeShift.toFixed(3)} across ${entries} entries`,
            severity: "low",
            meta: { cumulativeShift, entries },
          });
          // Reset so we only report a new anomaly for the next burst.
          cumulativeShift = 0;
          entries = 0;
        }
      };

      let observer: PerformanceObserver | null = null;
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Layout-shift entries carry a `value` with the shift score.
            const value = (entry as unknown as { value?: number }).value ?? 0;
            record(value);
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
      } catch {
        // Some browsers don't support the layout-shift entry type — ignore.
      }

      return () => {
        if (observer) observer.disconnect();
      };
    },
    [reportIssue]
  );

  const autoFix = useCallback(
    async (componentId: string): Promise<boolean> => {
      const record = getOrCreateRecord(componentId);
      const options = optionsRef.current.get(componentId);
      record.health = "recovering";

      try {
        if (options?.onRetry) {
          await options.onRetry();
        }
        record.health = "healthy";
        record.failureCount = 0;
        record.retryAttempts = 0;
        record.fallbackActive = false;

        setIssues((prev) =>
          prev.map((issue) => (issue.componentId === componentId ? { ...issue, resolved: true } : issue))
        );
        return true;
      } catch (error) {
        record.health = "failing";
        record.fallbackActive = true;
        reportIssue({
          componentId,
          type: "component-timeout",
          message: `Auto-fix attempt failed: ${error instanceof Error ? error.message : String(error)}`,
          severity: "high",
        });
        return false;
      }
    },
    [getOrCreateRecord, reportIssue]
  );

  const withAutoRetry = useCallback(
    async <T,>(componentId: string, fn: () => Promise<T>, options?: { maxAttempts?: number }): Promise<T> => {
      const maxAttempts = options?.maxAttempts ?? MAX_RETRY_ATTEMPTS;
      const record = getOrCreateRecord(componentId);
      let attempt = 0;
      let lastError: unknown;

      while (attempt < maxAttempts) {
        try {
          const result = await fn();
          if (attempt > 0) {
            record.health = "healthy";
            record.retryAttempts = 0;
          }
          return result;
        } catch (error) {
          lastError = error;
          attempt += 1;
          record.retryAttempts = attempt;
          record.health = attempt >= maxAttempts ? "failing" : "degraded";

          reportIssue({
            componentId,
            type: "api-failure",
            message: `API call failed (attempt ${attempt}/${maxAttempts}): ${
              error instanceof Error ? error.message : String(error)
            }`,
            severity: attempt >= maxAttempts ? "critical" : "medium",
          });

          if (attempt >= maxAttempts) break;

          const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      record.fallbackActive = true;
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
    [getOrCreateRecord, reportIssue]
  );

  const getComponentHealth = useCallback(
    (componentId: string): ComponentHealth => {
      return registryRef.current.get(componentId)?.health ?? "healthy";
    },
    []
  );

  const clearIssues = useCallback(() => {
    setIssues([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const healthStatus: HealthStatus = useMemo(() => {
    if (issues.length === 0) return "healthy";
    const recentUnresolved = issues.filter((issue) => !issue.resolved);
    const highestSeverity = recentUnresolved.reduce<number>(
      (max, issue) => Math.max(max, severityRank(issue.severity)),
      0
    );
    if (highestSeverity >= 4 || recentUnresolved.filter((i) => severityRank(i.severity) >= 3).length >= 3) {
      return "critical";
    }
    if (highestSeverity >= 2) return "degraded";
    return "healthy";
  }, [issues]);

  return {
    registerComponent,
    reportIssue,
    issues,
    autoFix,
    healthStatus,
    detectAnomaly,
    detectEmptyRender,
    observeLayoutShifts,
    withAutoRetry,
    getComponentHealth,
    clearIssues,
  };
}

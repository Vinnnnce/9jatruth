"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Predictive UI hook.
 *
 * Tracks lightweight, on-device behavioral signals (category views, dwell
 * time, click sequences, scroll depth) in localStorage and turns them into
 * simple frequency-weighted "embedding" vectors used to anticipate what the
 * user is likely to do next: which category they will open, which sections
 * should be auto-expanded, and how engaged they currently are.
 *
 * Everything here is pure client-side (no network calls, no server state)
 * so it is safe to use in any client component tree.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PredictiveEventType =
  | "category_view"
  | "category_click"
  | "dwell"
  | "scroll"
  | "section_expand"
  | "section_collapse";

export interface PredictiveEvent {
  type: PredictiveEventType;
  category: string;
  /** Milliseconds spent on the category/article, when applicable. */
  dwellMs?: number;
  /** 0-1 scroll depth reached, when applicable. */
  scrollDepth?: number;
  /** Arbitrary section identifier (e.g. "comments", "related"). */
  section?: string;
  timestamp: number;
}

export interface RecommendedSection {
  section: string;
  score: number;
  reason: string;
}

export interface PredictiveUIState {
  /** The category the model believes the user will open next. */
  predictedCategory: string | null;
  /** Ranked category predictions with confidence scores (0-1). */
  categoryScores: Array<{ category: string; score: number }>;
  /** Sections recommended for surfacing / expansion, ranked by score. */
  recommendedSections: RecommendedSection[];
  /** A 0-100 rolling engagement score derived from recency + frequency + dwell. */
  engagementScore: number;
  /** Sections that should be auto-expanded right now. */
  autoExpandSections: string[];
  /** Record a new behavioral event. */
  trackEvent: (event: Omit<PredictiveEvent, "timestamp">) => void;
  /** Convenience helper: record dwell time for a category in ms. */
  trackDwell: (category: string, dwellMs: number) => void;
  /** Convenience helper: record scroll depth (0-1) for a category. */
  trackScroll: (category: string, scrollDepth: number) => void;
  /** Reset all stored behavioral data. */
  resetHistory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "9jatruth:predictive-ui:events:v1";
const MAX_EVENTS = 100;
const HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days recency half-life
const AUTO_EXPAND_THRESHOLD = 0.55;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadEvents(): PredictiveEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PredictiveEvent[];
  } catch {
    return [];
  }
}

function saveEvents(events: PredictiveEvent[]) {
  if (!isBrowser()) return;
  try {
    const trimmed = events.slice(-MAX_EVENTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage may be full or unavailable (private mode) - fail silently.
  }
}

// ---------------------------------------------------------------------------
// Scoring: frequency-weighted, recency-decayed "embedding" style vectors
// ---------------------------------------------------------------------------

/** Exponential recency decay weight, 1.0 = now, ~0.5 at HALF_LIFE_MS ago. */
function recencyWeight(timestamp: number, now: number): number {
  const age = Math.max(0, now - timestamp);
  return Math.pow(0.5, age / HALF_LIFE_MS);
}

/** Per-event-type importance weights used to build the preference vector. */
const EVENT_WEIGHTS: Record<PredictiveEventType, number> = {
  category_click: 3,
  category_view: 1,
  dwell: 2,
  scroll: 0.75,
  section_expand: 1.5,
  section_collapse: -0.5,
};

interface CategoryVector {
  [category: string]: number;
}

function buildCategoryVector(events: PredictiveEvent[], now: number): CategoryVector {
  const vector: CategoryVector = {};
  for (const event of events) {
    if (!event.category) continue;
    const base = EVENT_WEIGHTS[event.type] ?? 1;
    const recency = recencyWeight(event.timestamp, now);
    // Dwell events scale additionally with normalized dwell duration
    // (capped at 3 minutes so a single long read doesn't dominate forever).
    const dwellBoost =
      event.type === "dwell" && event.dwellMs
        ? Math.min(event.dwellMs / (1000 * 60 * 3), 1) * 2
        : 0;
    const scrollBoost =
      event.type === "scroll" && typeof event.scrollDepth === "number"
        ? event.scrollDepth
        : 0;

    const weight = (base + dwellBoost + scrollBoost) * recency;
    vector[event.category] = (vector[event.category] ?? 0) + weight;
  }
  return vector;
}

function normalizeVector(vector: CategoryVector): Array<{ category: string; score: number }> {
  const entries = Object.entries(vector);
  const max = entries.reduce((m, [, v]) => Math.max(m, v), 0);
  if (max <= 0) return [];
  return entries
    .map(([category, value]) => ({ category, score: value / max }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Detects simple sequential click patterns (A -> B) to add a small transition
 * bonus, e.g. if a user frequently clicks "politics" after "news", boost
 * "politics" whenever "news" was recently clicked.
 */
function transitionBonus(
  events: PredictiveEvent[],
  lastCategory: string | null,
): CategoryVector {
  const bonus: CategoryVector = {};
  if (!lastCategory) return bonus;

  const clicks = events.filter((e) => e.type === "category_click" || e.type === "category_view");
  for (let i = 1; i < clicks.length; i++) {
    if (clicks[i - 1].category === lastCategory) {
      const next = clicks[i].category;
      bonus[next] = (bonus[next] ?? 0) + 1;
    }
  }
  return bonus;
}

function computeEngagementScore(events: PredictiveEvent[], now: number): number {
  if (events.length === 0) return 0;

  const recentWindow = 1000 * 60 * 30; // last 30 minutes
  const recentEvents = events.filter((e) => now - e.timestamp <= recentWindow);

  const frequencyComponent = Math.min(recentEvents.length / 15, 1) * 40;

  const dwellEvents = events.filter((e) => e.type === "dwell" && e.dwellMs);
  const avgDwell =
    dwellEvents.length > 0
      ? dwellEvents.reduce((sum, e) => sum + (e.dwellMs ?? 0), 0) / dwellEvents.length
      : 0;
  const dwellComponent = Math.min(avgDwell / (1000 * 60 * 2), 1) * 35;

  const scrollEvents = events.filter((e) => e.type === "scroll" && typeof e.scrollDepth === "number");
  const avgScroll =
    scrollEvents.length > 0
      ? scrollEvents.reduce((sum, e) => sum + (e.scrollDepth ?? 0), 0) / scrollEvents.length
      : 0;
  const scrollComponent = avgScroll * 25;

  return Math.round(Math.min(frequencyComponent + dwellComponent + scrollComponent, 100));
}

function computeRecommendedSections(
  events: PredictiveEvent[],
  now: number,
): RecommendedSection[] {
  const sectionScores: Record<string, number> = {};

  for (const event of events) {
    if (!event.section) continue;
    const recency = recencyWeight(event.timestamp, now);
    const base = event.type === "section_expand" ? 2 : event.type === "section_collapse" ? -1 : 1;
    sectionScores[event.section] = (sectionScores[event.section] ?? 0) + base * recency;
  }

  const max = Math.max(1, ...Object.values(sectionScores).map((v) => Math.max(v, 0)));

  return Object.entries(sectionScores)
    .map(([section, raw]) => {
      const score = Math.max(0, raw) / max;
      return {
        section,
        score,
        reason:
          score >= AUTO_EXPAND_THRESHOLD
            ? "Frequently expanded and recently engaged with"
            : "Occasionally engaged with",
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePredictiveUI(): PredictiveUIState {
  const [events, setEvents] = useState<PredictiveEvent[]>([]);
  const [tick, setTick] = useState(0);
  const lastCategoryRef = useRef<string | null>(null);

  // Hydrate from localStorage on mount (client only).
  useEffect(() => {
    const loaded = loadEvents();
    setEvents(loaded);
    const lastCategoryEvent = [...loaded]
      .reverse()
      .find((e) => e.type === "category_click" || e.type === "category_view");
    lastCategoryRef.current = lastCategoryEvent?.category ?? null;
  }, []);

  // Periodically re-derive predictions so recency decay stays fresh even
  // without new events (e.g. engagement score decaying while idle).
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const trackEvent = useCallback((event: Omit<PredictiveEvent, "timestamp">) => {
    const fullEvent: PredictiveEvent = { ...event, timestamp: Date.now() };
    setEvents((prev) => {
      const next = [...prev, fullEvent].slice(-MAX_EVENTS);
      saveEvents(next);
      return next;
    });
    if (event.type === "category_click" || event.type === "category_view") {
      lastCategoryRef.current = event.category;
    }
  }, []);

  const trackDwell = useCallback(
    (category: string, dwellMs: number) => {
      trackEvent({ type: "dwell", category, dwellMs });
    },
    [trackEvent],
  );

  const trackScroll = useCallback(
    (category: string, scrollDepth: number) => {
      trackEvent({ type: "scroll", category, scrollDepth: Math.max(0, Math.min(1, scrollDepth)) });
    },
    [trackEvent],
  );

  const resetHistory = useCallback(() => {
    setEvents([]);
    lastCategoryRef.current = null;
    if (isBrowser()) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const derived = useMemo(() => {
    const now = Date.now();
    const baseVector = buildCategoryVector(events, now);
    const bonus = transitionBonus(events, lastCategoryRef.current);

    const combined: CategoryVector = { ...baseVector };
    for (const [category, value] of Object.entries(bonus)) {
      combined[category] = (combined[category] ?? 0) + value * 0.5;
    }

    const categoryScores = normalizeVector(combined);
    const predictedCategory = categoryScores[0]?.category ?? null;
    const recommendedSections = computeRecommendedSections(events, now);
    const autoExpandSections = recommendedSections
      .filter((s) => s.score >= AUTO_EXPAND_THRESHOLD)
      .map((s) => s.section);
    const engagementScore = computeEngagementScore(events, now);

    return {
      categoryScores,
      predictedCategory,
      recommendedSections,
      autoExpandSections,
      engagementScore,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick]);

  return {
    ...derived,
    trackEvent,
    trackDwell,
    trackScroll,
    resetHistory,
  };
}

export default usePredictiveUI;

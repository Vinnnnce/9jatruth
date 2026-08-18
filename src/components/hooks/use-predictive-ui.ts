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

/** Per-category behavioral aggregate surfaced for intent anticipation. */
export interface CategoryBehavior {
  category: string;
  /** Total clicks recorded (recency-decayed). */
  clicks: number;
  /** Total views recorded (recency-decayed). */
  views: number;
  /** Cumulative dwell time in ms (recency-decayed). */
  totalDwellMs: number;
  /** Average scroll depth reached (0-1). */
  avgScrollDepth: number;
  /** Last time this category was interacted with (epoch ms). */
  lastSeenAt: number | null;
}

/** Inferred short-term intent, used to surface news before search. */
export interface IntentSignal {
  /** Best-guess category the user is currently pursuing. */
  category: string | null;
  /** 0-1 confidence of the intent guess. */
  confidence: number;
  /** Human-readable reason for the prediction. */
  reason: string;
  /** Ranked categories the user may want surfaced proactively. */
  surfaceAhead: Array<{ category: string; score: number }>;
}

export interface PredictedCategoryResult {
  /** The category the model believes the user will open next. */
  predictedCategory: string | null;
  /** Confidence 0-1 of the prediction. */
  confidence: number;
  /** Ranked next-likely categories (top 3). */
  runnersUp: Array<{ category: string; score: number }>;
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
  /** Per-category behavioral aggregates (intent anticipation input). */
  categoryBehavior: CategoryBehavior[];
  /** Inferred short-term intent used to surface news before search. */
  intent: IntentSignal;
  /** Ranked prediction of the next category the user will open. */
  predictedNext: PredictedCategoryResult;
  /** Record a new behavioral event. */
  trackEvent: (event: Omit<PredictiveEvent, "timestamp">) => void;
  /** Convenience helper: record dwell time for a category in ms. */
  trackDwell: (category: string, dwellMs: number) => void;
  /** Convenience helper: record scroll depth (0-1) for a category. */
  trackScroll: (category: string, scrollDepth: number) => void;
  /** Start a dwell timer for a category; returns a stop() that records elapsed ms. */
  startDwellTimer: (category: string) => () => void;
  /** Reset all stored behavioral data. */
  resetHistory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "9jatruth:predictive-ui:events:v1";
const PREDICTIONS_KEY = "9jatruth:predictive-ui:predictions:v1";
const MAX_EVENTS = 100;
const HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 3; // 3 days recency half-life
const AUTO_EXPAND_THRESHOLD = 0.55;
/** Dwell time (ms) above which a section is considered "deeply engaged" and
 *  eligible for auto-expansion regardless of click frequency. */
const DWELL_ENGAGEMENT_THRESHOLD_MS = 1000 * 45; // 45 seconds
/** Time-of-day intent window: most recent events weighted heavier here. */
const INTENT_WINDOW_MS = 1000 * 60 * 20; // 20 minutes

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

interface PersistedPredictions {
  predictedCategory: string | null;
  predictedNext: PredictedCategoryResult;
  intent: IntentSignal;
  savedAt: number;
}

function loadPredictions(): PersistedPredictions | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PREDICTIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPredictions;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePredictions(predictions: PersistedPredictions) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(predictions));
  } catch {
    // ignore quota / privacy-mode errors
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
  const sectionDwell: Record<string, number> = {};

  for (const event of events) {
    if (!event.section) continue;
    const recency = recencyWeight(event.timestamp, now);
    const base = event.type === "section_expand" ? 2 : event.type === "section_collapse" ? -1 : 1;
    sectionScores[event.section] = (sectionScores[event.section] ?? 0) + base * recency;
    if (event.type === "dwell" && event.dwellMs) {
      sectionDwell[event.section] = (sectionDwell[event.section] ?? 0) + event.dwellMs * recency;
    }
  }

  const max = Math.max(1, ...Object.values(sectionScores).map((v) => Math.max(v, 0)));

  return Object.entries(sectionScores)
    .map(([section, raw]) => {
      const score = Math.max(0, raw) / max;
      const dwell = sectionDwell[section] ?? 0;
      const deeplyEngaged = dwell >= DWELL_ENGAGEMENT_THRESHOLD_MS;
      return {
        section,
        score,
        reason: deeplyEngaged
          ? "Deeply engaged — long dwell time detected"
          : score >= AUTO_EXPAND_THRESHOLD
            ? "Frequently expanded and recently engaged with"
            : "Occasionally engaged with",
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Builds per-category behavioral aggregates (clicks, views, dwell, scroll
 * depth, last seen) using recency-decayed weights. Used as the input to
 * intent anticipation and "surface news before search" logic.
 */
function computeCategoryBehavior(
  events: PredictiveEvent[],
  now: number,
): CategoryBehavior[] {
  const map = new Map<string, CategoryBehavior>();

  for (const event of events) {
    if (!event.category) continue;
    const recency = recencyWeight(event.timestamp, now);
    let entry = map.get(event.category);
    if (!entry) {
      entry = {
        category: event.category,
        clicks: 0,
        views: 0,
        totalDwellMs: 0,
        avgScrollDepth: 0,
        lastSeenAt: null,
      };
      map.set(event.category, entry);
    }

    if (event.type === "category_click") entry.clicks += 1 * recency;
    else if (event.type === "category_view") entry.views += 1 * recency;
    else if (event.type === "dwell" && event.dwellMs) entry.totalDwellMs += event.dwellMs * recency;
    else if (event.type === "scroll" && typeof event.scrollDepth === "number") {
      // Running average weighted by recency so deeper recent scrolls count more.
      entry.avgScrollDepth = entry.avgScrollDepth * 0.7 + event.scrollDepth * recency * 0.3;
    }

    if (entry.lastSeenAt === null || event.timestamp > entry.lastSeenAt) {
      entry.lastSeenAt = event.timestamp;
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.clicks + b.views + b.totalDwellMs / 60000) - (a.clicks + a.views + a.totalDwellMs / 60000),
  );
}

/**
 * Frequency-analysis prediction of which category the user will open next.
 * Combines the recency-decayed category vector with a Markov-style
 * transition model (what usually follows the last-clicked category) and a
 * short-term intent window so very recent activity dominates.
 */
function computePredictedNext(
  events: PredictiveEvent[],
  categoryVector: Array<{ category: string; score: number }>,
  lastCategory: string | null,
  now: number,
): PredictedCategoryResult {
  if (categoryVector.length === 0) {
    return { predictedCategory: null, confidence: 0, runnersUp: [] };
  }

  // Markov transition probabilities: P(next | lastCategory).
  const transitions: Record<string, Record<string, number>> = {};
  const clickSequence = events.filter(
    (e) => e.type === "category_click" || e.type === "category_view",
  );
  for (let i = 1; i < clickSequence.length; i++) {
    const from = clickSequence[i - 1].category;
    const to = clickSequence[i].category;
    if (!from || !to || from === to) continue;
    transitions[from] = transitions[from] ?? {};
    transitions[from][to] = (transitions[from][to] ?? 0) + 1;
  }

  const scoreMap = new Map(categoryVector.map((c) => [c.category, c.score]));
  const transitionBoost: Record<string, number> = {};
  if (lastCategory && transitions[lastCategory]) {
    const total = Object.values(transitions[lastCategory]).reduce((s, v) => s + v, 0) || 1;
    for (const [to, count] of Object.entries(transitions[lastCategory])) {
      transitionBoost[to] = (count / total) * 0.35;
    }
  }

  // Short-term intent window: events in the last INTENT_WINDOW_MS get extra weight.
  const recentBoost: Record<string, number> = {};
  for (const e of events) {
    if (now - e.timestamp > INTENT_WINDOW_MS) continue;
    if (!e.category) continue;
    const recency = recencyWeight(e.timestamp, now);
    recentBoost[e.category] = (recentBoost[e.category] ?? 0) + 0.15 * recency;
  }

  const combined = categoryVector.map((c) => ({
    category: c.category,
    score: Math.min(
      1,
      (scoreMap.get(c.category) ?? 0) + (transitionBoost[c.category] ?? 0) + (recentBoost[c.category] ?? 0),
    ),
  }));

  combined.sort((a, b) => b.score - a.score);
  const top = combined[0];
  const runnersUp = combined.slice(1, 4);
  const confidence = top ? Math.min(1, top.score) : 0;

  return {
    predictedCategory: top?.category ?? null,
    confidence,
    runnersUp,
  };
}

/**
 * Intent anticipation: identifies the category the user is most likely
 * actively pursuing right now, based on the recent intent window plus
 * dwell/scroll depth signals. Also produces a `surfaceAhead` list of
 * categories to proactively surface before the user searches.
 */
function computeIntent(
  events: PredictiveEvent[],
  behavior: CategoryBehavior[],
  lastCategory: string | null,
  now: number,
): IntentSignal {
  if (behavior.length === 0) {
    return {
      category: null,
      confidence: 0,
      reason: "Not enough browsing history yet.",
      surfaceAhead: [],
    };
  }

  // Weight recent events heavily within the intent window.
  const recent = events.filter((e) => now - e.timestamp <= INTENT_WINDOW_MS);
  const recentScores: Record<string, number> = {};
  for (const e of recent) {
    if (!e.category) continue;
    const recency = recencyWeight(e.timestamp, now);
    const base = EVENT_WEIGHTS[e.type] ?? 1;
    recentScores[e.category] = (recentScores[e.category] ?? 0) + base * recency;
  }

  // Blend recent activity with long-term behavioral preference.
  const behaviorMap = new Map(behavior.map((b) => [b.category, b]));
  const candidates = new Set<string>([
    ...Object.keys(recentScores),
    ...behavior.map((b) => b.category),
  ]);

  const blended: Array<{ category: string; score: number }> = [];
  for (const category of candidates) {
    const recentScore = recentScores[category] ?? 0;
    const b = behaviorMap.get(category);
    const longTerm = b ? b.clicks * 0.3 + b.views * 0.1 + b.totalDwellMs / 60000 * 0.2 : 0;
    const score = Math.min(1, recentScore * 0.65 + longTerm * 0.35);
    blended.push({ category, score });
  }
  blended.sort((a, b) => b.score - a.score);

  const top = blended[0];
  const surfaceAhead = blended.slice(0, 4);

  let reason: string;
  if (top && top.score > 0.5) {
    reason = `Strong recent activity in ${top.category}`;
  } else if (lastCategory && recentScores[lastCategory]) {
    reason = `Continuing from ${lastCategory}`;
  } else if (top) {
    reason = `Frequently browsed: ${top.category}`;
  } else {
    reason = "No clear intent yet.";
  }

  return {
    category: top?.category ?? null,
    confidence: top?.score ?? 0,
    reason,
    surfaceAhead,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePredictiveUI(): PredictiveUIState {
  const [events, setEvents] = useState<PredictiveEvent[]>([]);
  const [tick, setTick] = useState(0);
  const lastCategoryRef = useRef<string | null>(null);
  const dwellTimerRef = useRef<{ category: string; startedAt: number } | null>(null);

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

  /**
   * Starts a dwell timer for a category. The returned stop() function records
   * the elapsed milliseconds as a dwell event — handy for measuring actual
   * time spent on an article/section without manual bookkeeping.
   */
  const startDwellTimer = useCallback((category: string) => {
    dwellTimerRef.current = { category, startedAt: Date.now() };
    return () => {
      const current = dwellTimerRef.current;
      if (current && current.category === category) {
        const elapsed = Date.now() - current.startedAt;
        if (elapsed > 0) trackDwell(category, elapsed);
        dwellTimerRef.current = null;
      }
    };
  }, [trackDwell]);

  const resetHistory = useCallback(() => {
    setEvents([]);
    lastCategoryRef.current = null;
    dwellTimerRef.current = null;
    if (isBrowser()) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(PREDICTIONS_KEY);
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
    const categoryBehavior = computeCategoryBehavior(events, now);
    const intent = computeIntent(events, categoryBehavior, lastCategoryRef.current, now);
    const predictedNext = computePredictedNext(events, categoryScores, lastCategoryRef.current, now);

    // Auto-expand sections that either cross the engagement threshold OR have
    // accumulated enough dwell time to count as deeply engaged.
    const autoExpandSections = recommendedSections
      .filter((s) => s.score >= AUTO_EXPAND_THRESHOLD || s.reason.startsWith("Deeply engaged"))
      .map((s) => s.section);
    const engagementScore = computeEngagementScore(events, now);

    return {
      categoryScores,
      predictedCategory,
      recommendedSections,
      autoExpandSections,
      engagementScore,
      categoryBehavior,
      intent,
      predictedNext,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick]);

  // Persist predictions to localStorage so they survive reloads and can be
  // read by other components (e.g. to surface news before search) without
  // recomputing the full event log.
  useEffect(() => {
    if (!isBrowser()) return;
    savePredictions({
      predictedCategory: derived.predictedCategory,
      predictedNext: derived.predictedNext,
      intent: derived.intent,
      savedAt: Date.now(),
    });
  }, [
    derived.predictedCategory,
    derived.predictedNext,
    derived.intent,
  ]);

  return {
    ...derived,
    trackEvent,
    trackDwell,
    trackScroll,
    startDwellTimer,
    resetHistory,
  };
}

export default usePredictiveUI;

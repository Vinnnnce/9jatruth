"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Predictive Flows hook.
 *
 * Anticipates the user's next navigation action based on recent browsing
 * history stored in localStorage, surfaces "continue reading" / "explore
 * related" style suggestions, and opportunistically prefetches content so
 * navigating feels instant. Pure client-side - no server dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavigationEventType = "visit" | "click" | "hover" | "search";

export interface NavigationEvent {
  type: NavigationEventType;
  path: string;
  topic?: string;
  category?: string;
  title?: string;
  timestamp: number;
}

export type SuggestedPathKind = "continue" | "related" | "trending" | "revisit";

export interface SuggestedPath {
  id: string;
  kind: SuggestedPathKind;
  path: string;
  title: string;
  description: string;
  topic?: string;
  category?: string;
  confidence: number; // 0-1
}

export interface NavigationSuggestion {
  id: string;
  label: string;
  path: string;
  icon: "continue" | "related" | "trending" | "revisit";
}

interface PrefetchCacheEntry {
  data: unknown;
  fetchedAt: number;
}

export interface PredictiveFlowsState {
  /** Ranked list of predicted next paths, richest data shape. */
  suggestedPaths: SuggestedPath[];
  /** Lightweight suggestions suitable for rendering as prompt chips/cards. */
  navigationSuggestions: NavigationSuggestion[];
  /** Prefetch a URL's content ahead of navigation; caches in-memory. */
  prefetchContent: (path: string) => Promise<unknown | null>;
  /** Record a navigation-related event (visit, click, hover, search). */
  trackNavigation: (event: Omit<NavigationEvent, "timestamp">) => void;
  /** Read a previously prefetched response, if available and fresh. */
  getPrefetched: (path: string) => unknown | null;
  /** Whether a given path currently has a fresh prefetch cache entry. */
  isPrefetched: (path: string) => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "9jatruth:predictive-flows:nav:v1";
const MAX_EVENTS = 100;
const PREFETCH_TTL_MS = 1000 * 60 * 5; // 5 minutes
const HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadEvents(): NavigationEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NavigationEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: NavigationEvent[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function recencyWeight(timestamp: number, now: number): number {
  const age = Math.max(0, now - timestamp);
  return Math.pow(0.5, age / HALF_LIFE_MS);
}

// ---------------------------------------------------------------------------
// In-memory prefetch cache (module scope so it survives re-renders, cleared
// on full page reload which is the correct behavior for prefetched data).
// ---------------------------------------------------------------------------

const prefetchCache = new Map<string, PrefetchCacheEntry>();
const inflightRequests = new Map<string, Promise<unknown | null>>();

function isFresh(entry: PrefetchCacheEntry | undefined, now: number): boolean {
  return !!entry && now - entry.fetchedAt <= PREFETCH_TTL_MS;
}

// ---------------------------------------------------------------------------
// Prediction helpers
// ---------------------------------------------------------------------------

function buildTopicSuggestions(events: NavigationEvent[], now: number): SuggestedPath[] {
  if (events.length === 0) return [];

  const topicWeights: Record<string, { weight: number; path: string; title: string }> = {};
  const categoryWeights: Record<string, { weight: number; path: string }> = {};

  for (const event of events) {
    const recency = recencyWeight(event.timestamp, now);
    const base = event.type === "click" ? 2 : event.type === "search" ? 1.5 : event.type === "hover" ? 0.75 : 1;
    const weight = base * recency;

    if (event.topic) {
      const key = event.topic;
      const existing = topicWeights[key];
      topicWeights[key] = {
        weight: (existing?.weight ?? 0) + weight,
        path: event.path,
        title: event.title ?? event.topic,
      };
    }
    if (event.category) {
      const key = event.category;
      const existing = categoryWeights[key];
      categoryWeights[key] = {
        weight: (existing?.weight ?? 0) + weight * 0.6,
        path: event.path,
      };
    }
  }

  const topicEntries = Object.entries(topicWeights).sort((a, b) => b[1].weight - a[1].weight);
  const maxTopicWeight = topicEntries[0]?.[1].weight || 1;

  const continueSuggestions: SuggestedPath[] = topicEntries.slice(0, 2).map(([topic, info], idx) => ({
    id: `continue-${topic}`,
    kind: "continue",
    path: info.path,
    title: `Continue reading about ${info.title}`,
    description: `Pick up where you left off on ${topic}.`,
    topic,
    confidence: Math.max(0.2, (info.weight / maxTopicWeight) * (idx === 0 ? 1 : 0.75)),
  }));

  const categoryEntries = Object.entries(categoryWeights).sort((a, b) => b[1].weight - a[1].weight);
  const maxCategoryWeight = categoryEntries[0]?.[1].weight || 1;

  const relatedSuggestions: SuggestedPath[] = categoryEntries.slice(0, 3).map(([category, info], idx) => ({
    id: `related-${category}`,
    kind: "related",
    path: info.path,
    title: `Explore related topics in ${category}`,
    description: `More stories from ${category} you might have missed.`,
    category,
    confidence: Math.max(0.15, (info.weight / maxCategoryWeight) * (idx === 0 ? 0.9 : 0.6)),
  }));

  return [...continueSuggestions, ...relatedSuggestions].sort((a, b) => b.confidence - a.confidence);
}

function buildRevisitSuggestions(events: NavigationEvent[], now: number): SuggestedPath[] {
  const visitCounts: Record<string, { count: number; lastTitle?: string; lastSeen: number }> = {};
  for (const event of events) {
    if (event.type !== "visit") continue;
    const entry = visitCounts[event.path] ?? { count: 0, lastSeen: 0 };
    entry.count += 1;
    entry.lastTitle = event.title ?? entry.lastTitle;
    entry.lastSeen = Math.max(entry.lastSeen, event.timestamp);
    visitCounts[event.path] = entry;
  }

  return Object.entries(visitCounts)
    .filter(([, info]) => info.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 2)
    .map(([path, info]) => ({
      id: `revisit-${path}`,
      kind: "revisit" as const,
      path,
      title: `Jump back into ${info.lastTitle ?? path}`,
      description: "You've visited this a few times recently.",
      confidence: Math.min(0.3 + info.count * 0.1, 0.85) * recencyWeight(info.lastSeen, now),
    }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePredictiveFlows(): PredictiveFlowsState {
  const [events, setEvents] = useState<NavigationEvent[]>([]);
  const [, forceTick] = useState(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    setEvents(loadEvents());
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trackNavigation = useCallback((event: Omit<NavigationEvent, "timestamp">) => {
    const fullEvent: NavigationEvent = { ...event, timestamp: Date.now() };
    setEvents((prev) => {
      const next = [...prev, fullEvent].slice(-MAX_EVENTS);
      saveEvents(next);
      return next;
    });
  }, []);

  const prefetchContent = useCallback(async (path: string): Promise<unknown | null> => {
    if (!path) return null;
    const now = Date.now();
    const cached = prefetchCache.get(path);
    if (isFresh(cached, now)) {
      return cached!.data;
    }

    const inflight = inflightRequests.get(path);
    if (inflight) return inflight;

    const request = (async () => {
      try {
        const response = await fetch(path, {
          method: "GET",
          headers: { Purpose: "prefetch", "X-Prefetch": "1" },
          credentials: "same-origin",
        });
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") ?? "";
        const data = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
        prefetchCache.set(path, { data, fetchedAt: Date.now() });
        return data;
      } catch {
        return null;
      } finally {
        inflightRequests.delete(path);
      }
    })();

    inflightRequests.set(path, request);
    return request;
  }, []);

  const getPrefetched = useCallback((path: string): unknown | null => {
    const entry = prefetchCache.get(path);
    return isFresh(entry, Date.now()) ? entry!.data : null;
  }, []);

  const isPrefetched = useCallback((path: string): boolean => {
    return isFresh(prefetchCache.get(path), Date.now());
  }, []);

  // Periodically refresh derived suggestions so recency decay stays current.
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const suggestedPaths = useMemo(() => {
    const now = Date.now();
    const topical = buildTopicSuggestions(events, now);
    const revisit = buildRevisitSuggestions(events, now);
    return [...topical, ...revisit].sort((a, b) => b.confidence - a.confidence).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // Opportunistically prefetch the top prediction's path.
  useEffect(() => {
    const top = suggestedPaths[0];
    if (top?.path && top.confidence > 0.4) {
      void prefetchContent(top.path);
    }
  }, [suggestedPaths, prefetchContent]);

  const navigationSuggestions: NavigationSuggestion[] = useMemo(
    () =>
      suggestedPaths.map((s) => ({
        id: s.id,
        label: s.title,
        path: s.path,
        icon: s.kind,
      })),
    [suggestedPaths],
  );

  return {
    suggestedPaths,
    navigationSuggestions,
    prefetchContent,
    trackNavigation,
    getPrefetched,
    isPrefetched,
  };
}

export default usePredictiveFlows;

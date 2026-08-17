"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Emotion-Adaptive UX hook.
 *
 * Infers a coarse "mood" signal from interaction *patterns* only — mouse
 * velocity, click cadence, scroll speed, and typing cadence. There is no
 * camera access, no facial analysis, and no data ever leaves the browser:
 * all tracking, scoring, and storage are 100% local.
 */

export type Mood = "happy" | "neutral" | "stressed" | "tired";
export type TextTone = "calm" | "energetic" | "supportive";
export type ColorPalette = "cool" | "warm" | "neutral";
export type LayoutDensity = "minimal" | "information-rich";

const UPDATE_INTERVAL_MS = 30_000;
const MOUSE_SAMPLE_LIMIT = 200;
const STORAGE_KEY = "9jatruth:emotion-adaptive-state";

interface InteractionSample {
  mouseVelocities: number[];
  clickTimestamps: number[];
  scrollSpeeds: number[];
  keyTimestamps: number[];
  lastMousePos: { x: number; y: number; t: number } | null;
  lastScrollY: number | null;
  lastScrollT: number | null;
}

export interface EmotionRecommendation {
  id: string;
  title: string;
  description: string;
}

export interface UseEmotionAdaptiveReturn {
  mood: Mood;
  moodScore: number;
  textTone: TextTone;
  colorPalette: ColorPalette;
  layoutDensity: LayoutDensity;
  recommendations: EmotionRecommendation[];
  trackInteraction: (
    type: "mouse" | "click" | "scroll" | "keydown",
    event?: { x?: number; y?: number; deltaY?: number }
  ) => void;
  resetMood: () => void;
  lastUpdatedAt: string | null;
}

function createEmptySample(): InteractionSample {
  return {
    mouseVelocities: [],
    clickTimestamps: [],
    scrollSpeeds: [],
    keyTimestamps: [],
    lastMousePos: null,
    lastScrollY: null,
    lastScrollT: null,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

/**
 * Weighted interaction analysis:
 *  - High click frequency + high mouse velocity + irregular movement -> stressed
 *  - Low activity overall, slow cadence -> tired
 *  - Moderate, steady rhythm -> happy
 *  - Otherwise -> neutral
 *
 * Produces a moodScore in [-1, 1] where negative leans stressed/tired and
 * positive leans happy, plus a discrete Mood bucket.
 */
function computeMood(sample: InteractionSample): { mood: Mood; score: number } {
  const now = Date.now();
  const windowMs = UPDATE_INTERVAL_MS;

  const recentClicks = sample.clickTimestamps.filter((t) => now - t < windowMs);
  const recentKeys = sample.keyTimestamps.filter((t) => now - t < windowMs);

  const clicksPerMinute = (recentClicks.length / windowMs) * 60_000;
  const keysPerMinute = (recentKeys.length / windowMs) * 60_000;
  const avgMouseVelocity = average(sample.mouseVelocities);
  const mouseJitter = stdDev(sample.mouseVelocities);
  const avgScrollSpeed = average(sample.scrollSpeeds);

  // Typing cadence variability (bursty typing suggests stress; steady suggests calm).
  let keyIntervalVariability = 0;
  if (recentKeys.length > 2) {
    const intervals: number[] = [];
    for (let i = 1; i < recentKeys.length; i++) {
      intervals.push(recentKeys[i] - recentKeys[i - 1]);
    }
    keyIntervalVariability = stdDev(intervals);
  }

  const activityLevel =
    clicksPerMinute * 0.3 + keysPerMinute * 0.2 + avgMouseVelocity * 0.3 + avgScrollSpeed * 0.2;

  // Normalize sub-signals into rough [0,1] bands using empirical-feeling thresholds.
  const normClicks = Math.min(clicksPerMinute / 40, 1);
  const normVelocity = Math.min(avgMouseVelocity / 1500, 1);
  const normJitter = Math.min(mouseJitter / 800, 1);
  const normScroll = Math.min(avgScrollSpeed / 1200, 1);
  const normKeyVariability = Math.min(keyIntervalVariability / 600, 1);
  const normActivity = Math.min(activityLevel / 50, 1);

  // Stress signal: fast + erratic + frequent clicking + bursty typing.
  const stressSignal =
    normClicks * 0.3 + normVelocity * 0.2 + normJitter * 0.3 + normKeyVariability * 0.2;

  // Fatigue signal: low overall activity but present (user is here, just slow).
  const tirednessSignal = normActivity < 0.15 && (recentClicks.length > 0 || recentKeys.length > 0) ? 1 - normActivity : 0;

  // Happiness/flow signal: moderate steady activity, low jitter, smooth scroll.
  const flowSignal = Math.max(
    0,
    normActivity * 0.4 + (1 - normJitter) * 0.3 + Math.min(normScroll, 0.6) * 0.3 - stressSignal * 0.4
  );

  // Combine into a single score in [-1, 1].
  let score = flowSignal - stressSignal - tirednessSignal * 0.6;
  score = Math.max(-1, Math.min(1, score));

  let mood: Mood;
  if (tirednessSignal > 0.6 && stressSignal < 0.4) {
    mood = "tired";
  } else if (stressSignal > 0.55) {
    mood = "stressed";
  } else if (score > 0.25) {
    mood = "happy";
  } else {
    mood = "neutral";
  }

  return { mood, score: Number(score.toFixed(3)) };
}

function moodToTone(mood: Mood): TextTone {
  switch (mood) {
    case "stressed":
      return "calm";
    case "tired":
      return "supportive";
    case "happy":
      return "energetic";
    default:
      return "calm";
  }
}

function moodToPalette(mood: Mood): ColorPalette {
  switch (mood) {
    case "stressed":
      return "cool";
    case "tired":
      return "warm";
    case "happy":
      return "warm";
    default:
      return "neutral";
  }
}

function moodToDensity(mood: Mood): LayoutDensity {
  switch (mood) {
    case "stressed":
    case "tired":
      return "minimal";
    default:
      return "information-rich";
  }
}

function moodToRecommendations(mood: Mood): EmotionRecommendation[] {
  switch (mood) {
    case "stressed":
      return [
        {
          id: "breathe",
          title: "Take a short break",
          description: "Your activity pattern looks fast-paced. A 60-second pause can help you refocus.",
        },
        {
          id: "simplify",
          title: "Simplified view enabled",
          description: "We've reduced on-screen density so it's easier to scan what matters most.",
        },
      ];
    case "tired":
      return [
        {
          id: "digest",
          title: "Quick digest",
          description: "Here's a condensed summary so you can catch up without extra scrolling.",
        },
        {
          id: "save-for-later",
          title: "Save for later",
          description: "Bookmark longer reads and come back when you have more energy.",
        },
      ];
    case "happy":
      return [
        {
          id: "explore",
          title: "Explore more stories",
          description: "You're in a great flow — here are more in-depth stories you might enjoy.",
        },
      ];
    default:
      return [
        {
          id: "balanced",
          title: "Balanced feed",
          description: "Showing a balanced mix of quick updates and deeper stories.",
        },
      ];
  }
}

interface PersistedMoodState {
  mood: Mood;
  moodScore: number;
  updatedAt: string;
}

function loadPersistedMood(): PersistedMoodState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedMoodState;
  } catch {
    return null;
  }
}

function persistMood(state: PersistedMoodState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function useEmotionAdaptive(): UseEmotionAdaptiveReturn {
  const initial = typeof window !== "undefined" ? loadPersistedMood() : null;

  const [mood, setMood] = useState<Mood>(initial?.mood ?? "neutral");
  const [moodScore, setMoodScore] = useState<number>(initial?.moodScore ?? 0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(initial?.updatedAt ?? null);

  const sampleRef = useRef<InteractionSample>(createEmptySample());
  const rafRef = useRef<number | null>(null);
  const pendingMouseRef = useRef<{ x: number; y: number } | null>(null);

  // requestAnimationFrame-driven mouse velocity sampling (throttled to frame rate,
  // not on every raw mousemove event, to stay cheap).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      const pending = pendingMouseRef.current;
      if (pending) {
        const now = performance.now();
        const sample = sampleRef.current;
        if (sample.lastMousePos) {
          const dx = pending.x - sample.lastMousePos.x;
          const dy = pending.y - sample.lastMousePos.y;
          const dt = Math.max(1, now - sample.lastMousePos.t);
          const distance = Math.sqrt(dx * dx + dy * dy);
          const velocity = (distance / dt) * 1000; // px/sec
          sample.mouseVelocities.push(velocity);
          if (sample.mouseVelocities.length > MOUSE_SAMPLE_LIMIT) {
            sample.mouseVelocities.shift();
          }
        }
        sample.lastMousePos = { x: pending.x, y: pending.y, t: now };
        pendingMouseRef.current = null;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const trackInteraction = useCallback(
    (type: "mouse" | "click" | "scroll" | "keydown", event?: { x?: number; y?: number; deltaY?: number }) => {
      const sample = sampleRef.current;
      const now = Date.now();

      switch (type) {
        case "mouse": {
          if (typeof event?.x === "number" && typeof event?.y === "number") {
            pendingMouseRef.current = { x: event.x, y: event.y };
          }
          break;
        }
        case "click": {
          sample.clickTimestamps.push(now);
          if (sample.clickTimestamps.length > MOUSE_SAMPLE_LIMIT) sample.clickTimestamps.shift();
          break;
        }
        case "scroll": {
          const perfNow = performance.now();
          if (sample.lastScrollT !== null && typeof event?.deltaY === "number") {
            const dt = Math.max(1, perfNow - sample.lastScrollT);
            const speed = (Math.abs(event.deltaY) / dt) * 1000;
            sample.scrollSpeeds.push(speed);
            if (sample.scrollSpeeds.length > MOUSE_SAMPLE_LIMIT) sample.scrollSpeeds.shift();
          }
          sample.lastScrollT = perfNow;
          break;
        }
        case "keydown": {
          sample.keyTimestamps.push(now);
          if (sample.keyTimestamps.length > MOUSE_SAMPLE_LIMIT) sample.keyTimestamps.shift();
          break;
        }
      }
    },
    []
  );

  // Periodic mood recomputation — every 30s, not on every interaction.
  useEffect(() => {
    const evaluate = () => {
      const { mood: nextMood, score } = computeMood(sampleRef.current);
      setMood(nextMood);
      setMoodScore(score);
      const updatedAt = new Date().toISOString();
      setLastUpdatedAt(updatedAt);
      persistMood({ mood: nextMood, moodScore: score, updatedAt });
    };

    const interval = setInterval(evaluate, UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Passive global listeners so consumers don't have to wire up every DOM event manually.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMouseMove = (e: MouseEvent) => trackInteraction("mouse", { x: e.clientX, y: e.clientY });
    const handleClick = () => trackInteraction("click");
    const handleScroll = () => trackInteraction("scroll", { deltaY: window.scrollY - (sampleRef.current.lastScrollY ?? window.scrollY) });
    const handleKeydown = () => trackInteraction("keydown");

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeydown, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [trackInteraction]);

  const resetMood = useCallback(() => {
    sampleRef.current = createEmptySample();
    setMood("neutral");
    setMoodScore(0);
    const updatedAt = new Date().toISOString();
    setLastUpdatedAt(updatedAt);
    persistMood({ mood: "neutral", moodScore: 0, updatedAt });
  }, []);

  const textTone = useMemo(() => moodToTone(mood), [mood]);
  const colorPalette = useMemo(() => moodToPalette(mood), [mood]);
  const layoutDensity = useMemo(() => moodToDensity(mood), [mood]);
  const recommendations = useMemo(() => moodToRecommendations(mood), [mood]);

  return {
    mood,
    moodScore,
    textTone,
    colorPalette,
    layoutDensity,
    recommendations,
    trackInteraction,
    resetMood,
    lastUpdatedAt,
  };
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smile, Brain, Coffee, TrendingDown, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useEmotionAdaptive,
  type ColorPalette,
  type LayoutDensity,
  type Mood,
  type TextTone,
  type EmotionRecommendation,
} from "@/components/hooks/use-emotion-adaptive";

interface EmotionAdaptiveContextValue {
  mood: Mood;
  moodScore: number;
  textTone: TextTone;
  colorPalette: ColorPalette;
  layoutDensity: LayoutDensity;
  recommendations: EmotionRecommendation[];
  resetMood: () => void;
}

const EmotionAdaptiveContext = createContext<EmotionAdaptiveContextValue | undefined>(undefined);

export function useEmotionAdaptiveContext() {
  const ctx = useContext(EmotionAdaptiveContext);
  if (!ctx) {
    throw new Error("useEmotionAdaptiveContext must be used within an EmotionAdaptiveProvider");
  }
  return ctx;
}

// Palette values expressed as CSS custom properties so any component can
// consume `var(--emotion-accent)` etc. without importing the hook directly.
const PALETTE_VARS: Record<ColorPalette, Record<string, string>> = {
  cool: {
    "--emotion-accent": "#3b82f6",
    "--emotion-accent-soft": "#93c5fd",
    "--emotion-bg-tint": "#eff6ff",
    "--emotion-border-tint": "#bfdbfe",
  },
  warm: {
    "--emotion-accent": "#f97316",
    "--emotion-accent-soft": "#fdba74",
    "--emotion-bg-tint": "#fff7ed",
    "--emotion-border-tint": "#fed7aa",
  },
  neutral: {
    "--emotion-accent": "#64748b",
    "--emotion-accent-soft": "#cbd5e1",
    "--emotion-bg-tint": "#f8fafc",
    "--emotion-border-tint": "#e2e8f0",
  },
};

const MOOD_ICON: Record<Mood, typeof Smile> = {
  happy: Smile,
  neutral: Brain,
  stressed: TrendingDown,
  tired: Coffee,
};

const MOOD_LABEL: Record<Mood, string> = {
  happy: "Feeling good",
  neutral: "Steady",
  stressed: "Taking it slow for you",
  tired: "Low-energy mode",
};

export interface EmotionAdaptiveProviderProps {
  children: ReactNode;
  /** Show a small floating mood indicator badge. Defaults to false (opt-in). */
  showMoodIndicator?: boolean;
  /** Apply density-driven className to the wrapper. Defaults to true. */
  applyDensityClass?: boolean;
  /** Apply tone/mood/palette CSS classes to <body> as well. Defaults to true. */
  applyBodyClasses?: boolean;
}

export function EmotionAdaptiveProvider({
  children,
  showMoodIndicator = false,
  applyDensityClass = true,
  applyBodyClasses = true,
}: EmotionAdaptiveProviderProps) {
  const { mood, moodScore, textTone, colorPalette, layoutDensity, recommendations, resetMood } =
    useEmotionAdaptive();
  const [indicatorVisible, setIndicatorVisible] = useState(showMoodIndicator);

  const cssVars = useMemo<CSSProperties>(
    () => PALETTE_VARS[colorPalette] as CSSProperties,
    [colorPalette]
  );

  // Apply a tone + mood + density class to <body> so any component in the
  // tree (not just descendants of this wrapper) can react via CSS, e.g.
  // `body.emotion-tone-calm .cta { ... }`. Removed on unmount.
  useEffect(() => {
    if (!applyBodyClasses || typeof document === "undefined") return;
    const body = document.body;
    const toneClass = `emotion-tone-${textTone}`;
    const moodClass = `emotion-mood-${mood}`;
    const paletteClass = `emotion-palette-${colorPalette}`;
    const densityClass = `emotion-density-${layoutDensity}`;

    body.classList.add(toneClass, moodClass, paletteClass, densityClass);
    return () => {
      body.classList.remove(toneClass, moodClass, paletteClass, densityClass);
    };
  }, [applyBodyClasses, textTone, mood, colorPalette, layoutDensity]);

  const contextValue = useMemo<EmotionAdaptiveContextValue>(
    () => ({ mood, moodScore, textTone, colorPalette, layoutDensity, recommendations, resetMood }),
    [mood, moodScore, textTone, colorPalette, layoutDensity, recommendations, resetMood]
  );

  const Icon = MOOD_ICON[mood];

  return (
    <EmotionAdaptiveContext.Provider value={contextValue}>
      <div
        style={{ ...cssVars, transition: "background-color 400ms ease, border-color 400ms ease, color 400ms ease" }}
        data-mood={mood}
        data-tone={textTone}
        data-palette={colorPalette}
        className={cn(
          "emotion-adaptive-root",
          applyDensityClass && densityClassName(layoutDensity)
        )}
      >
        {children}
      </div>

      <AnimatePresence>
        {indicatorVisible && (
          <motion.button
            type="button"
            onClick={() => setIndicatorVisible(false)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            title="Click to dismiss mood indicator"
            className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur"
            style={{
              borderColor: "var(--emotion-border-tint)",
              backgroundColor: "var(--emotion-bg-tint)",
              color: "var(--emotion-accent)",
            }}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{MOOD_LABEL[mood]}</span>
            {mood === "happy" && <Heart className="h-3 w-3" aria-hidden="true" />}
            {mood === "stressed" && <Zap className="h-3 w-3" aria-hidden="true" />}
          </motion.button>
        )}
      </AnimatePresence>
    </EmotionAdaptiveContext.Provider>
  );
}

function densityClassName(density: LayoutDensity): string {
  return density === "minimal"
    ? "emotion-density-minimal [&_[data-density-optional]]:hidden [&_[data-density-spacing]]:gap-6"
    : "emotion-density-rich [&_[data-density-spacing]]:gap-3";
}

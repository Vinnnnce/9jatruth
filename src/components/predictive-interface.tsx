"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, ChevronDown, ChevronUp, Sparkles, TrendingUp, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePredictiveUI } from "@/components/hooks/use-predictive-ui";
import { usePredictiveFlows } from "@/components/hooks/use-predictive-flows";

export type PredictiveCategory = {
  key: string;
  label: string;
  icon?: string;
};

export type PredictiveInterfaceProps = {
  children: React.ReactNode;
  categories: Array<{ key: string; label: string; icon?: string }>;
  onCategoryRearrange?: (categories: string[]) => void;
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Hide the "smart order" chip row (rearranged category pills). */
  hideCategoryStrip?: boolean;
};

/**
 * PredictiveInterface wraps page content and layers predictive behaviors on
 * top of it:
 *  - Reorders the supplied category list based on the user's predicted
 *    interests (frequency-weighted click/dwell history).
 *  - Surfaces a "recommended for you" strip driven by predicted category +
 *    top navigation suggestions, before the user searches for anything.
 *  - Exposes auto-expand signals so nested sections can react to engagement.
 *  - Animates all of the above with framer-motion so re-ordering feels
 *    smooth rather than jarring.
 *
 * Entirely client-side: reads/writes localStorage via the predictive hooks,
 * no server round-trip required.
 */
export function PredictiveInterface({
  children,
  categories,
  onCategoryRearrange,
  className,
  hideCategoryStrip,
}: PredictiveInterfaceProps) {
  const {
    predictedCategory,
    categoryScores,
    engagementScore,
    autoExpandSections,
    trackEvent,
  } = usePredictiveUI();
  const { suggestedPaths, trackNavigation } = usePredictiveFlows();

  const [dismissed, setDismissed] = React.useState(false);
  const [expanded, setExpanded] = React.useState(true);

  // Rank the incoming categories by predicted score, keeping unseen
  // categories in their original relative order at the end.
  const orderedCategories = React.useMemo(() => {
    const scoreMap = new Map(categoryScores.map((c) => [c.category, c.score]));
    const withScores = categories.map((c, idx) => ({
      ...c,
      score: scoreMap.get(c.key) ?? 0,
      originalIndex: idx,
    }));
    return withScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    });
  }, [categories, categoryScores]);

  const orderedKeys = React.useMemo(() => orderedCategories.map((c) => c.key), [orderedCategories]);

  const previousOrderRef = React.useRef<string>("");
  React.useEffect(() => {
    const signature = orderedKeys.join(",");
    if (signature !== previousOrderRef.current) {
      previousOrderRef.current = signature;
      onCategoryRearrange?.(orderedKeys);
    }
  }, [orderedKeys, onCategoryRearrange]);

  const handleCategoryClick = React.useCallback(
    (key: string) => {
      trackEvent({ type: "category_click", category: key });
      trackNavigation({ type: "click", path: `/news/${key}`, category: key });
    },
    [trackEvent, trackNavigation],
  );

  const predictedLabel = React.useMemo(() => {
    const match = categories.find((c) => c.key === predictedCategory);
    return match?.label ?? predictedCategory;
  }, [categories, predictedCategory]);

  const topSuggestion = suggestedPaths[0];
  const showSurfaceStrip = !dismissed && (!!predictedCategory || !!topSuggestion);

  return (
    <div className={cn("w-full", className)}>
      {!hideCategoryStrip && orderedCategories.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Smart-ordered categories">
          <motion.div layout className="flex items-center gap-1 text-xs text-muted-foreground pr-1">
            <Brain className="h-3.5 w-3.5" />
            <span>For you</span>
          </motion.div>
          <AnimatePresence initial={false}>
            {orderedCategories.map((cat) => (
              <motion.button
                key={cat.key}
                layout
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                onClick={() => handleCategoryClick(cat.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover-elevate",
                  cat.key === predictedCategory
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-card-border bg-card text-card-foreground",
                )}
              >
                {cat.icon ? <span aria-hidden>{cat.icon}</span> : null}
                {cat.label}
                {cat.key === predictedCategory && (
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showSurfaceStrip && (
          <motion.div
            key="predictive-surface"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mb-4 overflow-hidden rounded-xl border border-card-border bg-card/60"
          >
            <div className="flex items-start justify-between gap-3 p-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {predictedLabel
                      ? `We think you're interested in ${predictedLabel}`
                      : "Surfaced for you"}
                  </p>
                  {topSuggestion && (
                    <p className="text-xs text-muted-foreground">{topSuggestion.description}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Engagement {engagementScore}%
                    </Badge>
                    {autoExpandSections.length > 0 && (
                      <Badge variant="secondary">
                        Auto-expanding {autoExpandSections.length}{" "}
                        {autoExpandSections.length === 1 ? "section" : "sections"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setExpanded((e) => !e)}
                  aria-label={expanded ? "Collapse suggestion" : "Expand suggestion"}
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PredictiveAutoExpandContext.Provider value={autoExpandSections}>
        {children}
      </PredictiveAutoExpandContext.Provider>
    </div>
  );
}

/**
 * Context that exposes the current list of sections which should be
 * auto-expanded, so arbitrarily nested children (accordions, collapsibles)
 * can opt into predictive behavior without prop drilling.
 */
export const PredictiveAutoExpandContext = React.createContext<string[]>([]);

export function useAutoExpandSection(section: string): boolean {
  const autoExpandSections = React.useContext(PredictiveAutoExpandContext);
  return autoExpandSections.includes(section);
}

export default PredictiveInterface;

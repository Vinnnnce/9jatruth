"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Brain, Clock, Sparkles, TrendingUp, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  usePredictiveFlows,
  type SuggestedPath,
  type SuggestedPathKind,
} from "@/components/hooks/use-predictive-flows";

export type PredictiveNavigationProps = {
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Max number of suggestion cards to render. Defaults to 4. */
  maxSuggestions?: number;
  /** Layout direction for the suggestion cards. */
  orientation?: "row" | "column";
  /** Called when the user clicks through a suggestion. */
  onNavigate?: (path: SuggestedPath) => void;
};

const KIND_META: Record<
  SuggestedPathKind,
  { icon: React.ComponentType<{ className?: string }>; label: string; accent: string }
> = {
  continue: { icon: Clock, label: "Continue reading", accent: "text-primary" },
  related: { icon: Sparkles, label: "Explore related", accent: "text-chart-2" },
  trending: { icon: TrendingUp, label: "Trending now", accent: "text-chart-3" },
  revisit: { icon: Brain, label: "Jump back in", accent: "text-chart-4" },
};

/**
 * PredictiveNavigation renders anticipated "next step" suggestions as
 * animated cards: "Continue reading about X", "Explore related topics in Y",
 * trending picks, and recently revisited pages. Hovering a card triggers a
 * background prefetch so the eventual click feels instant.
 */
export function PredictiveNavigation({
  className,
  maxSuggestions = 4,
  orientation = "row",
  onNavigate,
}: PredictiveNavigationProps) {
  const { suggestedPaths, prefetchContent, trackNavigation, isPrefetched } = usePredictiveFlows();

  const visible = React.useMemo(
    () => suggestedPaths.slice(0, maxSuggestions),
    [suggestedPaths, maxSuggestions],
  );

  const handleHover = React.useCallback(
    (path: string) => {
      trackNavigation({ type: "hover", path });
      void prefetchContent(path);
    },
    [trackNavigation, prefetchContent],
  );

  const handleClick = React.useCallback(
    (suggestion: SuggestedPath) => {
      trackNavigation({ type: "click", path: suggestion.path, topic: suggestion.topic, category: suggestion.category });
      onNavigate?.(suggestion);
    },
    [trackNavigation, onNavigate],
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex gap-3",
        orientation === "row" ? "flex-col sm:flex-row sm:flex-wrap" : "flex-col",
        className,
      )}
      aria-label="Predictive navigation suggestions"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((suggestion, index) => {
          const meta = KIND_META[suggestion.kind];
          const Icon = meta.icon;
          const prefetched = isPrefetched(suggestion.path);

          return (
            <motion.div
              key={suggestion.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
              className={orientation === "row" ? "sm:w-72" : "w-full"}
            >
              <Link
                href={suggestion.path}
                onMouseEnter={() => handleHover(suggestion.path)}
                onFocus={() => handleHover(suggestion.path)}
                onClick={() => handleClick(suggestion)}
                className="block"
              >
                <Card className="group h-full transition-shadow hover-elevate">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("gap-1", meta.accent)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                      {prefetched && (
                        <Badge variant="secondary" className="gap-1">
                          <Zap className="h-3 w-3" />
                          Ready
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {suggestion.description}
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-[11px] text-muted-foreground">
                        {Math.round(suggestion.confidence * 100)}% match
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs group-hover:translate-x-0.5 transition-transform"
                        tabIndex={-1}
                      >
                        Go
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default PredictiveNavigation;

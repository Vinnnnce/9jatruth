"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, TrendingUp, Zap, AlertCircle, Brain, Sparkles, X, Compass, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PredictiveNotification = {
  id: string;
  type: "trending" | "breaking" | "recommended" | "local";
  title: string;
  message: string;
  urgency: "low" | "medium" | "high";
  category?: string;
  actionUrl?: string;
  score: number;
  trendVelocity?: number;
};

type PredictedTopic = {
  topic: string;
  reason: string;
  confidence: number;
};

const urgencyConfig = {
  high: { color: "bg-red-500/10 text-red-500 border-red-500/30", icon: AlertCircle, label: "High" },
  medium: { color: "bg-amber-500/10 text-amber-500 border-amber-500/30", icon: Zap, label: "Medium" },
  low: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: TrendingUp, label: "Low" },
};

const typeIcons = {
  trending: TrendingUp,
  breaking: AlertCircle,
  recommended: Sparkles,
  local: Bell,
};

export function PredictiveNotifications() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [silentMode, setSilentMode] = useState(true);
  const [activeNudge, setActiveNudge] = useState<PredictiveNotification | null>(null);
  const [shownNudges, setShownNudges] = useState<Set<string>>(new Set());

  // Load dismissed notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("dismissed-predictions");
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch {
        // ignore
      }
    }
    const shown = localStorage.getItem("shown-nudges");
    if (shown) {
      try {
        setShownNudges(new Set(JSON.parse(shown)));
      } catch {
        // ignore
      }
    }
  }, []);

  const { data, isLoading } = useQuery<{
    notifications: PredictiveNotification[];
    aiInsight?: string;
    predictedTopics?: PredictedTopic[];
  }>({
    queryKey: ["/api/ai/predictive-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/ai/predictive-notifications?limit=5");
      if (!res.ok) return { notifications: [] };
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem("dismissed-predictions", JSON.stringify([...next]));
  };

  const handleNudgeDismiss = useCallback(() => {
    if (activeNudge) {
      const next = new Set(shownNudges);
      next.add(activeNudge.id);
      setShownNudges(next);
      localStorage.setItem("shown-nudges", JSON.stringify([...next]));
    }
    setActiveNudge(null);
  }, [activeNudge, shownNudges]);

  // Silent predictive nudge: surface a single high-relevance notification as a
  // non-intrusive toast-like banner, rotated every ~12s. Only nudges not yet
  // shown (persisted) and not dismissed. Suppressed entirely in silent mode off.
  useEffect(() => {
    if (!silentMode) return;
    const candidates = (data?.notifications || []).filter(
      (n) => !dismissed.has(n.id) && !shownNudges.has(n.id) && n.score >= 0.6,
    );
    if (candidates.length === 0) {
      setActiveNudge(null);
      return;
    }
    // Pick the highest-scoring candidate as the nudge.
    const next = candidates.reduce((best, n) => (n.score > best.score ? n : best), candidates[0]);
    setActiveNudge(next);

    const timeout = setTimeout(() => {
      // Auto-dismiss the nudge after a while and mark as shown.
      const ns = new Set(shownNudges);
      ns.add(next.id);
      setShownNudges(ns);
      localStorage.setItem("shown-nudges", JSON.stringify([...ns]));
      setActiveNudge(null);
    }, 12000);

    return () => clearTimeout(timeout);
  }, [data, silentMode, dismissed, shownNudges]);

  const visibleNotifications = (data?.notifications || []).filter(
    (n) => !dismissed.has(n.id)
  );

  if (isLoading || visibleNotifications.length === 0) return null;

  return (
    <>
      {/* Silent predictive nudge: a non-intrusive toast-like banner that
          surfaces one high-relevance prediction at a time. */}
      <AnimatePresence>
        {activeNudge && (
          <motion.div
            key={`nudge-${activeNudge.id}`}
            initial={{ opacity: 0, y: 24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 24, x: "-50%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-4 left-1/2 z-50 flex max-w-md items-center gap-2 rounded-lg border border-primary/30 bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
            role="status"
          >
            <div className={`shrink-0 rounded-md p-1 ${urgencyConfig[activeNudge.urgency].color} border`}>
              <Compass className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{activeNudge.title}</p>
              <p className="line-clamp-1 text-[10px] text-muted-foreground">{activeNudge.message}</p>
            </div>
            {activeNudge.actionUrl && (
              <a
                href={activeNudge.actionUrl}
                className="shrink-0 text-[10px] font-medium text-primary hover:underline"
              >
                View
              </a>
            )}
            <button
              onClick={handleNudgeDismiss}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss nudge"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Predictive Alerts
            <Badge variant="outline" className="text-[8px] ml-1">
              {visibleNotifications.length}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] ml-auto"
              onClick={() => setSilentMode(!silentMode)}
            >
              {silentMode ? "Silent" : "Active"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.aiInsight && (
            <div className="rounded-md bg-purple-500/5 border border-purple-500/20 p-2 mb-2">
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Sparkles className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />
                {data.aiInsight}
              </p>
            </div>
          )}

          {/* Predicted topics the user will likely care about next */}
          {data?.predictedTopics && data.predictedTopics.length > 0 && (
            <div className="rounded-md bg-blue-500/5 border border-blue-500/20 p-2 mb-2">
              <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1.5">
                <Compass className="h-3 w-3" />
                Predicted for you
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.predictedTopics.map((pt) => (
                  <Badge key={pt.topic} variant="outline" className="text-[9px] gap-1">
                    {pt.topic}
                    <span className="text-blue-500/70">{Math.round(pt.confidence * 100)}%</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {visibleNotifications.slice(0, 4).map((notif) => {
              const UrgencyIcon = urgencyConfig[notif.urgency].icon;
              const TypeIcon = typeIcons[notif.type] || Bell;
              const hasVelocity = (notif.trendVelocity ?? 0) > 0.4;
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-start gap-2 rounded-md bg-background/50 p-2.5 hover:bg-background/80 transition-colors"
                >
                  <div className={`shrink-0 rounded-md p-1 ${urgencyConfig[notif.urgency].color} border`}>
                    <TypeIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{notif.title}</p>
                      <Badge variant="outline" className={`text-[8px] ${urgencyConfig[notif.urgency].color} border`}>
                        <UrgencyIcon className="h-2 w-2" />
                        {urgencyConfig[notif.urgency].label}
                      </Badge>
                      {hasVelocity && (
                        <Badge variant="outline" className="text-[8px] gap-0.5 text-amber-600 dark:text-amber-400 border-amber-500/30">
                          <Activity className="h-2 w-2" />
                          Rising
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                    {notif.actionUrl && (
                      <a
                        href={notif.actionUrl}
                        className="text-[10px] text-primary hover:underline mt-0.5 inline-block"
                      >
                        View details →
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(notif.id)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, TrendingUp, Zap, AlertCircle, Brain, Sparkles, X } from "lucide-react";
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
  }, []);

  const { data, isLoading } = useQuery<{
    notifications: PredictiveNotification[];
    aiInsight?: string;
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

  const visibleNotifications = (data?.notifications || []).filter(
    (n) => !dismissed.has(n.id)
  );

  if (isLoading || visibleNotifications.length === 0) return null;

  return (
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
        <AnimatePresence>
          {visibleNotifications.slice(0, 4).map((notif) => {
            const UrgencyIcon = urgencyConfig[notif.urgency].icon;
            const TypeIcon = typeIcons[notif.type] || Bell;
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
  );
}

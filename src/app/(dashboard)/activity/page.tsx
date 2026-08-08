"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send, ShieldCheck, Coins, TrendingUp, AlertCircle,
  Zap, Fuel, Car, Tag, Shield, Clock, Radio,
} from "lucide-react";

type ActivityEntry = {
  id: string;
  type: "truth_submitted" | "truth_verified" | "reward_earned" | "prediction_made" | "alert_triggered";
  description: string;
  userHash?: string;
  category?: string;
  neighborhood?: string;
  region?: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

const activityConfig: Record<string, { icon: typeof Send; color: string; bg: string; label: string }> = {
  truth_submitted: { icon: Send, color: "text-blue-500", bg: "bg-blue-500/10", label: "Truth Submitted" },
  truth_verified: { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10", label: "Verification" },
  reward_earned: { icon: Coins, color: "text-amber-500", bg: "bg-amber-500/10", label: "Reward Earned" },
  prediction_made: { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", label: "AI Prediction" },
  alert_triggered: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Alert" },
};

const categoryConfig: Record<string, { icon: typeof Zap; color: string }> = {
  power: { icon: Zap, color: "text-amber-500" },
  fuel: { icon: Fuel, color: "text-orange-500" },
  traffic: { icon: Car, color: "text-blue-500" },
  prices: { icon: Tag, color: "text-purple-500" },
  safety: { icon: Shield, color: "text-green-500" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Activity() {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data, isLoading, isError } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/activity?limit=50");
      return res.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time data
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Update timestamp when new data arrives
  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load activity data. Retrying automatically...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  // Real-time live indicator
  const LiveIndicator = () => (
    <div className="flex items-center gap-1.5 text-[10px] text-green-500">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      Live — updated {timeAgo(lastUpdated.toISOString())}
    </div>
  );

  const counts = {
    truth_submitted: data.filter(e => e.type === "truth_submitted").length,
    truth_verified: data.filter(e => e.type === "truth_verified").length,
    reward_earned: data.filter(e => e.type === "reward_earned").length,
    prediction_made: data.filter(e => e.type === "prediction_made").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Activity Timeline</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time feed of submissions, verifications, rewards, and predictions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Submissions</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{counts.truth_submitted}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Verifications</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{counts.truth_verified}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Rewards</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{counts.reward_earned}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Predictions</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{counts.prediction_made}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative space-y-2">
        {data.map((entry, i) => {
          const config = activityConfig[entry.type];
          const Icon = config.icon;
          const catConfig = entry.category ? categoryConfig[entry.category] : null;
          const CatIcon = catConfig?.icon;

          return (
            <div key={entry.id} className="relative flex gap-3 animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
              {/* Timeline line */}
              {i < data.length - 1 && (
                <div className="absolute left-4 top-12 bottom-0 w-px bg-border" />
              )}
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bg} shrink-0 z-10`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <Card className="border-border flex-1 mb-1">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="secondary" className="text-[9px]">{config.label}</Badge>
                    {CatIcon && entry.category && (
                      <Badge variant="outline" className="text-[9px] capitalize gap-0.5">
                        <CatIcon className={`h-2.5 w-2.5 ${catConfig!.color}`} />
                        {entry.category}
                      </Badge>
                    )}
                    {entry.neighborhood && (
                      <span className="text-[10px] text-muted-foreground">{entry.neighborhood}{entry.region ? `, ${entry.region}` : ""}</span>
                    )}
                    {entry.userHash && (
                      <span className="text-[10px] text-muted-foreground font-mono">{entry.userHash}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 ml-auto flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />{timeAgo(entry.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{entry.description}</p>
                  {entry.metadata?.amount && (
                    <Badge className="text-[9px] mt-1 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      +{entry.metadata.amount} credits
                    </Badge>
                  )}
                  {entry.metadata?.confidence && (
                    <Badge variant="outline" className="text-[9px] mt-1">
                      {entry.metadata.confidence}% confidence
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

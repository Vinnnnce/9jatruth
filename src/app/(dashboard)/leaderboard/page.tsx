"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Award, Medal, Crown, TrendingUp, Shield, ArrowUpDown, ShieldCheck } from "lucide-react";

type LeaderboardEntry = {
  userHash: string;
  totalCredits: number;
  submissions: number;
  verifications: number;
  trustScore: number;
  badge: string;
};

type SortKey = "trustScore" | "totalCredits";

const badgeConfig: Record<string, { icon: typeof Trophy; color: string }> = {
  "Veteran Reporter": { icon: Crown, color: "text-amber-500" },
  "Trusted Reporter": { icon: Medal, color: "text-purple-500" },
  "Active Reporter": { icon: Star, color: "text-blue-500" },
  "Newcomer": { icon: Award, color: "text-muted-foreground" },
};

function trustColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export default function Leaderboard() {
  const [sortKey, setSortKey] = useState<SortKey>("trustScore");

  const { data, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leaderboard");
      return res.json();
    },
  });

  // Sort client-side — default by trustScore
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (sortKey === "trustScore") {
        if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
        return b.totalCredits - a.totalCredits;
      }
      if (b.totalCredits !== a.totalCredits) return b.totalCredits - a.totalCredits;
      return b.trustScore - a.trustScore;
    });
  }, [data, sortKey]);

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  const top3 = sortedData.slice(0, 3);
  const rest = sortedData.slice(3);
  const totalCredits = data.reduce((s, u) => s + u.totalCredits, 0);
  const totalSubmissions = data.reduce((s, u) => s + u.submissions, 0);
  const avgTrust = data.length > 0 ? Math.round(data.reduce((s, u) => s + u.trustScore, 0) / data.length) : 0;

  const podiumStyles = [
    "border-amber-500/30 bg-amber-500/5",
    "border-slate-400/30 bg-slate-400/5",
    "border-orange-700/30 bg-orange-700/5",
  ];
  const podiumIcons = [Crown, Medal, Award];
  const podiumColors = ["text-amber-500", "text-slate-400", "text-orange-700"];

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-display font-700">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Top community contributors ranked by{" "}
            {sortKey === "trustScore" ? "trust score" : "credits earned"}
          </p>
        </div>
        {/* Sort toggle */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() =>
            setSortKey((k) => (k === "trustScore" ? "totalCredits" : "trustScore"))
          }
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortKey === "trustScore" ? "Trust Score" : "Credits"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Credits</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{totalCredits.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Submissions</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Trust</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{avgTrust}</p>
          </CardContent>
        </Card>
      </div>

      {/* Podium - Top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {top3.map((user, i) => {
            const PodiumIcon = podiumIcons[i];
            const color = podiumColors[i];
            const badge = badgeConfig[user.badge] || badgeConfig["Newcomer"];
            const BadgeIcon = badge.icon;
            return (
              <Card key={user.userHash} className={`border-border ${podiumStyles[i]} animate-fade-in`}>
                <CardContent className="p-4 text-center">
                  <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted`}>
                    <PodiumIcon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className={`text-2xl font-display font-700 ${color}`}>#{i + 1}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{user.userHash}</p>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <BadgeIcon className={`h-3 w-3 ${badge.color}`} />
                    <span className="text-[10px] text-muted-foreground">{user.badge}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-sm font-mono font-700 tabular-nums">{user.totalCredits}</p>
                      <p className="text-[9px] text-muted-foreground">Credits</p>
                    </div>
                    <div>
                      <p className="text-sm font-mono font-700 tabular-nums">{user.submissions}</p>
                      <p className="text-[9px] text-muted-foreground">Reports</p>
                    </div>
                    <div>
                      <p className={`text-sm font-mono font-700 tabular-nums ${trustColor(user.trustScore)}`}>{user.trustScore}</p>
                      <p className="text-[9px] text-muted-foreground">Trust</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rest of leaderboard */}
      {rest.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">All Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {rest.map((user, i) => {
                const rank = i + 4;
                const badge = badgeConfig[user.badge] || badgeConfig["Newcomer"];
                const BadgeIcon = badge.icon;
                return (
                  <div key={user.userHash} className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5 animate-fade-in">
                    {/* Rank number */}
                    <span className={`text-xs font-mono font-bold w-6 text-center shrink-0 ${trustColor(user.trustScore)}`}>
                      #{rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono">{user.userHash}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <BadgeIcon className={`h-2.5 w-2.5 ${badge.color}`} />
                        <span className="text-[9px] text-muted-foreground">{user.badge}</span>
                      </div>
                    </div>
                    {/* Trust score with mini progress bar */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <ShieldCheck className={`h-3 w-3 ${trustColor(user.trustScore)}`} />
                      <div className="w-12">
                        <Progress value={user.trustScore} className="h-1" />
                      </div>
                      <span className={`text-xs font-mono font-700 tabular-nums w-7 text-right ${trustColor(user.trustScore)}`}>
                        {user.trustScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-mono font-700 tabular-nums">{user.totalCredits}</p>
                        <p className="text-[9px] text-muted-foreground">credits</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-mono tabular-nums">{user.submissions}</p>
                        <p className="text-[9px] text-muted-foreground">reports</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

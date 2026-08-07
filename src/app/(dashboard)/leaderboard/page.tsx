"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Award, Medal, Crown, TrendingUp, Shield } from "lucide-react";

type LeaderboardEntry = {
  userHash: string;
  totalCredits: number;
  submissions: number;
  verifications: number;
  trustScore: number;
  badge: string;
};

const badgeConfig: Record<string, { icon: typeof Trophy; color: string }> = {
  "Veteran Reporter": { icon: Crown, color: "text-amber-500" },
  "Trusted Reporter": { icon: Medal, color: "text-purple-500" },
  "Active Reporter": { icon: Star, color: "text-blue-500" },
  "Newcomer": { icon: Award, color: "text-muted-foreground" },
};

export default function Leaderboard() {
  const { data, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leaderboard");
      return res.json();
    },
  });

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

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);
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
      <div>
        <h1 className="text-xl font-display font-700">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Top community contributors ranked by credits earned
        </p>
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
                      <p className="text-sm font-mono font-700 tabular-nums">{user.verifications}</p>
                      <p className="text-[9px] text-muted-foreground">Verified</p>
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
                const badge = badgeConfig[user.badge] || badgeConfig["Newcomer"];
                const BadgeIcon = badge.icon;
                return (
                  <div key={user.userHash} className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5 animate-fade-in">
                    <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center shrink-0">
                      {i + 4}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono">{user.userHash}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <BadgeIcon className={`h-2.5 w-2.5 ${badge.color}`} />
                        <span className="text-[9px] text-muted-foreground">{user.badge}</span>
                      </div>
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
                      <div className="text-right">
                        <p className="text-xs font-mono tabular-nums">{user.trustScore}</p>
                        <p className="text-[9px] text-muted-foreground">trust</p>
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

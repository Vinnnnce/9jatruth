"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, Trophy, Coins, Flame, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/**
 * Portfolio "Trends" sub-feature: shows what the community is talking about
 * (trending topics from community feeds) plus the contributor leaderboard and
 * a rewards summary. Rendered as a tab inside the Portfolio page.
 */
export function PortfolioTrends() {
  const trending = useQuery({
    queryKey: ["/api/feeds/trending"],
    queryFn: () => apiRequest("GET", "/api/feeds/trending").then((r) => r.json()),
    refetchInterval: 60000,
  });
  const leaderboard = useQuery({
    queryKey: ["/api/leaderboard"],
    queryFn: () => apiRequest("GET", "/api/leaderboard").then((r) => r.json()),
  });
  const rewards = useQuery({
    queryKey: ["/api/rewards/vouchers"],
    queryFn: () => apiRequest("GET", "/api/rewards/vouchers").then((r) => r.json()).catch(() => ({ vouchers: [] })),
  });

  const topics: any[] = trending.data?.topics ?? [];
  const topContributors: any[] = leaderboard.data?.leaderboard ?? leaderboard.data ?? [];
  const vouchers: any[] = rewards.data?.vouchers ?? [];

  return (
    <div className="space-y-4">
      {/* Trending topics */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Trending Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trending.isLoading && <Skeleton className="h-16 w-full" />}
          {topics.length === 0 && !trending.isLoading && (
            <p className="text-xs text-muted-foreground">No trending topics yet. Be the first to post in your community.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Badge key={t.tag} variant="outline" className="text-[10px] gap-1 py-1">
                {t.trend === "up" && <ArrowUpRight className="h-3 w-3 text-green-500" />}
                {t.trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                {t.trend === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className="font-semibold">{t.label || t.tag}</span>
                <span className="text-muted-foreground">{t.count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {leaderboard.isLoading && <Skeleton className="h-24 w-full" />}
            {topContributors.length === 0 && !leaderboard.isLoading && (
              <p className="text-xs text-muted-foreground">No contributors ranked yet.</p>
            )}
            {topContributors.slice(0, 8).map((c, i) => (
              <div key={c.userHash || i} className="flex items-center gap-2 text-xs">
                <span className={`w-5 font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{c.displayName || c.badge || "Contributor"}</span>
                <Coins className="h-3 w-3 text-amber-500" />
                <span className="text-muted-foreground">{c.totalCredits ?? 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Rewards summary */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" /> Rewards &amp; Vouchers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {rewards.isLoading && <Skeleton className="h-24 w-full" />}
            {vouchers.length === 0 && !rewards.isLoading && (
              <p className="text-xs text-muted-foreground">Redeem your credits for vouchers once they become available.</p>
            )}
            {vouchers.slice(0, 6).map((v, i) => (
              <div key={v.id || i} className="flex items-center gap-2 text-xs rounded-md border border-border p-1.5">
                <Flame className="h-3 w-3 text-orange-500" />
                <span className="flex-1 truncate font-medium">{v.title || v.name}</span>
                <Badge variant="secondary" className="text-[9px]">{v.cost ?? v.price ?? "—"} credits</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

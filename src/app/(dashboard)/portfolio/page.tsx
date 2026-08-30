"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity as ActivityIcon,
  Trophy,
  Wallet,
  BarChart3,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
// Render the full, rich standalone feature pages inside the portfolio tabs so the
// UI/UX is preserved (podiums, timelines, redemption flows, charts) instead of
// the stripped-down inline versions that caused the UI to "disappear".
import LeaderboardPage from "../leaderboard/page";
import ActivityPage from "../activity/page";
import RewardsPage from "../rewards/page";

type TrendsData = {
  categoryTrends: Array<{ category: string; count: number; avgTrust: number; trendDirection: string }>;
  timeSeriesData: Array<{ hour: string; power: number; fuel: number; traffic: number; prices: number; safety: number }>;
  topNeighborhoods: Array<{ name: string; region: string; truths: number; avgTrust: number }>;
};

function TrendsTab() {
  const { data, isLoading, isError } = useQuery<TrendsData>({
    queryKey: ["/api/trends"],
    queryFn: () => apiRequest("GET", "/api/trends").then((r) => r.json()),
    retry: 1,
  });
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Trends data is unavailable right now. Please try again later.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4" /> Category Trends
          </div>
          <div className="space-y-2">
            {data.categoryTrends?.map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-3">
                <span className="text-sm capitalize">{c.category}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.count} reports</Badge>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            ))}
            {data.categoryTrends?.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-base font-semibold">Reports over the last 6 hours</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.timeSeriesData ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="power" stackId="1" stroke="#f59e0b" fill="#f59e0b33" />
              <Area type="monotone" dataKey="fuel" stackId="1" stroke="#f97316" fill="#f9731633" />
              <Area type="monotone" dataKey="traffic" stackId="1" stroke="#3b82f6" fill="#3b82f633" />
              <Area type="monotone" dataKey="safety" stackId="1" stroke="#22c55e" fill="#22c55e33" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

type QuickCardProps = {
  icon: typeof Trophy;
  label: string;
  desc: string;
  onClick: () => void;
};
function QuickCard({ icon: Icon, label, desc, onClick }: QuickCardProps) {
  return (
    <button onClick={onClick} className="text-left rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (t: string) => void }) {
  const balanceQ = useQuery<{ balance?: number }>({
    queryKey: ["/api/rewards/balance"],
    queryFn: () => apiRequest("GET", "/api/rewards/balance").then((r) => r.json()).catch(() => ({ balance: 0 })),
    retry: 1,
  });
  const leaderboardQ = useQuery<any>({
    queryKey: ["/api/leaderboard"],
    queryFn: () => apiRequest("GET", "/api/leaderboard").then((r) => r.json()).catch(() => []),
    retry: 1,
  });
  const rows: any[] = Array.isArray(leaderboardQ.data)
    ? leaderboardQ.data
    : leaderboardQ.data?.leaderboard ?? leaderboardQ.data?.top ?? [];
  const balance = balanceQ.data?.balance ?? 0;
  const topContributor = rows[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Credit Balance</span>
            </div>
            {balanceQ.isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold tabular-nums">{balance}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Top Contributor</span>
            </div>
            {leaderboardQ.isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-sm font-semibold truncate">{topContributor?.displayName || "—"}</p>}
            {topContributor && <p className="text-xs text-muted-foreground">{topContributor.totalCredits ?? 0} credits</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ActivityIcon className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Contributors</span>
            </div>
            {leaderboardQ.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold tabular-nums">{rows.length}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QuickCard icon={ActivityIcon} label="Activity Timeline" desc="Live submissions, verifications & alerts" onClick={() => onNavigate("activity")} />
        <QuickCard icon={Trophy} label="Leaderboard" desc="Top contributors & rankings" onClick={() => onNavigate("leaderboard")} />
        <QuickCard icon={Wallet} label="Rewards & Credits" desc="Balance, redemptions & history" onClick={() => onNavigate("rewards")} />
      </div>

      <TrendsTab />
    </div>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="space-y-6">
      <div className="p-4 md:p-6 pb-0">
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your contributions, activity, trends, leaderboard standing, and rewards.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="px-4 md:px-6">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="p-4 md:p-6 pt-0 mt-0"><OverviewTab onNavigate={setTab} /></TabsContent>
        <TabsContent value="activity" className="mt-0"><ActivityPage /></TabsContent>
        <TabsContent value="trends" className="p-4 md:p-6 pt-0 mt-0"><TrendsTab /></TabsContent>
        <TabsContent value="leaderboard" className="mt-0"><LeaderboardPage /></TabsContent>
        <TabsContent value="rewards" className="mt-0"><RewardsPage /></TabsContent>
      </Tabs>
    </div>
  );
}

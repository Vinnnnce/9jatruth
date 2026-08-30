"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Trophy, Gift, Wallet, BarChart3, Send, ShieldCheck, Coins, AlertCircle, Activity as ActivityIcon } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type TrendsData = {
  categoryTrends: Array<{ category: string; count: number; avgTrust: number; trendDirection: string }>;
  timeSeriesData: Array<{ hour: string; power: number; fuel: number; traffic: number; prices: number; safety: number }>;
  topNeighborhoods: Array<{ name: string; region: string; truths: number; avgTrust: number }>;
};

type LeaderboardEntry = {
  userHash?: string;
  displayName?: string;
  totalCredits?: number;
  submissions?: number;
  verifications?: number;
  avgTrust?: number;
  tier?: string;
  rank?: number;
};

type ActivityEntry = {
  id: string;
  type: "truth_submitted" | "truth_verified" | "reward_earned" | "prediction_made" | "alert_triggered" | string;
  description: string;
  userHash?: string;
  category?: string;
  neighborhood?: string;
  region?: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

const ACTIVITY_CONFIG: Record<string, { icon: typeof Send; color: string; bg: string; label: string }> = {
  truth_submitted: { icon: Send, color: "text-blue-500", bg: "bg-blue-500/10", label: "Truth Submitted" },
  truth_verified: { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10", label: "Verification" },
  reward_earned: { icon: Coins, color: "text-amber-500", bg: "bg-amber-500/10", label: "Reward Earned" },
  prediction_made: { icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", label: "AI Prediction" },
  alert_triggered: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Alert" },
};

function TrendIcon({ dir }: { dir: string }) {
  if (dir === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (dir === "down") return <TrendingDown className="h-4 w-4 text-rose-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function TrendsTab() {
  const { data, isLoading } = useQuery<TrendsData>({
    queryKey: ["/api/trends"],
    queryFn: () => apiRequest("GET", "/api/trends").then((r) => r.json()),
  });
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No trends data yet.</p>;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Category Trends</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.categoryTrends?.map((c) => (
            <div key={c.category} className="flex items-center justify-between gap-3">
              <span className="text-sm capitalize">{c.category}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{c.count} reports</Badge>
                <TrendIcon dir={c.trendDirection} />
              </div>
            </div>
          ))}
          {data.categoryTrends?.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Reports over the last 6 hours</CardTitle></CardHeader>
        <CardContent>
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

function LeaderboardTab() {
  const { data, isLoading } = useQuery<{ leaderboard?: LeaderboardEntry[]; top?: LeaderboardEntry[] }>({
    queryKey: ["/api/leaderboard"],
    queryFn: () => apiRequest("GET", "/api/leaderboard").then((r) => r.json()),
  });
  const rows = data?.leaderboard ?? data?.top ?? [];
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4" /> Top Contributors</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.slice(0, 25).map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">{i + 1}</span>
              <span className="text-sm font-medium">{r.displayName || "Anonymous"}</span>
              {r.tier && <Badge variant="outline" className="capitalize">{r.tier}</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{r.submissions ?? 0} posts</span>
              <span>{r.verifications ?? 0} verifies</span>
              <span className="font-semibold text-foreground">{r.totalCredits ?? 0} pts</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Leaderboard is empty. Be the first to contribute.</p>}
      </CardContent>
    </Card>
  );
}

function RewardsTab() {
  const balanceQ = useQuery<{ balance?: number }>({
    queryKey: ["/api/rewards/balance"],
    queryFn: () => apiRequest("GET", "/api/rewards/balance").then((r) => r.json()),
  });
  const ledgerQ = useQuery<any[]>({
    queryKey: ["/api/rewards/ledger"],
    queryFn: () => apiRequest("GET", "/api/rewards/ledger").then((r) => r.json()),
  });
  const balance = balanceQ.data?.balance ?? 0;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Rewards Balance</CardTitle></CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{balance} <span className="text-sm font-normal text-muted-foreground">points</span></div>
          <Progress className="mt-3" value={Math.min((balance / 1000) * 100, 100)} />
          <p className="mt-2 text-xs text-muted-foreground">Earn points by posting truths, verifying reports, and referring others.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(ledgerQ.data ?? []).slice(0, 12).map((e, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{e?.description ?? e?.type ?? "Reward"}</span>
              <span className="font-semibold">{e?.amount ?? 0} pts</span>
            </div>
          ))}
          {(ledgerQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No reward activity yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityTab() {
  const { data, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity"],
    queryFn: () => apiRequest("GET", "/api/activity?limit=50").then((r) => r.json()),
    retry: 1,
  });
  const rows = data ?? [];
  if (isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ActivityIcon className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.slice(0, 40).map((e, i) => {
          const cfg = ACTIVITY_CONFIG[e.type] ?? ACTIVITY_CONFIG.truth_submitted;
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-3 border-b pb-2 last:border-0">
              <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${cfg.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{cfg.label}</Badge>
                  {e.category && <span className="text-[10px] text-muted-foreground capitalize">{e.category}</span>}
                </div>
                <p className="text-sm text-foreground/90 truncate">{e.description}</p>
                {e.neighborhood && <p className="text-[10px] text-muted-foreground">{e.neighborhood}{e.region ? `, ${e.region}` : ""}</p>}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Start by submitting or verifying a truth.</p>}
      </CardContent>
    </Card>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState("overview");
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Your contributions, activity, trends, leaderboard standing, and rewards.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <RewardsTab />
            <LeaderboardTab />
          </div>
        </TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="trends"><TrendsTab /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

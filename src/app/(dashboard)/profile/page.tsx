"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  User, ShieldCheck, Coins, Send, Award, TrendingUp, Clock,
  Zap, Fuel, Car, Tag, Shield,
} from "lucide-react";

type RewardLedger = {
  id: number;
  userHash: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

type LeaderboardEntry = {
  userHash: string;
  totalCredits: number;
  submissions: number;
  verifications: number;
  trustScore: number;
  badge: string;
};

type ActivityEntry = {
  id: string;
  type: string;
  description: string;
  userHash?: string;
  category?: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

const categoryConfig: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  power: { icon: Zap, color: "text-amber-500", label: "Power" },
  fuel: { icon: Fuel, color: "text-orange-500", label: "Fuel" },
  traffic: { icon: Car, color: "text-blue-500", label: "Traffic" },
  prices: { icon: Tag, color: "text-purple-500", label: "Prices" },
  safety: { icon: Shield, color: "text-green-500", label: "Safety" },
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

const DEMO_USER = "dev_1d6e";

export default function Profile() {
  const { data: balance } = useQuery<{ userHash: string; balance: number }>({
    queryKey: ["/api/rewards/balance", DEMO_USER],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rewards/balance?userHash=${DEMO_USER}`);
      return res.json();
    },
  });

  const { data: ledger } = useQuery<RewardLedger[]>({
    queryKey: ["/api/rewards/ledger", DEMO_USER],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/rewards/ledger?userHash=${DEMO_USER}`);
      return res.json();
    },
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  const { data: activity } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity", DEMO_USER],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/activity?limit=50");
      return res.json();
    },
  });

  const myEntry = leaderboard?.find(e => e.userHash === DEMO_USER);
  const myRank = leaderboard?.findIndex(e => e.userHash === DEMO_USER) ?? -1;
  const myActivity = activity?.filter(a => a.userHash === DEMO_USER) ?? [];

  if (!myEntry) {
    return (
      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Device profile, trust score, rewards, and contribution history
        </p>
      </div>

      {/* Profile Header */}
      <Card className="border-border">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-display font-700 font-mono">{DEMO_USER}</h2>
                <Badge className="gap-0.5 bg-primary/15 text-primary hover:bg-primary/20">
                  <Award className="h-3 w-3" /> {myEntry.badge}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rank #{myRank + 1} on the leaderboard
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-[10px] text-muted-foreground uppercase">Trust Score</span>
                  </div>
                  <p className="text-xl font-display font-700 tabular-nums">{myEntry.trustScore}</p>
                  <Progress value={myEntry.trustScore} className="h-1 mt-1" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[10px] text-muted-foreground uppercase">Credits</span>
                  </div>
                  <p className="text-xl font-display font-700 tabular-nums">{balance?.balance ?? myEntry.totalCredits}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-[10px] text-muted-foreground uppercase">Submissions</span>
                  </div>
                  <p className="text-xl font-display font-700 tabular-nums">{myEntry.submissions}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-[10px] text-muted-foreground uppercase">Verifications</span>
                  </div>
                  <p className="text-xl font-display font-700 tabular-nums">{myEntry.verifications}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Rewards */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              Reward History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger?.slice(0, 8).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2 animate-fade-in">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                    entry.amount > 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                  }`}>
                    {entry.amount > 0 ? "+" : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">{entry.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] capitalize">{entry.type}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{timeAgo(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold shrink-0 ${entry.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                    {entry.amount > 0 ? "+" : ""}{entry.amount}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My Activity */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              My Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myActivity.length > 0 ? myActivity.slice(0, 8).map((entry) => {
                const catConfig = entry.category ? categoryConfig[entry.category] : null;
                const CatIcon = catConfig?.icon;
                return (
                  <div key={entry.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2 animate-fade-in">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      {CatIcon ? <CatIcon className={`h-3 w-3 ${catConfig!.color}`} /> : <Send className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed line-clamp-2">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[9px] capitalize">{entry.type.replace(/_/g, " ")}</Badge>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Badge Progress */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Badge Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: "Newcomer", req: 0, icon: User, color: "text-slate-400" },
              { name: "Active Reporter", req: 2, icon: Send, color: "text-blue-500" },
              { name: "Trusted Reporter", req: 5, icon: ShieldCheck, color: "text-green-500" },
              { name: "Veteran Reporter", req: 10, icon: Award, color: "text-amber-500" },
            ].map((badge) => {
              const earned = myEntry.submissions >= badge.req;
              const BIcon = badge.icon;
              return (
                <div key={badge.name} className={`rounded-md p-3 text-center ${earned ? "bg-primary/5 border border-primary/20" : "bg-muted/30 opacity-50"}`}>
                  <BIcon className={`h-5 w-5 mx-auto mb-1 ${earned ? badge.color : "text-muted-foreground"}`} />
                  <p className="text-[10px] font-medium">{badge.name}</p>
                  <p className="text-[9px] text-muted-foreground">{badge.req}+ submissions</p>
                  {earned && <Badge className="text-[8px] mt-1 h-3.5 bg-green-500/15 text-green-600 dark:text-green-400">Earned</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

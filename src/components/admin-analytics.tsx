"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, Users, Newspaper, Heart, MessageSquare, Share2, UserPlus, ShieldCheck, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

type AdminAnalytics = {
  totals: {
    truths: number; users: number; organizations: number; verifications: number;
    likes: number; comments: number; shares: number; subscriptions: number;
  };
  byCategory: { category: string; count: number }[];
  byRegion: { region: string; count: number }[];
  byState: { state: string; count: number }[];
  byLga?: { lga: string; count: number }[];
  postsTrend: { date: string; count: number }[];
  usersTrend: { date: string; count: number }[];
  topContributors: { userHash: string; count: number }[];
  verificationRate: { verified: number; rejected?: number; refuted?: number; pending: number; total: number };
  trustScoreDistribution?: {
    high: number; mediumHigh: number; medium: number; low: number; veryLow: number;
  };
  trustTrend?: { date: string; avgTrust: number }[];
  engagementByType?: { type: string; count: number }[];
  engagementTrend: { date: string; type: string; count: number }[];
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdminAnalytics() {
  const { data, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/analytics/overview"],
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.totals.truths > 0 || data.totals.users > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No platform analytics yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Analytics will appear once users start posting and engaging
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform engagement data
  const engagementMap = new Map<string, { date: string; likes: number; comments: number; shares: number }>();
  data.engagementTrend.forEach((item) => {
    const key = item.date;
    if (!engagementMap.has(key)) {
      engagementMap.set(key, { date: formatDate(item.date), likes: 0, comments: 0, shares: 0 });
    }
    const entry = engagementMap.get(key)!;
    if (item.type === "likes") entry.likes += item.count;
    if (item.type === "comments") entry.comments += item.count;
    if (item.type === "shares") entry.shares += item.count;
  });
  const engagementData = Array.from(engagementMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const postsTrend = data.postsTrend.map((item) => ({
    date: formatDate(item.date),
    posts: item.count,
  }));

  const usersTrend = data.usersTrend.map((item) => ({
    date: formatDate(item.date),
    users: item.count,
  }));

  // Trust score distribution pie data
  const trustDistData = data.trustScoreDistribution ? [
    { name: "High (80+)", value: data.trustScoreDistribution.high, color: "#10b981" },
    { name: "Good (60-79)", value: data.trustScoreDistribution.mediumHigh, color: "#0ea5e9" },
    { name: "Medium (40-59)", value: data.trustScoreDistribution.medium, color: "#f59e0b" },
    { name: "Low (20-39)", value: data.trustScoreDistribution.low, color: "#f97316" },
    { name: "Very Low (<20)", value: data.trustScoreDistribution.veryLow, color: "#ef4444" },
  ].filter(d => d.value > 0) : [];

  // Verification rate pie data
  const vRate = data.verificationRate;
  const rejectedCount = (vRate.rejected ?? vRate.refuted ?? 0);
  const verificationData = [
    { name: "Verified", value: vRate.verified, color: "#10b981" },
    { name: "Rejected", value: rejectedCount, color: "#ef4444" },
    { name: "Pending", value: vRate.pending, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  // Trust trend data
  const trustTrendData = (data.trustTrend ?? []).map((item) => ({
    date: formatDate(item.date),
    avgTrust: item.avgTrust,
  }));

  // Engagement by type bar data
  const engagementByTypeData = (data.engagementByType ?? []).map((item) => ({
    type: item.type,
    count: item.count,
  }));

  // LGA data
  const lgaData = (data.byLga ?? []).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Engagement KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <AdminKPICard icon={Newspaper} color="text-blue-500" label="Truths" value={data.totals.truths} />
        <AdminKPICard icon={Users} color="text-green-500" label="Users" value={data.totals.users} />
        <AdminKPICard icon={Heart} color="text-red-500" label="Likes" value={data.totals.likes} />
        <AdminKPICard icon={MessageSquare} color="text-purple-500" label="Comments" value={data.totals.comments} />
        <AdminKPICard icon={Share2} color="text-orange-500" label="Shares" value={data.totals.shares} />
        <AdminKPICard icon={UserPlus} color="text-pink-500" label="Subs" value={data.totals.subscriptions} />
        <AdminKPICard icon={Trophy} color="text-amber-500" label="Verifications" value={data.totals.verifications} />
        <AdminKPICard icon={TrendingUp} color="text-teal-500" label="Orgs" value={data.totals.organizations} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Posts by Region */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posts by Region</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byRegion.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.byRegion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="region" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* User Growth Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">User Growth (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {usersTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={usersTrend}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="users" stroke="#10b981" fill="url(#colorUsers)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* Posts Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posts Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {postsTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={postsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="posts" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={200} />
            )}
          </CardContent>
        </Card>

        {/* Engagement Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={engagementData}>
                  <defs>
                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorComments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorShares" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="likes" stroke="#ef4444" fill="url(#colorLikes)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="comments" stroke="#8b5cf6" fill="url(#colorComments)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="shares" stroke="#f59e0b" fill="url(#colorShares)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={200} />
            )}
          </CardContent>
        </Card>

        {/* Trust Score Distribution — Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Trust Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trustDistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={trustDistData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={40}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    style={{ fontSize: 10 }}
                  >
                    {trustDistData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* Verification Rate — Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Verification Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verificationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={verificationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                    style={{ fontSize: 10 }}
                  >
                    {verificationData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* Posts by LGA — Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Posts by LGA / State
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lgaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={lgaData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="lga" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip cursor={{ fill: "rgba(139,92,246,0.08)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* Trust Score Trend — Line */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Trust Score Trend (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trustTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trustTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgTrust" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={240} />
            )}
          </CardContent>
        </Card>

        {/* Engagement by Type — Bar */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Total Engagement by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {engagementByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={engagementByTypeData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(99,102,241,0.08)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {engagementByTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart height={200} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Contributors */}
      {data.topContributors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {data.topContributors.map((contributor, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border p-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${ 
                    i === 0 ? "bg-amber-500/15 text-amber-500" :
                    i === 1 ? "bg-slate-400/15 text-slate-400" :
                    i === 2 ? "bg-orange-700/15 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground flex-1">
                    {contributor.userHash.substring(0, 16)}...
                  </span>
                  <span className="text-xs font-semibold">{contributor.count} posts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AdminKPICard({ icon: Icon, color, label, value }: {
  icon: typeof Heart;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-2.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-[9px] text-muted-foreground truncate">{label}</span>
        </div>
        <p className="text-lg font-bold mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ height = 220 }: { height?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-xs text-muted-foreground">No data yet</p>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Users, Heart, MessageSquare } from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

type UserAnalytics = {
  stats: {
    posts: number;
    verifications: number;
    likesGiven: number;
    likesReceived: number;
    comments: number;
    subscriptions: number;
    subscribers: number;
    rewardPoints: number;
  };
  postsByCategory: { category: string; count: number }[];
  postingTrend: { date: string; count: number }[];
  engagementTrend: { date: string; type: string; count: number }[];
  recentPosts: {
    id: number; category: string; content: string; status: string;
    createdAt: string; likeCount: number; commentCount: number; shareCount: number;
  }[];
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DashboardAnalytics() {
  const { data, isLoading } = useQuery<UserAnalytics>({
    queryKey: ["/api/analytics/user"],
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

  const hasData = data.stats.posts > 0 || data.engagementTrend.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Newspaper className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No analytics yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Post reports and engage with the community to see analytics here
          </p>
        </CardContent>
      </Card>
    );
  }

  const categoryData = data.postsByCategory.map((item, i) => ({
    name: item.category,
    value: item.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const postingData = data.postingTrend.map((item) => ({
    date: formatDate(item.date),
    posts: item.count,
  }));

  // Transform engagement data
  const engagementMap = new Map<string, { date: string; likes: number; comments: number }>();
  data.engagementTrend.forEach((item) => {
    const key = item.date;
    if (!engagementMap.has(key)) {
      engagementMap.set(key, { date: formatDate(item.date), likes: 0, comments: 0 });
    }
    const entry = engagementMap.get(key)!;
    if (item.type === "likes") entry.likes += item.count;
    if (item.type === "comments") entry.comments += item.count;
  });
  const engagementData = Array.from(engagementMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Newspaper} color="text-blue-500" label="Your Posts" value={data.stats.posts} />
        <KPICard icon={Heart} color="text-red-500" label="Likes Received" value={data.stats.likesReceived} />
        <KPICard icon={MessageSquare} color="text-purple-500" label="Comments" value={data.stats.comments} />
        <KPICard icon={Users} color="text-green-500" label="Subscribers" value={data.stats.subscribers} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Timeline (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {postingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={postingData}>
                  <defs>
                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="posts"
                    stroke="#0ea5e9"
                    fill="url(#colorActivity)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px]">
                <p className="text-xs text-muted-foreground">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Trend */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Trend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Line type="monotone" dataKey="likes" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="comments" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-xs text-muted-foreground">No engagement data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, color, label, value }: {
  icon: typeof Heart;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

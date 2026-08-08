"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Heart, MessageSquare, Users, Coins, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
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

export function UserAnalyticsCharts() {
  const { data, isLoading } = useQuery<UserAnalytics>({
    queryKey: ["/api/analytics/user"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;
  const hasData = stats.posts > 0 || stats.likesReceived > 0 || stats.comments > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No analytics data yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Start posting and engaging to see your analytics here
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform engagement data for stacked area chart
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

  const postingData = data.postingTrend.map((item) => ({
    date: formatDate(item.date),
    count: item.count,
  }));

  const categoryData = data.postsByCategory.map((item, i) => ({
    name: item.category,
    value: item.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Newspaper} color="text-blue-500" label="Posts" value={stats.posts} />
        <StatCard icon={Heart} color="text-red-500" label="Likes Received" value={stats.likesReceived} />
        <StatCard icon={MessageSquare} color="text-purple-500" label="Comments" value={stats.comments} />
        <StatCard icon={Users} color="text-green-500" label="Subscribers" value={stats.subscribers} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Posts by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posts by Category</CardTitle>
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
                    innerRadius={40}
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
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* Posting Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Posting Activity (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {postingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={postingData}>
                  <defs>
                    <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    fill="url(#colorPosts)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement Breakdown (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="likes" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comments" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Posts with engagement */}
      {data.recentPosts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 rounded-md border p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{post.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {post.category} · {post.status} · {formatDate(post.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-3 w-3" /> {post.likeCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="h-3 w-3" /> {post.commentCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Users className="h-3 w-3" /> {post.shareCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: {
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

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[220px]">
      <p className="text-xs text-muted-foreground">No data yet</p>
    </div>
  );
}

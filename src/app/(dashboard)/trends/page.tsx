"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Zap, Fuel, Car, Tag, Shield, TrendingUp, TrendingDown, Minus,
  BarChart3, MapPin, Activity, Award,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

type TrendsData = {
  categoryTrends: Array<{ category: string; count: number; avgTrust: number; trendDirection: string }>;
  neighborhoodTrends: Array<{ neighborhood: string; region: string; category: string; count: number; avgTrust: number }>;
  timeSeriesData: Array<{ hour: string; power: number; fuel: number; traffic: number; prices: number; safety: number }>;
  topNeighborhoods: Array<{ name: string; region: string; truths: number; avgTrust: number; safetyIndex: number }>;
};

const categoryConfig: Record<string, { icon: typeof Zap; color: string; label: string; chartColor: string }> = {
  power: { icon: Zap, color: "text-amber-500", label: "Power", chartColor: "#f59e0b" },
  fuel: { icon: Fuel, color: "text-orange-500", label: "Fuel", chartColor: "#f97316" },
  traffic: { icon: Car, color: "text-blue-500", label: "Traffic", chartColor: "#3b82f6" },
  prices: { icon: Tag, color: "text-purple-500", label: "Prices", chartColor: "#a855f7" },
  safety: { icon: Shield, color: "text-green-500", label: "Safety", chartColor: "#22c55e" },
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--popover-border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

export default function Trends() {
  const { data, isLoading } = useQuery<TrendsData>({
    queryKey: ["/api/trends"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/trends");
      return res.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const radarData = data.categoryTrends.map((c) => ({
    category: categoryConfig[c.category]?.label || c.category,
    reports: c.count,
    trust: c.avgTrust,
  }));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Trends & Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Aggregate insights across neighborhoods, categories, and time
        </p>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.categoryTrends.map((cat) => {
          const config = categoryConfig[cat.category];
          const Icon = config?.icon || Activity;
          const TrendIcon = cat.trendDirection === "up" ? TrendingUp : cat.trendDirection === "down" ? TrendingDown : Minus;
          const trendColor = cat.trendDirection === "up" ? "text-green-500" : cat.trendDirection === "down" ? "text-red-500" : "text-muted-foreground";
          return (
            <Card key={cat.category} className="border-border animate-fade-in">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Icon className={`h-4 w-4 ${config?.color}`} />
                  </div>
                  <div className={trendColor}>
                    <TrendIcon className="h-3.5 w-3.5" />
                  </div>
                </div>
                <p className="text-lg font-display font-700 tabular-nums">{cat.count}</p>
                <p className="text-[10px] text-muted-foreground">{config?.label || cat.category}</p>
                <div className="mt-1.5">
                  <Progress value={cat.avgTrust} className="h-1" />
                  <p className="text-[9px] text-muted-foreground mt-0.5">{cat.avgTrust} avg trust</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Time Series Chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Report Activity Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.timeSeriesData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                {Object.entries(categoryConfig).map(([key, cfg]) => (
                  <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={cfg.chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={cfg.chartColor} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={cfg.chartColor}
                  fill={`url(#gradient-${key})`}
                  strokeWidth={2}
                  name={cfg.label}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="Reports" dataKey="reports" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Neighborhoods */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Top Neighborhoods by Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topNeighborhoods.slice(0, 8).map((n, i) => (
                <div key={n.name} className="flex items-center gap-3 rounded-md bg-muted/30 p-2.5 animate-fade-in">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold shrink-0 ${
                    i === 0 ? "bg-amber-500/15 text-amber-500" :
                    i === 1 ? "bg-slate-400/15 text-slate-400" :
                    i === 2 ? "bg-orange-700/15 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate">{n.name}</span>
                      <span className="text-[9px] text-muted-foreground">{n.region}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{n.truths} truths</span>
                      <span className="text-[10px] text-muted-foreground">Trust: <span className="text-foreground font-mono">{n.avgTrust}</span></span>
                      <span className="text-[10px] text-muted-foreground">Safety: <span className="text-foreground font-mono">{n.safetyIndex}</span></span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] tabular-nums shrink-0">
                    {n.truths}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Neighborhood × Category Breakdown */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Neighborhood × Category Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={data.neighborhoodTrends}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="neighborhood"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                angle={-30}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <Bar key={key} dataKey="count" name={cfg.label} fill={cfg.chartColor} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Shows report counts across neighborhoods grouped by category
          </p>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Reports", value: data.categoryTrends.reduce((s, c) => s + c.count, 0), icon: BarChart3 },
          { label: "Categories Tracked", value: data.categoryTrends.length, icon: Activity },
          { label: "Neighborhoods", value: data.topNeighborhoods.length, icon: MapPin },
          {
            label: "Avg Trust Score",
            value: Math.round(data.categoryTrends.reduce((s, c) => s + c.avgTrust, 0) / (data.categoryTrends.length || 1)),
            icon: Shield,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                </div>
                <p className="text-lg font-display font-700 tabular-nums">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

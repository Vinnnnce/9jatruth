"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Fuel, Car, Tag, Shield, GitCompare, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

type DashboardData = {
  neighborhood: { id: number; name: string; region: string; lat: number; lng: number };
  snapshot: {
    powerStatus: string; fuelStatus: string; trafficLevel: string;
    priceIndex: number; safetyIndex: number; activeTruths: number;
  } | undefined;
  recentTruths: Array<{ id: number; category: string; content: string; trustScore: number }>;
  predictions: Array<{ id: number; category: string; prediction: string; confidence: number; trend: string }>;
};

const statusConfig: Record<string, { color: string; label: string; value: number }> = {
  on: { color: "text-green-500", label: "On", value: 100 },
  off: { color: "text-red-500", label: "Off", value: 0 },
  unstable: { color: "text-amber-500", label: "Unstable", value: 50 },
  available: { color: "text-green-500", label: "Available", value: 100 },
  scarce: { color: "text-amber-500", label: "Scarce", value: 40 },
  unavailable: { color: "text-red-500", label: "Unavailable", value: 0 },
  low: { color: "text-green-500", label: "Low", value: 90 },
  moderate: { color: "text-blue-500", label: "Moderate", value: 60 },
  heavy: { color: "text-amber-500", label: "Heavy", value: 30 },
  gridlock: { color: "text-red-500", label: "Gridlock", value: 10 },
};

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--popover-border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
};

export default function Compare() {
  const { data, isLoading } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
  });

  const [idA, setIdA] = useState<string>("");
  const [idB, setIdB] = useState<string>("");

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const a = data.find(d => d.neighborhood.id === parseInt(idA));
  const b = data.find(d => d.neighborhood.id === parseInt(idB));

  const getMetrics = (d: DashboardData | undefined) => {
    if (!d?.snapshot) return null;
    const s = d.snapshot;
    return [
      { metric: "Power", value: statusConfig[s.powerStatus]?.value ?? 50, label: statusConfig[s.powerStatus]?.label ?? s.powerStatus },
      { metric: "Fuel", value: statusConfig[s.fuelStatus]?.value ?? 50, label: statusConfig[s.fuelStatus]?.label ?? s.fuelStatus },
      { metric: "Traffic", value: statusConfig[s.trafficLevel]?.value ?? 50, label: statusConfig[s.trafficLevel]?.label ?? s.trafficLevel },
      { metric: "Prices", value: Math.max(0, 200 - s.priceIndex), label: `${s.priceIndex}` },
      { metric: "Safety", value: s.safetyIndex, label: `${s.safetyIndex}` },
    ];
  };

  const metricsA = getMetrics(a);
  const metricsB = getMetrics(b);

  const radarData = metricsA && metricsB
    ? metricsA.map((m, i) => ({
        metric: m.metric,
        [a?.neighborhood.name || "A"]: m.value,
        [b?.neighborhood.name || "B"]: metricsB[i].value,
      }))
    : [];

  const barData = a && b
    ? [
        { label: "Truths", [a.neighborhood.name]: a.recentTruths.length, [b.neighborhood.name]: b.recentTruths.length },
        { label: "Predictions", [a.neighborhood.name]: a.predictions.length, [b.neighborhood.name]: b.predictions.length },
        { label: "Safety", [a.neighborhood.name]: a.snapshot?.safetyIndex ?? 0, [b.neighborhood.name]: b.snapshot?.safetyIndex ?? 0 },
        { label: "Price Idx", [a.neighborhood.name]: a.snapshot?.priceIndex ?? 0, [b.neighborhood.name]: b.snapshot?.priceIndex ?? 0 },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-primary" />
          Compare Neighborhoods
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Side-by-side comparison of live conditions and metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Neighborhood A</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={idA} onValueChange={setIdA}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
              <SelectContent>
                {data.map(d => (
                  <SelectItem key={d.neighborhood.id} value={String(d.neighborhood.id)}>
                    {d.neighborhood.name}, {d.neighborhood.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Neighborhood B</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={idB} onValueChange={setIdB}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select neighborhood" /></SelectTrigger>
              <SelectContent>
                {data.map(d => (
                  <SelectItem key={d.neighborhood.id} value={String(d.neighborhood.id)}>
                    {d.neighborhood.name}, {d.neighborhood.region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {a && b && metricsA && metricsB ? (
        <>
          {/* Metric comparison cards */}
          <div className="grid grid-cols-5 gap-2">
            {metricsA.map((m, i) => {
              const mB = metricsB[i];
              const winner = m.value > mB.value ? "a" : mB.value > m.value ? "b" : "tie";
              return (
                <Card key={m.metric} className="border-border">
                  <CardContent className="p-2 md:p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.metric}</p>
                    <p className={`text-sm font-mono font-700 mt-0.5 ${winner === "a" ? "text-green-500" : ""}`}>{m.label}</p>
                    <ArrowRight className="h-2.5 w-2.5 text-muted-foreground mx-auto my-0.5" />
                    <p className={`text-sm font-mono font-700 ${winner === "b" ? "text-green-500" : ""}`}>{mB.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Radar comparison */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Condition Radar</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Radar name={a.neighborhood.name} dataKey={a.neighborhood.name} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    <Radar name={b.neighborhood.name} dataKey={b.neighborhood.name} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bar comparison */}
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} stroke="hsl(var(--border))" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey={a.neighborhood.name} fill="hsl(var(--primary))" />
                    <Bar dataKey={b.neighborhood.name} fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Predictions comparison */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">AI Predictions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[a, b].map((d, idx) => (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{d.neighborhood.name}</p>
                    {d.predictions.slice(0, 3).map(p => {
                      const TrendIcon = p.trend === "up" ? TrendingUp : p.trend === "down" ? TrendingDown : Minus;
                      const trendColor = p.trend === "up" ? "text-green-500" : p.trend === "down" ? "text-red-500" : "text-blue-500";
                      return (
                        <div key={p.id} className="rounded-md bg-muted/30 p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <TrendIcon className={`h-3 w-3 ${trendColor}`} />
                            <span className="text-[10px] text-muted-foreground capitalize">{p.category}</span>
                            <Badge variant="outline" className="text-[9px] ml-auto">{p.confidence}%</Badge>
                          </div>
                          <p className="text-[11px]">{p.prediction}</p>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <GitCompare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select two neighborhoods above to compare</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Zap, Fuel, Car, Tag, Shield, TrendingUp, Activity, AlertCircle,
  CheckCircle2, MapPin, Users, Newspaper, Store, CloudRain, AlertTriangle, Wifi, Cpu,
} from "lucide-react";
import Link from "next/link";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { LocationPreferences } from "@/components/location-preferences";
import { PredictiveNotifications } from "@/components/predictive-notifications";
import { HyperPersonalizedDashboard } from "@/components/hyper-personalized-dashboard";
import { PredictiveInterface } from "@/components/predictive-interface";
import { PredictiveNavigation } from "@/components/predictive-navigation";

type DashboardData = Array<{
  neighborhood: { id: number; name: string; region: string; lat: number; lng: number };
  snapshot?: {
    powerStatus: string;
    fuelStatus: string;
    trafficLevel: string;
    priceIndex: number;
    safetyIndex: number;
    activeTruths: number;
  };
  recentTruths: Array<{
    id: number;
    category: string;
    content: string;
    trustScore: number;
    status: string;
    createdAt: string;
  }>;
  predictions: Array<{
    id: number;
    category: string;
    prediction: string;
    confidence: number;
    trend: string;
    timeframe: string;
  }>;
}>;

const categoryConfig: Record<string, { icon: typeof Zap; color: string; label: string; bg: string }> = {
  power: { icon: Zap, color: "text-amber-500", label: "Power", bg: "bg-amber-500/10" },
  fuel: { icon: Fuel, color: "text-orange-500", label: "Fuel", bg: "bg-orange-500/10" },
  traffic: { icon: Car, color: "text-blue-500", label: "Traffic", bg: "bg-blue-500/10" },
  prices: { icon: Tag, color: "text-purple-500", label: "Prices", bg: "bg-purple-500/10" },
  safety: { icon: Shield, color: "text-green-500", label: "Safety", bg: "bg-green-500/10" },
};

function statusColor(status: string): string {
  if (status === "on" || status === "available" || status === "low") return "text-green-500";
  if (status === "unstable" || status === "scarce" || status === "moderate") return "text-amber-500";
  if (status === "off" || status === "unavailable" || status === "heavy" || status === "gridlock") return "text-red-500";
  return "text-muted-foreground";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Portfolio</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No neighborhood data available yet.</p>
            <Link href="/submit" className="mt-4 text-primary hover:underline">
              Submit your first truth report →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PredictiveInterface
      categories={[
        { key: "power", label: "Power" },
        { key: "fuel", label: "Fuel" },
        { key: "traffic", label: "Traffic" },
        { key: "prices", label: "Prices" },
        { key: "safety", label: "Safety" },
      ]}
    >
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" data-testid="text-dashboard-title">Portfolio</h1>
        <Badge variant="outline" className="text-xs">
          {data.length} neighborhoods
        </Badge>
      </div>

      {/* Summary cards */}
      <LocationPreferences />
      {/* Extra dashboard widgets: POS, Weather, Scam Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted/50 p-2">
              <Store className="h-4 w-4 text-electric-blue" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">POS Network Status</p>
              <p className="text-sm font-medium">{data.length > 0 ? `${Math.min(data.length * 10, 100)}% online` : "No data"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted/50 p-2">
              <CloudRain className="h-4 w-4 text-purple-glow" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Weather + Micro-Climate</p>
              <p className="text-sm font-medium">Clear · 28°C · 65% humidity</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-muted/50 p-2">
              <AlertTriangle className="h-4 w-4 text-warm-orange" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Scam Alerts</p>
              <p className="text-sm font-medium">
                {data.filter(n => Array.isArray(n.recentTruths) && n.recentTruths.some(t => t.category === "safety" && (t.content || "").toLowerCase().includes("scam"))).length} active
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Truths</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reduce((sum, n) => sum + (Array.isArray(n.recentTruths) ? n.recentTruths.length : 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neighborhoods</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.filter((n) => n.snapshot?.powerStatus === "off" || n.snapshot?.fuelStatus === "unavailable").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reduce((sum, n) => sum + (Array.isArray(n.predictions) ? n.predictions.length : 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI-Powered Personalized Dashboard */}
      <HyperPersonalizedDashboard />

      {/* Predictive Notifications */}
      <PredictiveNotifications />

      {/* Analytics */}
      <DashboardAnalytics />

      {/* Neighborhood cards */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-neon-green animate-pulse-soft" />
          <span className="text-xs text-muted-foreground">Mesh sync: Active · {data.length} neighborhoods tracked</span>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.neighborhood.id} data-testid={`card-neighborhood-${item.neighborhood.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{item.neighborhood.name}</CardTitle>
                <Badge variant="outline" className="text-xs">{item.neighborhood.region}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {item.snapshot ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3" />
                    <span className={statusColor(item.snapshot.powerStatus)}>
                      {item.snapshot.powerStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="h-3 w-3" />
                    <span className={statusColor(item.snapshot.fuelStatus)}>
                      {item.snapshot.fuelStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Car className="h-3 w-3" />
                    <span className={statusColor(item.snapshot.trafficLevel)}>
                      {item.snapshot.trafficLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    <span className="text-muted-foreground">
                      Safety: {item.snapshot.safetyIndex}/100
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No snapshot data</p>
              )}

              {item.recentTruths.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Recent Reports</p>
                  {item.recentTruths.slice(0, 3).map((truth) => {
                    const cat = categoryConfig[truth.category] || categoryConfig.safety;
                    const Icon = cat.icon;
                    return (
                      <div key={truth.id} className="flex items-start gap-2 text-xs">
                        <div className={`rounded p-0.5 ${cat.bg}`}>
                          <Icon className={`h-3 w-3 ${cat.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{truth.content}</p>
                          <p className="text-muted-foreground">{timeAgo(truth.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent reports</p>
              )}

              <Link
                href={`/dashboard/${item.neighborhood.id}`}
                className="text-xs text-primary hover:underline block"
              >
                View details →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Predictive Navigation - suggests next actions */}
      <PredictiveNavigation maxSuggestions={4} />
    </div>
    </PredictiveInterface>
  );
}

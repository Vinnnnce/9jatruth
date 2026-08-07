"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Zap, Fuel, Car, Tag, Shield, MapPin, AlertTriangle, AlertCircle, Info, Clock } from "lucide-react";

type Alert = {
  id: string;
  neighborhoodId: number;
  neighborhood: string;
  region: string;
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  detectedAt: string;
};

const categoryIcons: Record<string, typeof Zap> = {
  power: Zap, fuel: Fuel, traffic: Car, prices: Tag, safety: Shield,
};

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Warning" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Alerts() {
  const { data, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts");
      return res.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  const critical = data.filter(a => a.severity === "critical");
  const warning = data.filter(a => a.severity === "warning");
  const byCategory: Record<string, number> = {};
  data.forEach(a => { byCategory[a.category] = (byCategory[a.category] || 0) + 1; });

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Alerts Center</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time alerts computed from neighborhood snapshots and AI predictions
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums text-red-500">{critical.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Warnings</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums text-amber-500">{warning.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{data.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Areas Affected</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">
              {new Set(data.map(a => a.neighborhoodId)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {data.length === 0 && (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active alerts. All neighborhoods are stable.</p>
            </CardContent>
          </Card>
        )}
        {data.map((alert) => {
          const config = severityConfig[alert.severity];
          const SevIcon = config.icon;
          const CatIcon = categoryIcons[alert.category] || Info;
          return (
            <Card key={alert.id} className={`border-border ${config.border} animate-fade-in`}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-md ${config.bg} p-2 shrink-0`}>
                    <SevIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{alert.title}</span>
                      <Badge variant="outline" className={`text-[9px] ${config.color} border-current`}>
                        {config.label}
                      </Badge>
                      <CatIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground capitalize">{alert.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Link href={`/map`}>
                        <span className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {alert.neighborhood}, {alert.region}
                        </span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {timeAgo(alert.detectedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

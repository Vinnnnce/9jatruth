"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Server, Cpu, Radio, AlertTriangle, Info, CheckCircle2, XCircle,
  Zap, Database, Globe, Wifi, Clock
} from "lucide-react";

type Health = {
  status: string;
  services: Array<{ name: string; status: string; latency: string; uptime: string }>;
  mesh: { nodes: number; activeConnections: number; bundlesSynced: number; lastSync: string };
  anomalies: Array<{ type: string; severity: string; description: string; detectedAt: string }>;
  stats?: { totalTruths: number; totalNeighborhoods: number; activeDevices: number };
};

function serviceStatusConfig(status: string) {
  switch (status) {
    case "healthy": return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Healthy" };
    case "degraded": return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", label: "Degraded" };
    case "down": return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Down" };
    default: return { icon: Info, color: "text-muted-foreground", bg: "bg-muted", label: status };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const serviceIcons: Record<string, typeof Server> = {
  "Truth Engine": Cpu,
  "Geo Service": Globe,
  "Rewards Service": Server,
  "Notification Service": Zap,
  "AI/ML Pipeline": Activity,
  "API Gateway": Server,
};

export default function Operations() {
  const { data: health, isLoading } = useQuery<Health>({
    queryKey: ["/api/health"],
  });

  if (isLoading || !health) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-700">Operations & Observability</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            System health, mesh network status, and anomaly detection
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500 status-glow-green animate-pulse-soft" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">All Systems Operational</span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Truths", value: health.stats?.totalTruths ?? "—", icon: Database },
          { label: "Neighborhoods", value: health.stats?.totalNeighborhoods ?? "—", icon: Globe },
          { label: "Mesh Nodes", value: health.mesh.nodes.toLocaleString(), icon: Radio },
          { label: "Bundles Synced", value: health.mesh.bundlesSynced.toLocaleString(), icon: Wifi },
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

      {/* Service Health */}
      <div>
        <h2 className="text-sm font-display font-700 mb-3">Service Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {health.services.map((svc) => {
            const config = serviceStatusConfig(svc.status);
            const Icon = serviceIcons[svc.name] || Server;
            const StatusIcon = config.icon;
            return (
              <Card key={svc.name} className="border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{svc.name}</span>
                      <div className={`flex items-center gap-0.5 ${config.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        <span className="text-[10px]">{config.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{svc.latency}</span>
                      <span className="text-[10px] text-muted-foreground">{svc.uptime} uptime</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Mesh Network */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Mesh Network Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Active Nodes</p>
              <p className="text-xl font-display font-700 tabular-nums">{health.mesh.activeConnections.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">of {health.mesh.nodes.toLocaleString()} registered</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Bundles Synced</p>
              <p className="text-xl font-display font-700 tabular-nums">{health.mesh.bundlesSynced.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">cumulative</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Last Sync</p>
              <p className="text-xl font-display font-700 tabular-nums">{health.mesh.lastSync}</p>
              <p className="text-[10px] text-muted-foreground">gateway upload</p>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-muted/50 p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Mesh nodes use Bluetooth LE and Wi-Fi Direct for peer discovery and micro-truth bundle exchange. Gateway nodes upload aggregated bundles to the cloud via the API gateway. Conflict resolution uses timestamps and trust scores.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "BLE Discovery", status: "active", color: "text-green-500" },
              { label: "Wi-Fi Direct", status: "active", color: "text-green-500" },
              { label: "Gossip Protocol", status: "active", color: "text-green-500" },
              { label: "Gateway Upload", status: "active", color: "text-green-500" },
            ].map((proto) => (
              <div key={proto.label} className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
                <div className={`h-2 w-2 rounded-full bg-current ${proto.color} animate-pulse-soft`} />
                <span className="text-[10px] text-muted-foreground">{proto.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Anomalies */}
      <div>
        <h2 className="text-sm font-display font-700 mb-3">Anomaly Detection</h2>
        <div className="space-y-2">
          {health.anomalies.length > 0 ? (
            health.anomalies.map((anomaly, i) => {
              const config = anomaly.severity === "warning"
                ? { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" }
                : { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" };
              const Icon = config.icon;
              return (
                <Card key={i} className={`border-border ${config.border}`}>
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md ${config.bg} shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{anomaly.type.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className={`text-[8px] capitalize ${config.color}`}>{anomaly.severity}</Badge>
                        <span className="text-[9px] text-muted-foreground/60 ml-auto flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(anomaly.detectedAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{anomaly.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No anomalies detected
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Observability Stack */}
      <Card className="border-border bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-display">Observability Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { name: "Prometheus + Grafana", desc: "Metrics & dashboards", icon: Activity },
              { name: "ELK Stack", desc: "Centralized logging", icon: Database },
              { name: "OpenTelemetry", desc: "Distributed tracing", icon: Globe },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <div key={tool.name} className="rounded-md bg-background p-3">
                  <Icon className="h-4 w-4 text-primary mb-1.5" />
                  <p className="text-xs font-medium">{tool.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tool.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldAlert, Users, Flag } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const sevColor: Record<string, string> = {
  high: "text-red-500 bg-red-500/10 border-red-500/20",
  medium: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  low: "text-blue-500 bg-blue-500/10 border-blue-500/20",
};

export function AdminAbuseMonitoring() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/politics/abuse-signals"],
    queryFn: () => apiRequest("GET", "/api/admin/politics/abuse-signals").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/admin/politics/abuse-signals/${id}`, { resolved: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/politics/abuse-signals"] }),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const summary = data?.summary ?? { unresolved: 0, highSeverity: 0, total: 0 };
  const signals = data?.signals ?? [];
  const brigading = data?.detected?.brigading ?? [];
  const coordinated = data?.detected?.coordinated ?? [];
  const massReported = data?.detected?.massReported ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Unresolved</div><div className="text-2xl font-bold font-mono">{summary.unresolved}</div></CardContent></Card>
        <Card className="border-red-500/20"><CardContent className="p-3"><div className="text-xs text-red-500">High severity</div><div className="text-2xl font-bold font-mono text-red-500">{summary.highSeverity}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total signals</div><div className="text-2xl font-bold font-mono">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Brigading targets</div><div className="text-2xl font-bold font-mono">{brigading.length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brigading */}
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Brigading / Mass Downvotes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {brigading.length === 0 && <p className="text-xs text-muted-foreground">No active brigading detected.</p>}
            {brigading.map((b: any) => (
              <div key={b.truth_id} className="rounded-md border border-border p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">Truth #{b.truth_id}</Badge>
                  <span className="text-amber-500 font-mono">{b.recent_disputes} disputes/1h</span>
                  <span className="text-muted-foreground">of {b.total_disputes} total</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{b.content}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Coordinated attacks */}
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Users className="h-4 w-4 text-purple-500" /> Coordinated Attacks</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {coordinated.length === 0 && <p className="text-xs text-muted-foreground">No coordinated vote patterns detected.</p>}
            {coordinated.map((c: any, i: number) => (
              <div key={i} className="rounded-md border border-border p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono truncate">{c.user_hash.slice(0, 16)}…</span>
                  <Badge variant="outline" className="text-[9px] text-red-500">{c.dispute_count} disputes</Badge>
                  <span className="text-muted-foreground">{c.distinct_targets} targets</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Mass reported */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Flag className="h-4 w-4 text-orange-500" /> Mass-Reported Posts</CardTitle></CardHeader>
        <CardContent>
          {massReported.length === 0 && <p className="text-xs text-muted-foreground">No mass-reported posts in 24h.</p>}
          <div className="flex flex-wrap gap-2">
            {massReported.map((m: any) => (
              <Badge key={m.truth_id} variant="outline" className="text-[10px]">Truth #{m.truth_id}: {m.report_count} reports</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signal feed */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-500" /> Abuse Signal Feed</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {signals.length === 0 && <p className="text-xs text-muted-foreground">No abuse signals recorded.</p>}
          {signals.slice(0, 20).map((s: any) => (
            <div key={s.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
              <Badge variant="outline" className={`text-[9px] shrink-0 ${sevColor[s.severity] || ""}`}>{s.severity}</Badge>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[9px]">{s.signal_type}</Badge>
                  <span className="text-muted-foreground">{s.detected_by}</span>
                  {!s.resolved && (
                    <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2 ml-auto" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate(s.id)}>
                      Resolve
                    </Button>
                  )}
                  {s.resolved && <Badge variant="outline" className="text-[9px] text-green-500">resolved</Badge>}
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2">{JSON.stringify(s.details)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

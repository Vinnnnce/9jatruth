"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Layers, Brain } from "lucide-react";

type SenseEdgePanelProps = {
  lat: number;
  lng: number;
  neighborhoodId: number;
  enabled: boolean;
};

export function SenseEdgePanel({ lat, lng, neighborhoodId, enabled }: SenseEdgePanelProps) {
  const { data: senseEdgeData, isLoading: senseEdgeLoading } = useQuery({
    queryKey: ["/api/geo/clusters", neighborhoodId],
    queryFn: async () => {
      const [clustersRes, predictionsRes] = await Promise.all([
        apiRequest("GET", `/api/geo/clusters?lat=${lat}&lng=${lng}&radius=5000`),
        apiRequest("GET", `/api/truths/nearby?lat=${lat}&lng=${lng}&radius=5000&limit=20`),
      ]);
      const clusters = await clustersRes.json();
      const truths = await predictionsRes.json();
      return { clusters, truths };
    },
    enabled: enabled,
  });

  const edgeClusters: any[] = (senseEdgeData as any)?.clusters?.clusters ?? [];
  const edgeTruths: any[] = (senseEdgeData as any)?.truths?.truths ?? [];

  return (
    <Card className="border-border border-cyan-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Brain className="h-4 w-4 text-cyan-500" />
          senseEDGE Geo Intelligence
          <Badge variant="outline" className="text-[8px] ml-1 border-cyan-500/30 text-cyan-500">
            AI-Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {senseEdgeLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          </div>
        ) : senseEdgeData ? (
          <>
            {edgeClusters.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-cyan-500 flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Activity Clusters ({edgeClusters.length})
                </p>
                {edgeClusters.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-muted/30 p-2">
                    <span className="text-[10px] font-medium">{c.category || c.type || "Cluster"}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {c.count || c.truthCount || 0} reports
                    </span>
                  </div>
                ))}
              </div>
            )}
            {edgeTruths.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-cyan-500 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Nearby Intelligence ({edgeTruths.length} signals)
                </p>
                {edgeTruths.slice(0, 5).map((t: any, i: number) => (
                  <div key={i} className="rounded-md bg-muted/30 p-2 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[8px] capitalize">{t.category}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Trust: {t.trustScore ?? 50}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground line-clamp-1">{t.content}</p>
                  </div>
                ))}
              </div>
            )}
            {edgeClusters.length === 0 && edgeTruths.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No geo intelligence data available for this area yet.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            senseEDGE intelligence layer unavailable.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

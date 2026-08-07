"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Zap, Fuel, Car, Tag, Shield } from "lucide-react";

type DashboardData = {
  neighborhood: { id: number; name: string; region: string; geoHash: string; lat: number; lng: number };
  snapshot: {
    powerStatus: string; fuelStatus: string; trafficLevel: string;
    priceIndex: number; safetyIndex: number; activeTruths: number;
  } | undefined;
  recentTruths: Array<{ id: number; category: string; content: string; trustScore: number; createdAt: string }>;
  predictions: Array<{ id: number; category: string; prediction: string; confidence: number; trend: string }>;
};

const statusConfig: Record<string, { color: string; label: string }> = {
  on: { color: "text-green-500", label: "On" },
  off: { color: "text-red-500", label: "Off" },
  unstable: { color: "text-amber-500", label: "Unstable" },
  available: { color: "text-green-500", label: "Available" },
  scarce: { color: "text-amber-500", label: "Scarce" },
  unavailable: { color: "text-red-500", label: "Unavailable" },
  low: { color: "text-green-500", label: "Low" },
  moderate: { color: "text-blue-500", label: "Moderate" },
  heavy: { color: "text-amber-500", label: "Heavy" },
  gridlock: { color: "text-red-500", label: "Gridlock" },
};

const categoryIcons: Record<string, typeof Zap> = {
  power: Zap, fuel: Fuel, traffic: Car, prices: Tag, safety: Shield,
};

export default function GeoMap() {
  const { data, isLoading } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Nigeria lat/lng bounds
  const minLat = 4.2, maxLat = 13.9;
  const minLng = 2.6, maxLng = 14.7;

  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  const getStatusColor = (d: DashboardData) => {
    const snap = d.snapshot;
    if (!snap) return "#64748b";
    if (snap.powerStatus === "off") return "#ef4444";
    if (snap.powerStatus === "unstable") return "#f59e0b";
    if (snap.trafficLevel === "gridlock") return "#ef4444";
    if (snap.safetyIndex < 65) return "#ef4444";
    if (snap.fuelStatus === "scarce") return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Geo Map</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Neighborhood locations across Nigeria with live status indicators
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-4">
            <div className="relative w-full" style={{ paddingBottom: "100%" }}>
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                {/* Nigeria outline (simplified) */}
                <path
                  d="M 15 20 L 30 15 L 50 12 L 70 15 L 85 25 L 90 40 L 85 55 L 80 70 L 70 80 L 55 85 L 40 82 L 25 75 L 15 60 L 10 45 L 12 30 Z"
                  fill="hsl(var(--muted))"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
                {/* Region labels */}
                <text x="30" y="55" fontSize="3" fill="hsl(var(--muted-foreground))" opacity="0.4" textAnchor="middle">Lagos</text>
                <text x="48" y="35" fontSize="3" fill="hsl(var(--muted-foreground))" opacity="0.4" textAnchor="middle">Abuja</text>
                <text x="55" y="60" fontSize="3" fill="hsl(var(--muted-foreground))" opacity="0.4" textAnchor="middle">Enugu</text>
                <text x="60" y="70" fontSize="3" fill="hsl(var(--muted-foreground))" opacity="0.4" textAnchor="middle">PH</text>
                <text x="35" y="65" fontSize="3" fill="hsl(var(--muted-foreground))" opacity="0.4" textAnchor="middle">Ibadan</text>

                {/* Neighborhood pins */}
                {data.map((d) => {
                  const pos = project(d.neighborhood.lat, d.neighborhood.lng);
                  const color = getStatusColor(d);
                  return (
                    <g key={d.neighborhood.id}>
                      <circle cx={pos.x} cy={pos.y} r="2.5" fill={color} opacity="0.3" className="animate-pulse-soft" />
                      <circle cx={pos.x} cy={pos.y} r="1.5" fill={color} stroke="white" strokeWidth="0.3" />
                      <text x={pos.x} y={pos.y - 3} fontSize="2" fill="hsl(var(--foreground))" textAnchor="middle" opacity="0.8">
                        {d.neighborhood.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-muted-foreground">Stable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-muted-foreground">Warning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-muted-foreground">Critical</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Neighborhood list */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.map((d) => {
                const color = getStatusColor(d);
                const snap = d.snapshot;
                return (
                  <div key={d.neighborhood.id} className="flex items-center gap-2.5 rounded-md bg-muted/30 p-2.5 animate-fade-in">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{d.neighborhood.name}</p>
                      <p className="text-[10px] text-muted-foreground">{d.neighborhood.region} · {d.recentTruths.length} truths</p>
                    </div>
                    {snap && (
                      <div className="flex items-center gap-1 shrink-0">
                        {(["power", "fuel", "traffic"] as const).map(cat => {
                          const val = cat === "power" ? snap.powerStatus : cat === "fuel" ? snap.fuelStatus : snap.trafficLevel;
                          const cfg = statusConfig[val] || { color: "text-muted-foreground", label: val };
                          const Icon = categoryIcons[cat] || Zap;
                          return <Icon key={cat} className={`h-3 w-3 ${cfg.color}`} />;
                        })}
                        <Shield className={`h-3 w-3 ${snap.safetyIndex < 65 ? "text-red-500" : snap.safetyIndex < 75 ? "text-amber-500" : "text-green-500"}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, Fuel, Car, Tag, Shield, TrendingUp, AlertCircle,
  MapPin, Newspaper,
} from "lucide-react";
import Link from "next/link";

type DashboardData = Array<{
  neighborhood: { id: number; name: string; region: string };
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
  }>;
}>;

export default function HomePage() {
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
        <h1 className="text-xl font-bold mb-4">Dashboard</h1>
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <Badge variant="outline" className="text-xs">
          {data.length} neighborhoods
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Truths</CardTitle>
            <Newspaper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.reduce((sum, n) => sum + n.recentTruths.length, 0)}
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
              {data.reduce((sum, n) => sum + n.predictions.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Neighborhood cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.neighborhood.id}>
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
                    <span className="text-muted-foreground">{item.snapshot.powerStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="h-3 w-3" />
                    <span className="text-muted-foreground">{item.snapshot.fuelStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Car className="h-3 w-3" />
                    <span className="text-muted-foreground">{item.snapshot.trafficLevel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    <span className="text-muted-foreground">Safety: {item.snapshot.safetyIndex}/100</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No snapshot data</p>
              )}
              {item.recentTruths.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Recent Reports</p>
                  {item.recentTruths.slice(0, 3).map((truth) => (
                    <div key={truth.id} className="text-xs truncate">
                      <Badge variant="secondary" className="mr-1 text-[10px]">{truth.category}</Badge>
                      {truth.content}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No recent reports</p>
              )}
              <Link href={`/dashboard/${item.neighborhood.id}`} className="text-xs text-primary hover:underline block">
                View details →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

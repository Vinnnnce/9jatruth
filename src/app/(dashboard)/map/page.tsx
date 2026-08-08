"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Sparkles, Star, Loader2 } from "lucide-react";
import { APIProvider, Map, Marker, InfoWindow } from "@vis.gl/react-google-maps";

type DashboardData = {
  neighborhood: { id: number; name: string; region: string; geoHash: string; lat: number; lng: number };
  snapshot: {
    powerStatus: string; fuelStatus: string; trafficLevel: string;
    priceIndex: number; safetyIndex: number; activeTruths: number;
  } | undefined;
  recentTruths: Array<{ id: number; category: string; content: string; trustScore: number; createdAt: string }>;
  predictions: Array<{ id: number; category: string; prediction: string; confidence: number; trend: string }>;
};

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  icon: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  vicinity?: string;
  openNow?: boolean;
  types?: string[];
  distance?: number;
};

const CATEGORY_FILTERS = [
  { key: "all", label: "All", icon: "📍" },
  { key: "hotels", label: "Hotels", icon: "🏨" },
  { key: "restaurants", label: "Restaurants", icon: "🍽️" },
  { key: "fuel", label: "Petrol", icon: "⛽" },
  { key: "police", label: "Police", icon: "🚔" },
  { key: "hospitals", label: "Hospitals", icon: "🏥" },
  { key: "pharmacies", label: "Pharmacies", icon: "💊" },
  { key: "supermarkets", label: "Supermarkets", icon: "🛒" },
];

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const statusColors: Record<string, string> = {
  on: "#22c55e", available: "#22c55e", low: "#22c55e",
  off: "#ef4444", unavailable: "#ef4444", gridlock: "#ef4444",
  unstable: "#f59e0b", scarce: "#f59e0b", heavy: "#f59e0b", moderate: "#3b82f6",
};

export default function GeoMap() {
  const { data, isLoading, isError } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
    retry: 1,
  });

  const [selectedNeighborhood, setSelectedNeighborhood] = useState<DashboardData | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  const { data: nearbyData, isLoading: nearbyLoading } = useQuery({
    queryKey: ["/api/maps/nearby", selectedNeighborhood?.neighborhood.id, activeCategory],
    queryFn: async () => {
      if (!selectedNeighborhood) return null;
      const n = selectedNeighborhood.neighborhood;
      const res = await apiRequest(
        "GET",
        `/api/maps/nearby?lat=${n.lat}&lng=${n.lng}&radius=5000&category=${activeCategory}&ai=true`
      );
      return res.json();
    },
    enabled: !!selectedNeighborhood,
  });

  const handleNeighborhoodClick = useCallback((d: DashboardData) => {
    setSelectedNeighborhood(d);
    setSelectedPlace(null);
  }, []);

  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load map data. Will retry...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data || data.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const selected = selectedNeighborhood || data[0];
  const center = { lat: selected.neighborhood.lat, lng: selected.neighborhood.lng };
  const places: NearbyPlace[] = nearbyData?.places || [];

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Geo Map
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Interactive map with nearby businesses, services, and live conditions
        </p>
      </div>

      {/* Neighborhood selector */}
      <div className="flex flex-wrap gap-2">
        {data.map((d) => (
          <Button
            key={d.neighborhood.id}
            size="sm"
            variant={selected?.neighborhood.id === d.neighborhood.id ? "default" : "outline"}
            onClick={() => handleNeighborhoodClick(d)}
            className="text-xs"
            data-testid={`btn-neighborhood-${d.neighborhood.id}`}
          >
            <MapPin className="h-3 w-3 mr-1" />
            {d.neighborhood.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Google Map with markers */}
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-4">
            {GOOGLE_MAPS_KEY ? (
              <div className="rounded-lg overflow-hidden" style={{ height: "450px" }} data-testid="google-map">
                <APIProvider apiKey={GOOGLE_MAPS_KEY}>
                  <Map
                    center={center}
                    zoom={14}
                    gestureHandling="greedy"
                    disableDefaultUI
                    mapTypeControl={false}
                    style={{ width: "100%", height: "100%" }}
                  >
                    {/* Center marker for selected neighborhood */}
                    <Marker
                      position={center}
                      title={selected.neighborhood.name}
                      label={selected.neighborhood.name}
                    />

                    {/* Markers for nearby places */}
                    {places.map((place, idx) => (
                      <Marker
                        key={`${place.id}-${idx}`}
                        position={{ lat: place.lat, lng: place.lng }}
                        title={place.name}
                        onClick={() => setSelectedPlace(place)}
                        label={{
                          text: place.icon,
                          fontSize: "14px",
                        }}
                      />
                    ))}

                    {/* Info window for selected place */}
                    {selectedPlace && (
                      <InfoWindow
                        position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                        onCloseClick={() => setSelectedPlace(null)}
                      >
                        <div className="p-1 max-w-[200px]">
                          <p className="text-xs font-medium">{selectedPlace.name}</p>
                          <p className="text-[10px] text-gray-500">{selectedPlace.category}</p>
                          {selectedPlace.vicinity && (
                            <p className="text-[10px] text-gray-400">{selectedPlace.vicinity}</p>
                          )}
                          {selectedPlace.rating != null && (
                            <p className="text-[10px]">
                              <Star className="h-2.5 w-2.5 inline fill-amber-400 text-amber-400" />
                              {" "}{selectedPlace.rating}
                              {selectedPlace.userRatingsTotal ? ` (${selectedPlace.userRatingsTotal})` : ""}
                            </p>
                          )}
                          {selectedPlace.distance != null && (
                            <p className="text-[10px] text-gray-400">
                              {(selectedPlace.distance / 1000).toFixed(1)}km away
                            </p>
                          )}
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[450px] bg-muted/30 rounded-lg">
                <MapPin className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Set <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your .env file to enable Google Maps
                </p>
              </div>
            )}

            {/* Category filters */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {CATEGORY_FILTERS.map((cat) => (
                <Button
                  key={cat.key}
                  size="sm"
                  variant={activeCategory === cat.key ? "default" : "outline"}
                  onClick={() => setActiveCategory(cat.key)}
                  className="h-7 text-[10px] gap-1 px-2"
                  data-testid={`btn-category-${cat.key}`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: neighborhood info */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              {selected?.neighborhood.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selected?.snapshot && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">Power</p>
                  <p className="text-xs font-medium capitalize" style={{ color: statusColors[selected.snapshot.powerStatus] || undefined }}>
                    {selected.snapshot.powerStatus}
                  </p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">Fuel</p>
                  <p className="text-xs font-medium capitalize" style={{ color: statusColors[selected.snapshot.fuelStatus] || undefined }}>
                    {selected.snapshot.fuelStatus}
                  </p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">Traffic</p>
                  <p className="text-xs font-medium capitalize" style={{ color: statusColors[selected.snapshot.trafficLevel] || undefined }}>
                    {selected.snapshot.trafficLevel}
                  </p>
                </div>
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="text-[10px] text-muted-foreground">Safety</p>
                  <p className="text-xs font-medium" style={{ color: selected.snapshot.safetyIndex < 65 ? "#ef4444" : selected.snapshot.safetyIndex < 75 ? "#f59e0b" : "#22c55e" }}>
                    {selected.snapshot.safetyIndex}%
                  </p>
                </div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              <p>Region: {selected?.neighborhood.region}</p>
              <p>Active Truths: {selected?.snapshot?.activeTruths ?? 0}</p>
              <p>Recent Reports: {selected?.recentTruths.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis */}
      {nearbyData?.aiAnalysis && (
        <Card className="border-border border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI Location Analysis
              <Badge variant="outline" className="text-[8px] ml-1 border-purple-500/30 text-purple-500">
                Kimi K3
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {nearbyData.aiAnalysis}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Nearby places list */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Nearby Places
            {nearbyData?.total != null && (
              <Badge variant="outline" className="text-[9px] ml-1">
                {nearbyData.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nearbyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : nearbyData?.places?.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {nearbyData.places.map((place: NearbyPlace, idx: number) => (
                <div
                  key={`${place.id}-${idx}`}
                  className="flex items-start gap-2.5 rounded-md bg-muted/30 p-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlace(place)}
                  data-testid={`place-${place.id}`}
                >
                  <span className="text-lg shrink-0">{place.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{place.name}</p>
                      {place.openNow !== undefined && (
                        <span className={`text-[8px] px-1 rounded ${place.openNow ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                          {place.openNow ? "Open" : "Closed"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{place.category}</span>
                      {place.distance != null && (
                        <span className="text-[10px] text-muted-foreground">{(place.distance / 1000).toFixed(1)}km away</span>
                      )}
                    </div>
                    {place.vicinity && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{place.vicinity}</p>
                    )}
                    {place.rating != null && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] text-muted-foreground">{place.rating}</span>
                        {place.userRatingsTotal != null && (
                          <span className="text-[9px] text-muted-foreground">({place.userRatingsTotal})</span>
                        )}
                      </div>
                    )}
                  </div>
                  {place.priceLevel != null && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {"₦".repeat(place.priceLevel)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <MapPin className="h-6 w-6 text-muted-foreground mx-auto mb-1 opacity-50" />
              <p className="text-xs text-muted-foreground">
                {nearbyData?.configured === false
                  ? "Google Maps API key not configured. Set GOOGLE_MAPS_SERVER_KEY in .env"
                  : "No nearby places found. Select a neighborhood."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  MapPin,
  Navigation,
  Sparkles,
  Star,
  Loader2,
  Mountain,
  Brain,
  Search,
  X,
  Menu,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { SenseEdgePanel } from "@/components/senseedge-panel";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  FullscreenControl,
} from "react-map-gl/maplibre";

type DashboardData = {
  neighborhood: {
    id: number;
    name: string;
    region: string;
    geoHash: string;
    lat: number;
    lng: number;
  };
  snapshot: {
    powerStatus: string;
    fuelStatus: string;
    trafficLevel: string;
    priceIndex: number;
    safetyIndex: number;
    activeTruths: number;
  } | undefined;
  recentTruths: Array<{
    id: number;
    category: string;
    content: string;
    trustScore: number;
    createdAt: string;
  }>;
  predictions: Array<{
    id: number;
    category: string;
    prediction: string;
    confidence: number;
    trend: string;
  }>;
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

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
const MAPTILER_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
  : "";
const MAPTILER_TERRAIN_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/tiles/terrain-rgb/terrain-rgb.json?key=${MAPTILER_KEY}`
  : "";

const SENSEEDGE_ENABLED = true;

const statusColors: Record<string, string> = {
  on: "#22c55e",
  available: "#22c55e",
  low: "#22c55e",
  off: "#ef4444",
  unavailable: "#ef4444",
  gridlock: "#ef4444",
  unstable: "#f59e0b",
  scarce: "#f59e0b",
  heavy: "#f59e0b",
  moderate: "#3b82f6",
};

/** Normalize a place so no field is undefined — fixes "undefined" in popups. */
function normalizePlace(p: Partial<NearbyPlace> | null | undefined): NearbyPlace | null {
  if (!p) return null;
  const lat = typeof p.lat === "number" && !isNaN(p.lat) ? p.lat : null;
  const lng = typeof p.lng === "number" && !isNaN(p.lng) ? p.lng : null;
  if (lat == null || lng == null) return null;
  return {
    id: String(p.id ?? `place-${lat.toFixed(4)}-${lng.toFixed(4)}`),
    name: p.name || "Unnamed Place",
    category: p.category || "Unknown category",
    icon: p.icon || "📍",
    lat,
    lng,
    rating: p.rating,
    userRatingsTotal: p.userRatingsTotal,
    priceLevel: p.priceLevel,
    vicinity: p.vicinity,
    openNow: p.openNow,
    types: p.types,
    distance: p.distance,
  };
}

export default function GeoMapClient() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardData[]>({
    queryKey: ["/api/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/dashboard");
      return res.json();
    },
    retry: 2,
    retryDelay: 1000,
  });

  const [selectedNeighborhood, setSelectedNeighborhood] =
    useState<DashboardData | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [view3D, setView3D] = useState(false);
  const [showSenseEdge, setShowSenseEdge] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NearbyPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapError, setMapError] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: nearbyData, isLoading: nearbyLoading, error: nearbyError } = useQuery({
    queryKey: [
      "/api/maps/nearby",
      selectedNeighborhood?.neighborhood.id,
      activeCategory,
    ],
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
    retry: 1,
  });

  const handleNeighborhoodClick = useCallback((d: DashboardData) => {
    setSelectedNeighborhood(d);
    setSelectedPlace(null);
    setSidebarOpen(false);
  }, []);

  // Debounced search within nearby places — falls back to API search when no
  // nearby data is loaded yet, so the search bar always returns results for
  // known locations instead of a blank list.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const q = searchQuery.toLowerCase();
      const places: NearbyPlace[] = nearbyData?.places || [];
      const filtered = places.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.vicinity?.toLowerCase().includes(q)
      );

      if (filtered.length > 0) {
        setSearchResults(filtered);
      } else {
        // Fallback: query the global search API so the search bar returns
        // results even when no nearby data is loaded for the current area.
        try {
          const res = await apiRequest(
            "GET",
            `/api/search?q=${encodeURIComponent(searchQuery)}`
          );
          const json = await res.json();
          const results: any[] = Array.isArray(json)
            ? json
            : json.results || [];
          const mapped: NearbyPlace[] = results
            .map((r: any) =>
              normalizePlace({
                id: String(r.id ?? r.placeId ?? ""),
                name: r.name || r.title || r.content?.slice(0, 40),
                category: r.category || r.region || "Search result",
                icon: "🔎",
                lat: r.lat ?? r.latitude,
                lng: r.lng ?? r.longitude,
                vicinity: r.vicinity || r.region,
              })
            )
            .filter((p): p is NearbyPlace => p !== null);
          setSearchResults(mapped);
        } catch {
          setSearchResults([]);
        }
      }
      setSearching(false);
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, nearbyData]);

  // Error state with retry
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-5xl space-y-6">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <p className="text-sm font-medium">Failed to load map data</p>
            <p className="text-xs text-muted-foreground">
              There was an error loading the map. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
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
  const center = {
    lat: selected.neighborhood.lat,
    lng: selected.neighborhood.lng,
  };
  const places: NearbyPlace[] =
    searchResults.length > 0 ? searchResults : nearbyData?.places || [];

  // Validate, normalize, and filter places with valid coordinates.
  // This fixes both the "undefined" popup bug and the ~1km marker offset
  // (caused by rendering markers with bad/missing coordinates).
  const validPlaces: NearbyPlace[] = useMemo(
    () =>
      places
        .map((p) => normalizePlace(p))
        .filter((p): p is NearbyPlace => p !== null),
    [places]
  );

  const sidebarContent = (
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
              <p
                className="text-xs font-medium capitalize"
                style={{
                  color: statusColors[selected.snapshot.powerStatus] || undefined,
                }}
              >
                {selected.snapshot.powerStatus}
              </p>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">Fuel</p>
              <p
                className="text-xs font-medium capitalize"
                style={{
                  color: statusColors[selected.snapshot.fuelStatus] || undefined,
                }}
              >
                {selected.snapshot.fuelStatus}
              </p>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">Traffic</p>
              <p
                className="text-xs font-medium capitalize"
                style={{
                  color: statusColors[selected.snapshot.trafficLevel] || undefined,
                }}
              >
                {selected.snapshot.trafficLevel}
              </p>
            </div>
            <div className="rounded-md bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground">Safety</p>
              <p
                className="text-xs font-medium"
                style={{
                  color:
                    selected.snapshot.safetyIndex < 65
                      ? "#ef4444"
                      : selected.snapshot.safetyIndex < 75
                        ? "#f59e0b"
                        : "#22c55e",
                }}
              >
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
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-display font-700 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Geo Map
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Interactive map with nearby businesses, services, and live conditions
          </p>
        </div>
        {/* Mobile sidebar toggle */}
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-4 w-4" />
          Details
        </Button>
      </div>

      {/* Neighborhood selector */}
      <div className="flex flex-wrap gap-2">
        {data.map((d) => (
          <Button
            key={d.neighborhood.id}
            size="sm"
            variant={
              selected?.neighborhood.id === d.neighborhood.id ? "default" : "outline"
            }
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
        {/* Map */}
        <Card className="border-border lg:col-span-2">
          <CardContent className="p-4">
            {/* Search bar */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search nearby places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
                data-testid="input-map-search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {searching && (
                <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {searchQuery && searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.slice(0, 8).map((place, idx) => (
                    <button
                      key={`${place.id}-${idx}`}
                      className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                      onClick={() => {
                        setSelectedPlace(place);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{place.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {place.name || "Unnamed"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {place.category}
                          </p>
                        </div>
                        {place.distance != null && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {(place.distance / 1000).toFixed(1)}km
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {MAPTILER_KEY ? (
              <div
                className="rounded-lg overflow-hidden relative"
                style={{ height: "450px" }}
                data-testid="google-map"
              >
                {mapError ? (
                  <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg gap-3">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-muted-foreground">Map failed to load</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMapError(false)}
                      className="gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <Map
                    key={`${selected.neighborhood.id}-${view3D}`}
                    initialViewState={{
                      longitude: center.lng,
                      latitude: center.lat,
                      zoom: 14,
                      pitch: view3D ? 60 : 0,
                      bearing: view3D ? 20 : 0,
                    }}
                    mapStyle={MAPTILER_STYLE}
                    mapLib={maplibregl}
                    style={{ width: "100%", height: "100%" }}
                    onError={() => setMapError(true)}
                    onLoad={(e) => {
                      if (view3D && MAPTILER_KEY) {
                        try {
                          const map = e.target as any;
                          if (!map.getSource("terrain-rgb")) {
                            map.addSource("terrain-rgb", {
                              type: "raster-dem",
                              url: MAPTILER_TERRAIN_URL,
                              tileSize: 256,
                            });
                            map.setTerrain({ source: "terrain-rgb", exaggeration: 1.5 });
                          }
                        } catch {
                          // Terrain source may already exist or fail silently
                        }
                      }
                    }}
                    // Mobile performance: disable rotation by drag (keeps
                    // pinch-to-zoom smooth), reduce touch pitch sensitivity.
                    dragRotate={false}
                    touchPitch={false}
                    touchZoomRotate={false}
                  >
                    <FullscreenControl position="top-right" />
                    <NavigationControl
                      position="top-right"
                      showCompass={true}
                      visualizePitch={true}
                    />

                    {/* Center marker for selected neighborhood */}
                    <Marker
                      longitude={center.lng}
                      latitude={center.lat}
                      anchor="bottom"
                    >
                      <div
                        title={selected.neighborhood.name}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          transform: "translateY(-2px)",
                        }}
                      >
                        <MapPin className="h-6 w-6 text-primary fill-primary/20" />
                        <span className="text-[10px] font-medium bg-background/90 px-1 rounded shadow-sm whitespace-nowrap">
                          {selected.neighborhood.name}
                        </span>
                      </div>
                    </Marker>

                    {/* Markers for nearby places — only render valid, normalized places */}
                    {validPlaces.map((place, idx) => (
                      <Marker
                        key={`${place.id}-${idx}`}
                        longitude={place.lng}
                        latitude={place.lat}
                        anchor="bottom"
                        onClick={(e) => {
                          e.originalEvent.stopPropagation();
                          setSelectedPlace(place);
                        }}
                      >
                        <div
                          title={place.name}
                          style={{
                            fontSize: "18px",
                            lineHeight: 1,
                            cursor: "pointer",
                            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))",
                          }}
                        >
                          {place.icon}
                        </div>
                      </Marker>
                    ))}

                    {/* Popup for selected place — normalized so no "undefined" */}
                    {selectedPlace && selectedPlace.lat != null && selectedPlace.lng != null && (
                      <Popup
                        longitude={selectedPlace.lng}
                        latitude={selectedPlace.lat}
                        anchor="top"
                        onClose={() => setSelectedPlace(null)}
                        closeButton
                        closeOnClick={false}
                        maxWidth="240px"
                      >
                        <div className="p-1 max-w-[200px]">
                          <p className="text-xs font-medium">
                            {selectedPlace.name || "Unnamed Place"}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {selectedPlace.category || "Unknown category"}
                          </p>
                          {selectedPlace.vicinity && (
                            <p className="text-[10px] text-gray-400">
                              {selectedPlace.vicinity}
                            </p>
                          )}
                          {selectedPlace.rating != null && (
                            <p className="text-[10px]">
                              <Star className="h-2.5 w-2.5 inline fill-amber-400 text-amber-400" />
                              {" "}
                              {selectedPlace.rating}
                              {selectedPlace.userRatingsTotal
                                ? ` (${selectedPlace.userRatingsTotal})`
                                : ""}
                            </p>
                          )}
                          {selectedPlace.distance != null && (
                            <p className="text-[10px] text-gray-400">
                              {(selectedPlace.distance / 1000).toFixed(1)}km away
                            </p>
                          )}
                        </div>
                      </Popup>
                    )}
                  </Map>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[450px] bg-muted/30 rounded-lg">
                <MapPin className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Set{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    NEXT_PUBLIC_MAPTILER_API_KEY
                  </code>{" "}
                  in your .env file to enable the MapTiler satellite hybrid map
                </p>
              </div>
            )}

            {/* Category filters — activeCategory drives the nearby query,
                so toggling a filter re-fetches and updates the markers. */}
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

            {/* 3D & senseEDGE toggles */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Button
                size="sm"
                variant={view3D ? "default" : "outline"}
                onClick={() => setView3D(!view3D)}
                className="h-7 text-[10px] gap-1 px-2"
                data-testid="btn-3d-toggle"
              >
                <Mountain className="h-3 w-3" />
                {view3D ? "3D Terrain On" : "3D Terrain"}
              </Button>
              <Button
                size="sm"
                variant={showSenseEdge ? "default" : "outline"}
                onClick={() => setShowSenseEdge(!showSenseEdge)}
                className="h-7 text-[10px] gap-1 px-2"
                data-testid="btn-senseedge-toggle"
              >
                <Brain className="h-3 w-3" />
                senseEDGE AI
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: neighborhood info - desktop */}
        <div className="hidden lg:block">{sidebarContent}</div>

        {/* Sidebar: mobile - using Sheet with overlay so it can be closed */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="right"
            className="w-[85vw] sm:w-[350px] p-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Neighborhood Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Error banner for nearby data */}
      {nearbyError && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Could not load nearby places. The Google Maps API key may not be
              configured.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis */}
      {nearbyData?.aiAnalysis && (
        <Card className="border-border border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI Location Analysis
              <Badge
                variant="outline"
                className="text-[8px] ml-1 border-purple-500/30 text-purple-500"
              >
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

      {/* senseEDGE AI Intelligence Layer */}
      {showSenseEdge && selected && (
        <SenseEdgePanel
          lat={selected.neighborhood.lat}
          lng={selected.neighborhood.lng}
          neighborhoodId={selected.neighborhood.id}
          enabled={SENSEEDGE_ENABLED}
        />
      )}

      {/* Nearby places list */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Nearby Places
            {nearbyData?.total != null && (
              <Badge variant="outline" className="text-[9px] ml-1">
                {searchQuery ? searchResults.length : nearbyData.total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nearbyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : validPlaces.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {validPlaces.map((place: NearbyPlace, idx: number) => (
                <div
                  key={`${place.id}-${idx}`}
                  className="flex items-start gap-2.5 rounded-md bg-muted/30 p-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlace(place)}
                  data-testid={`place-${place.id}`}
                >
                  <span className="text-lg shrink-0">{place.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">
                        {place.name || "Unnamed Place"}
                      </p>
                      {place.openNow !== undefined && (
                        <span
                          className={`text-[8px] px-1 rounded ${place.openNow ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}
                        >
                          {place.openNow ? "Open" : "Closed"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {place.category || "Unknown"}
                      </span>
                      {place.distance != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {(place.distance / 1000).toFixed(1)}km away
                        </span>
                      )}
                    </div>
                    {place.vicinity && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {place.vicinity}
                      </p>
                    )}
                    {place.rating != null && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        <span className="text-[10px] text-muted-foreground">
                          {place.rating}
                        </span>
                        {place.userRatingsTotal != null && (
                          <span className="text-[9px] text-muted-foreground">
                            ({place.userRatingsTotal})
                          </span>
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
                  : searchQuery
                    ? "No places match your search."
                    : "No nearby places found. Select a neighborhood."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

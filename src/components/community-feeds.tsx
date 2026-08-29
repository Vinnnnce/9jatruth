"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseApiError } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  MapPin, Newspaper, Loader2, ShieldCheck, TrendingUp,
  MessageCircle, Share2, Flag, Trash2, Sparkles,
  Navigation, Search, X,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";
import { motion, AnimatePresence } from "framer-motion";
import { NIGERIA_STATES, getLgasForState } from "@/lib/nigeria-locations";

// ─── Types ───

type CommunityFeed = {
  id: number;
  category: string;
  content: string;
  trustScore: number;
  status: string;
  createdAt: string;
  userHash: string;
  stateName: string | null;
  lgaName: string | null;
  communityName: string | null;
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  communityId: number | null;
  aiTags: string[];
  aiCategory: string | null;
  aiSpamScore: number;
  trendingScore: number;
  orgName: string | null;
  orgVerified: boolean;
  neighborhoodName: string | null;
  displayName: string | null;
  distanceKm: number | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  verificationCount: number;
  isAuthor: boolean;
};

type GeoOption = { id: number; name: string };

type TrendingTopic = {
  category: string;
  tag: string | null;
  postCount: number;
  totalLikes: number;
  totalComments: number;
  trendingScore: number;
  sampleContent: string | null;
};

type Tab = "near_you" | "community" | "ward" | "lga" | "state" | "all_nigeria";

const TABS: { value: Tab; label: string; icon: typeof MapPin }[] = [
  { value: "near_you", label: "Near You", icon: MapPin },
  { value: "community", label: "Community", icon: MapPin },
  { value: "ward", label: "Ward", icon: MapPin },
  { value: "lga", label: "LGA", icon: MapPin },
  { value: "state", label: "State", icon: MapPin },
  { value: "all_nigeria", label: "All Nigeria", icon: MapPin },
];

const CATEGORIES = [
  "power", "fuel", "traffic", "prices", "safety", "security",
  "real-estate", "housing", "patrol-gas-station", "restaurant",
  "hotel", "school", "pharmacy", "hospital", "supermarket",
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ───

export function CommunityFeeds() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("all_nigeria");
  const [sortBy, setSortBy] = useState<"recent" | "nearest" | "trending" | "trust">("recent");

  // Cascading geo filters
  const [selectedState, setSelectedState] = useState<number | null>(null);
  const [selectedLga, setSelectedLga] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<number | null>(null);

  // States list (from API)
  const { data: statesData } = useQuery<{ states: GeoOption[] }>({
    queryKey: ["/api/feeds/community", "states"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feeds/community?geo=states");
      return res.json();
    },
    enabled: isLoaded,
  });

  // LGAs for selected state
  const { data: lgasData } = useQuery<{ lgas: GeoOption[] }>({
    queryKey: ["/api/feeds/community", "lgas", selectedState],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/feeds/community?geo=lgas&stateId=${selectedState}`);
      return res.json();
    },
    enabled: isLoaded && !!selectedState,
  });

  // Wards for selected LGA
  const { data: wardsData } = useQuery<{ wards: GeoOption[] }>({
    queryKey: ["/api/feeds/community", "wards", selectedLga],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/geo/wards?lgaId=${selectedLga}`);
      return res.json();
    },
    enabled: isLoaded && !!selectedLga,
  });

  // Communities for selected ward
  const { data: communitiesData } = useQuery<{ communities: GeoOption[] }>({
    queryKey: ["/api/feeds/community", "communities", selectedWard, selectedLga],
    queryFn: async () => {
      if (selectedWard) {
        const res = await apiRequest("GET", `/api/geo/communities?wardId=${selectedWard}`);
        return res.json();
      } else if (selectedLga) {
        const res = await apiRequest("GET", `/api/geo/communities?lgaId=${selectedLga}`);
        return res.json();
      }
      return { communities: [] };
    },
    enabled: isLoaded && (!!selectedWard || !!selectedLga),
  });

  // User location (auto-detect)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "detecting" | "detected" | "denied">("idle");

  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        setLocationStatus("detected");

        // Reverse geocode to auto-fill dropdowns
        try {
          const res = await apiRequest("GET", `/api/geo/reverse-geocode?lat=${lat}&lng=${lng}`);
          const geo = await res.json();
          if (geo.state?.id) setSelectedState(geo.state.id);
          if (geo.lga?.id) setSelectedLga(geo.lga.id);
          if (geo.ward?.id) setSelectedWard(geo.ward.id);
          if (geo.community?.id) setSelectedCommunity(geo.community.id);

          if (geo.state?.name) {
            toast({ title: `Location detected: ${geo.state.name}${geo.lga?.name ? ", " + geo.lga.name : ""}` });
          }
        } catch (err) {
          console.error("Reverse geocode failed:", err);
          toast({ title: "Location detected, but could not determine area", variant: "destructive" });
        }
      },
      () => {
        setLocationStatus("denied");
        toast({ title: "Location access denied. Using IP-based location.", variant: "destructive" });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [toast]);

  // Build query params for community feeds
  const buildFeedParams = useCallback(() => {
    const params = new URLSearchParams({
      level: activeTab,
      sortBy,
      limit: "50",
    });

    if (activeTab === "near_you" && userLocation) {
      params.set("lat", String(userLocation.lat));
      params.set("lng", String(userLocation.lng));
      params.set("radiusKm", "10");
    }

    if (selectedState) params.set("stateId", String(selectedState));
    if (selectedLga) params.set("lgaId", String(selectedLga));
    if (selectedWard) params.set("wardId", String(selectedWard));
    if (selectedCommunity) params.set("communityId", String(selectedCommunity));

    return params.toString();
  }, [activeTab, sortBy, userLocation, selectedState, selectedLga, selectedWard, selectedCommunity]);

  // Fetch community feeds
  const { data: feedsData, isLoading: feedsLoading } = useQuery<{ feeds: CommunityFeed[]; total: number }>({
    queryKey: ["/api/feeds/community", activeTab, sortBy, selectedState, selectedLga, selectedWard, selectedCommunity, userLocation],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/feeds/community?${buildFeedParams()}`);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Fetch trending topics
  const { data: trendingData } = useQuery<{ trending: TrendingTopic[] }>({
    queryKey: ["/api/feeds/trending", activeTab, selectedState, selectedLga, selectedWard, selectedCommunity],
    queryFn: async () => {
      const params = new URLSearchParams({ level: activeTab === "near_you" ? "all_nigeria" : activeTab });
      if (selectedState) params.set("geoId", String(selectedState));
      if (selectedLga && activeTab === "lga") params.set("geoId", String(selectedLga));
      if (selectedWard && activeTab === "ward") params.set("geoId", String(selectedWard));
      if (selectedCommunity && activeTab === "community") params.set("geoId", String(selectedCommunity));
      const res = await apiRequest("GET", `/api/feeds/trending?${params.toString()}`);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 60000,
  });

  // Delete post
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/truths/${id}`),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds/community"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: parseApiError(err), variant: "destructive" });
    },
  });

  // ─── Post Creation ───
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState("power");
  const [postLocationSource, setPostLocationSource] = useState<"gps" | "manual">("manual");
  const [isPosting, setIsPosting] = useState(false);

  const handleCreatePost = useCallback(async () => {
    if (postContent.trim().length < 10) {
      toast({ title: "Content must be at least 10 characters", variant: "destructive" });
      return;
    }

    setIsPosting(true);
    try {
      const body: Record<string, any> = {
        content: postContent.trim(),
        category: postCategory,
        locationSource: postLocationSource,
        neighborhoodName: selectedCommunity ? undefined : (selectedLga ? undefined : (selectedState ? undefined : "General")),
      };

      // Auto-assign geo hierarchy
      if (selectedState) body.stateId = selectedState;
      if (selectedLga) body.lgaId = selectedLga;
      if (selectedWard) body.wardId = selectedWard;
      if (selectedCommunity) body.communityId = selectedCommunity;

      // Use GPS location if available
      if (postLocationSource === "gps" && userLocation) {
        body.lat = userLocation.lat;
        body.lng = userLocation.lng;
      }

      // Try to get neighborhood from selected community name
      if (selectedCommunity) {
        const comm = communitiesData?.communities?.find((c) => c.id === selectedCommunity);
        if (comm) body.neighborhoodName = comm.name;
      } else if (selectedWard) {
        const ward = wardsData?.wards?.find((w) => w.id === selectedWard);
        if (ward) body.neighborhoodName = ward.name;
      } else if (selectedLga) {
        const lga = lgasData?.lgas?.find((l) => l.id === selectedLga);
        if (lga) body.neighborhoodName = lga.name;
      } else if (selectedState) {
        const state = statesData?.states?.find((s) => s.id === selectedState);
        if (state) body.neighborhoodName = state.name;
      } else {
        body.neighborhoodName = "Nigeria";
      }

      await apiRequest("POST", "/api/feeds/community", body);
      toast({ title: "Post created successfully" });
      setPostContent("");
      setPostDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/feeds/community"] });
    } catch (err: any) {
      toast({ title: "Failed to create post", description: parseApiError(err), variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  }, [postContent, postCategory, postLocationSource, userLocation, selectedState, selectedLga, selectedWard, selectedCommunity, communitiesData, wardsData, lgasData, statesData, queryClient, toast]);

  const feeds = feedsData?.feeds ?? [];
  const trending = trendingData?.trending ?? [];

  // Determine which dropdowns to show based on active tab
  const showStateFilter = activeTab !== "near_you" || true;
  const showLgaFilter = !!selectedState;
  const showWardFilter = !!selectedLga && (activeTab === "ward" || activeTab === "community");
  const showCommunityFilter = (!!selectedWard || !!selectedLga) && (activeTab === "community");

  const hasActiveFilters = !!(selectedState || selectedLga || selectedWard || selectedCommunity);

  const clearFilters = () => {
    setSelectedState(null);
    setSelectedLga(null);
    setSelectedWard(null);
    setSelectedCommunity(null);
  };

  // Auto-detect location on mount for "near_you" tab
  useEffect(() => {
    if (activeTab === "near_you" && locationStatus === "idle" && navigator.geolocation) {
      // Don't auto-detect — let user trigger it
    }
  }, [activeTab, locationStatus]);

  return (
    <div className="space-y-4">
      {/* ─── Community Feeds Tabs ─── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap"
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* ─── Cascading Geo Filters ─── */}
          <div className="rounded-xl p-3 space-y-2 bg-card border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">Filter by Location</span>
              <div className="flex items-center gap-2">
                {/* Location detect button */}
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationStatus === "detecting"}
                  className="h-7 rounded-md text-[10px] px-2 border border-border bg-background text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                  title="Auto-detect your location"
                >
                  {locationStatus === "detecting" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Navigation className="h-3 w-3" />
                  )}
                  {locationStatus === "detected" ? "Located" : locationStatus === "denied" ? "Denied" : "Locate Me"}
                </button>

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "recent" | "nearest" | "trending" | "trust")}
                  className="h-7 rounded-md text-[10px] px-2 outline-none bg-background text-foreground border border-border"
                >
                  <option value="recent">Most Recent</option>
                  <option value="nearest">Nearest</option>
                  <option value="trending">Trending</option>
                  <option value="trust">Highest Trust</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="h-7 rounded-md text-[10px] px-2 border border-border bg-background text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* State → LGA → Ward → Community dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* State */}
              <select
                value={selectedState ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedState(val);
                  setSelectedLga(null);
                  setSelectedWard(null);
                  setSelectedCommunity(null);
                }}
                className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
              >
                <option value="">All States</option>
                {(statesData?.states ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                {[...NIGERIA_STATES].sort().filter(s => !statesData?.states?.some(sd => sd.name === s)).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* LGA (filtered by state) */}
              <select
                value={selectedLga ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedLga(val);
                  setSelectedWard(null);
                  setSelectedCommunity(null);
                }}
                disabled={!selectedState}
                className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-50"
              >
                <option value="">All LGAs</option>
                {(lgasData?.lgas ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
                {selectedState && !lgasData?.lgas?.length && getLgasForState(
                  statesData?.states?.find((s) => s.id === selectedState)?.name || ""
                ).sort().map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              {/* Ward (filtered by LGA) */}
              <select
                value={selectedWard ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedWard(val);
                  setSelectedCommunity(null);
                }}
                disabled={!selectedLga}
                className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-50"
              >
                <option value="">All Wards</option>
                {(wardsData?.wards ?? []).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              {/* Community (filtered by ward/LGA) */}
              <select
                value={selectedCommunity ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedCommunity(val);
                }}
                disabled={!selectedWard && !selectedLga}
                className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-50"
              >
                <option value="">All Communities</option>
                {(communitiesData?.communities ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── Auto-refresh indicator ─── */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              Auto-refreshing every 10s · {feeds.length} posts
            </span>
          </div>

          {/* ─── Trending Topics ─── */}
          {trending.length > 0 && (
            <Card className="border-purple-glow/30">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-glow" />
                  <span className="text-xs font-medium">Trending Topics</span>
                  <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-purple-glow/20 text-purple-glow border-none">AI</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {trending.slice(0, 8).map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[9px] gap-0.5">
                      <TrendingUp className="h-2 w-2" />
                      {t.category} · {t.postCount} posts
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Create Post Button ─── */}
          <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" variant="default" size="sm">
                <Newspaper className="h-4 w-4 mr-1.5" />
                Create Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Community Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Category */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full h-9 rounded-md text-sm px-2 mt-1 outline-none bg-background text-foreground border border-border"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Content</label>
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="What's happening in your area?"
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-md text-sm p-2 mt-1 outline-none bg-background text-foreground border border-border resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{postContent.length}/2000</p>
                </div>

                {/* Location */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={postLocationSource}
                      onChange={(e) => setPostLocationSource(e.target.value as "gps" | "manual")}
                      className="flex-1 h-9 rounded-md text-sm px-2 outline-none bg-background text-foreground border border-border"
                    >
                      <option value="manual">Manual (use selected area)</option>
                      <option value="gps">GPS Auto-detect</option>
                    </select>
                    {postLocationSource === "gps" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={detectLocation}
                        disabled={locationStatus === "detecting"}
                      >
                        {locationStatus === "detecting" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Navigation className="h-3 w-3" />
                        )}
                        Detect
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {selectedState ? `State: ${statesData?.states?.find(s => s.id === selectedState)?.name ?? "Selected"}` : "No area selected"}
                    {selectedLga ? ` · LGA: ${lgasData?.lgas?.find(l => l.id === selectedLga)?.name ?? "Selected"}` : ""}
                    {selectedWard ? ` · Ward: ${wardsData?.wards?.find(w => w.id === selectedWard)?.name ?? "Selected"}` : ""}
                    {selectedCommunity ? ` · Community: ${communitiesData?.communities?.find(c => c.id === selectedCommunity)?.name ?? "Selected"}` : ""}
                  </p>
                </div>

                {/* AI note */}
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-purple-glow/5 rounded-md p-2">
                  <Sparkles className="h-3 w-3 text-purple-glow shrink-0 mt-0.5" />
                  <span>AI will auto-tag your post, check for spam, and assign it to the right community. You can override the location manually above.</span>
                </div>

                <Button
                  onClick={handleCreatePost}
                  disabled={isPosting || postContent.trim().length < 10}
                  className="w-full"
                >
                  {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4 mr-1.5" />}
                  Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ─── Feed List ─── */}
          {feedsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-card animate-pulse" />
              ))}
            </div>
          ) : feeds.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Newspaper className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">
                  {TABS.find((t) => t.value === activeTab)?.label} Feed
                  <span className="text-[10px] text-muted-foreground font-normal ml-1">
                    ({feeds.length})
                  </span>
                </h2>
              </div>
              <div className="grid gap-2">
                <AnimatePresence>
                  {feeds.map((feed) => (
                    <motion.div
                      key={feed.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className="border-border hover:border-primary/30 transition-colors">
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="secondary" className="text-[9px]">{feed.category}</Badge>
                              {feed.aiTags.map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-[8px] text-purple-glow border-purple-glow/30">
                                  {tag}
                                </Badge>
                              ))}
                              {feed.displayName && (
                                <span className="text-[10px] text-muted-foreground">by {feed.displayName}</span>
                              )}
                              {feed.neighborhoodName && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {feed.neighborhoodName}
                                </span>
                              )}
                              {feed.distanceKm != null && (
                                <span className="text-[10px] text-muted-foreground">
                                  · {feed.distanceKm}km away
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-muted-foreground">
                              {timeAgo(feed.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-foreground line-clamp-3">{feed.content}</p>
                          <div className="flex items-center gap-3 pt-1">
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              Trust: {feed.trustScore}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <MessageCircle className="h-2.5 w-2.5" />
                              {feed.commentCount}
                            </span>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Share2 className="h-2.5 w-2.5" />
                              {feed.shareCount}
                            </span>
                            {feed.trendingScore > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-purple-glow">
                                <TrendingUp className="h-2.5 w-2.5" />
                                {Math.round(feed.trendingScore)}
                              </span>
                            )}
                            {feed.isAuthor && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-red-500"
                                disabled={deleteMutation.isPending && deleteMutation.variables === feed.id}
                                onClick={() => {
                                  if (confirm("Delete this post? This cannot be undone.")) {
                                    deleteMutation.mutate(feed.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <Card className="border-border border-dashed">
              <CardContent className="p-6 text-center space-y-2">
                <Newspaper className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">No posts yet</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? `No posts found for the selected ${activeTab} area. Try a different filter or be the first to post.`
                    : `Be the first to share a post in this ${activeTab === "near_you" ? "area" : activeTab}.`}
                </p>
                <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Newspaper className="h-3 w-3 mr-1" />
                      Create a Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Community Post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Category</label>
                        <select
                          value={postCategory}
                          onChange={(e) => setPostCategory(e.target.value)}
                          className="w-full h-9 rounded-md text-sm px-2 mt-1 outline-none bg-background text-foreground border border-border"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Content</label>
                        <textarea
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          placeholder="What's happening in your area?"
                          rows={4}
                          maxLength={2000}
                          className="w-full rounded-md text-sm p-2 mt-1 outline-none bg-background text-foreground border border-border resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground text-right">{postContent.length}/2000</p>
                      </div>
                      <Button
                        onClick={handleCreatePost}
                        disabled={isPosting || postContent.trim().length < 10}
                        className="w-full"
                      >
                        {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4 mr-1.5" />}
                        Post
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

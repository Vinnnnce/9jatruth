"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseApiError } from "@/lib/queryClient";
import { useLiveLocation } from "@/components/hooks/use-live-location";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";
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
  MapPin, Locate, Send, Loader2, Sparkles, ShieldCheck, TrendingUp,
  Navigation, Tag, X, Bot, AlertTriangle,
} from "lucide-react";
import {
  FEED_TAB_LABELS,
  FEED_CATEGORY_META,
  type FeedScope,
  type FeedCategory,
} from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

type FeedItem = {
  id: number;
  content: string;
  category: string;
  tags: string[];
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  regionName: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string | null;
  assignmentConfidence: number;
  spamVerdict: string;
  trustScore: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  isAuthor?: boolean;
  authorName?: string | null;
  distanceKm?: number | null;
};

type Hierarchy = {
  states: string[];
  lgasByState: Record<string, string[]>;
  wardsByLga: Record<string, string[]>;
  communitiesByWard: Record<string, string[]>;
};

type ReverseGeocodeResult = {
  assignment: {
    stateName: string | null;
    lgaName: string | null;
    wardName: string | null;
    communityName: string | null;
    regionName: string | null;
    assignmentConfidence: number;
    source: string;
  };
};

type CreateFeedResponse = {
  feed: FeedItem;
  ai: {
    tags: string[];
    tagSource: string;
    spam: { spamScore: number; verdict: string; reasons: string[] };
    assignment: {
      stateName: string | null;
      lgaName: string | null;
      wardName: string | null;
      communityName: string | null;
      confidence: number;
      source: string;
    };
  };
};

const SCOPES: FeedScope[] = ["near", "community", "ward", "lga", "state", "all"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function categoryIcon(cat: string) {
  const meta = FEED_CATEGORY_META[cat] || FEED_CATEGORY_META.general;
  return meta;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CommunityFeedSystem() {
  const { isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const liveLocation = useLiveLocation();

  const [activeScope, setActiveScope] = useState<FeedScope>("all");
  const [filters, setFilters] = useState<{ state: string; lga: string; ward: string; community: string }>({
    state: "", lga: "", ward: "", community: "",
  });

  // ── Hierarchy for cascading dropdowns ──
  const { data: hierarchy } = useQuery<Hierarchy>({
    queryKey: ["/api/feeds/hierarchy"],
    enabled: isLoaded,
  });

  // ── Detect location when "Near You" is selected ──
  useEffect(() => {
    if (activeScope === "near" && liveLocation.lat == null && !liveLocation.loading) {
      liveLocation.requestLocation();
    }
  }, [activeScope, liveLocation]);

  // ── Feed list query ──
  const feedQuery = useQuery<{ feeds: FeedItem[]; total: number; scope: string; postgisUsed: boolean }>({
    queryKey: ["/api/feeds", activeScope, filters, liveLocation.lat, liveLocation.lng],
    queryFn: async ({ queryKey }) => {
      const [, scope, f, lat, lng] = queryKey as [string, FeedScope, typeof filters, number | null, number | null];
      const params = new URLSearchParams({ scope, limit: "40" });
      if (scope === "near" && lat != null && lng != null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
        params.set("radiusKm", "15");
      }
      if (f.state) params.set("state", f.state);
      if (f.lga) params.set("lga", f.lga);
      if (f.ward) params.set("ward", f.ward);
      if (f.community) params.set("community", f.community);
      const res = await apiRequest("GET", `/api/feeds?${params.toString()}`);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // ── Trending ──
  const trendingQuery = useQuery<{ topics: { tag: string; count: number; label: string; trend: string }[] }>({
    queryKey: ["/api/feeds/trending", filters],
    queryFn: async ({ queryKey }) => {
      const [, f] = queryKey as [string, typeof filters];
      const params = new URLSearchParams({ scope: f.community ? "community" : f.lga ? "lga" : f.state ? "state" : "all" });
      if (f.state) params.set("state", f.state);
      if (f.lga) params.set("lga", f.lga);
      if (f.ward) params.set("ward", f.ward);
      if (f.community) params.set("community", f.community);
      const res = await apiRequest("GET", `/api/feeds/trending?${params.toString()}`);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 60000,
  });

  // ── Create feed mutation ──
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/feeds", data),
    onSuccess: async (res) => {
      const data: CreateFeedResponse = await res.json();
      toast({
        title: "Post published",
        description: data.ai.assignment.stateName
          ? `Auto-assigned to ${data.ai.assignment.communityName || data.ai.assignment.wardName || data.ai.assignment.lgaName}, ${data.ai.assignment.stateName}`
          : "Posted to All Nigeria",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds/trending"] });
    },
    onError: (err: Error) => {
      toast({ title: "Could not post", description: parseApiError(err), variant: "destructive" });
    },
  });

  // ── Cascading filter resets ──
  const setFilter = useCallback((key: "state" | "lga" | "ward" | "community", value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "state") { next.lga = ""; next.ward = ""; next.community = ""; }
      if (key === "lga") { next.ward = ""; next.community = ""; }
      if (key === "ward") { next.community = ""; }
      return next;
    });
  }, []);

  const lgas = useMemo(() => {
    if (!filters.state || !hierarchy) return [];
    return hierarchy.lgasByState[filters.state] || [];
  }, [filters.state, hierarchy]);

  const wards = useMemo(() => {
    if (!filters.state || !filters.lga || !hierarchy) return [];
    return hierarchy.wardsByLga[`${filters.state}|${filters.lga}`] || [];
  }, [filters, hierarchy]);

  const communities = useMemo(() => {
    if (!filters.state || !filters.lga || !filters.ward || !hierarchy) return [];
    return hierarchy.communitiesByWard[`${filters.state}|${filters.lga}|${filters.ward}`] || [];
  }, [filters, hierarchy]);

  const hasFilters = filters.state || filters.lga || filters.ward || filters.community;

  // When manual filters are set, switch scope to match the deepest selected level.
  const effectiveScope: FeedScope = filters.community ? "community"
    : filters.ward ? "ward"
    : filters.lga ? "lga"
    : filters.state ? "state"
    : activeScope;

  const feeds = feedQuery.data?.feeds ?? [];
  const isLoading = feedQuery.isLoading;

  return (
    <div className="space-y-3">
      {/* ─── Tabs ─── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {SCOPES.map((scope) => {
          const isActive = activeScope === scope && !hasFilters;
          return (
            <button
              key={scope}
              onClick={() => {
                setActiveScope(scope);
                if (scope !== "near" && hasFilters) {
                  setFilters({ state: "", lga: "", ward: "", community: "" });
                }
              }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              {scope === "near" && <Navigation className="h-3 w-3 inline mr-1" />}
              {FEED_TAB_LABELS[scope]}
            </button>
          );
        })}
      </div>

      {/* ─── Cascading Filters ─── */}
      <div className="rounded-xl p-3 space-y-2 bg-card border border-border">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Filter by Location
          </span>
          {hasFilters && (
            <button
              onClick={() => setFilters({ state: "", lga: "", ward: "", community: "" })}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              <X className="h-2.5 w-2.5" /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            value={filters.state}
            onChange={(e) => setFilter("state", e.target.value)}
            className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
          >
            <option value="">All States</option>
            {(hierarchy?.states ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.lga}
            onChange={(e) => setFilter("lga", e.target.value)}
            disabled={!filters.state}
            className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-40"
          >
            <option value="">All LGAs</option>
            {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select
            value={filters.ward}
            onChange={(e) => setFilter("ward", e.target.value)}
            disabled={!filters.lga}
            className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-40"
          >
            <option value="">All Wards</option>
            {wards.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select
            value={filters.community}
            onChange={(e) => setFilter("community", e.target.value)}
            disabled={!filters.ward}
            className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border disabled:opacity-40"
          >
            <option value="">All Communities</option>
            {communities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {activeScope === "near" && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {liveLocation.loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Detecting your location…</>
            ) : liveLocation.error ? (
              <><AlertTriangle className="h-3 w-3 text-amber-500" /> {liveLocation.error}</>
            ) : liveLocation.lat != null ? (
              <><Locate className="h-3 w-3 text-neon-green" /> Located · showing posts within 15 km</>
            ) : (
              <button onClick={liveLocation.requestLocation} className="text-primary hover:underline flex items-center gap-0.5">
                <Locate className="h-3 w-3" /> Enable location for nearby posts
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Composer ─── */}
      <FeedComposer
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
        detectedLocation={liveLocation.lat != null && liveLocation.lng != null ? { lat: liveLocation.lat, lng: liveLocation.lng } : null}
        hierarchy={hierarchy ?? null}
      />

      {/* ─── Trending ─── */}
      {trendingQuery.data?.topics && trendingQuery.data.topics.length > 0 && (
        <div className="rounded-xl p-3 space-y-2 bg-card border border-purple-glow/40">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-purple-glow" />
            <span className="text-xs font-medium text-foreground">Trending in your area</span>
            <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-purple-glow/20 text-purple-glow border-none">AI</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trendingQuery.data.topics.slice(0, 8).map((t) => (
              <Badge key={t.tag} variant="secondary" className="text-[10px] gap-1">
                {t.label}
                <span className="text-muted-foreground">·{t.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ─── Feed List ─── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            {FEED_TAB_LABELS[effectiveScope]}
            <span className="text-[10px] text-muted-foreground font-normal">
              ({feeds.length})
            </span>
          </h2>
          {feedQuery.data?.postgisUsed && (
            <Badge variant="outline" className="text-[8px] gap-0.5">
              <MapPin className="h-2 w-2" /> PostGIS
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : feeds.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center space-y-2">
              <MapPin className="h-7 w-7 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">No posts here yet</p>
              <p className="text-xs text-muted-foreground">Be the first to share what's happening in this area.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {feeds.map((feed) => <FeedCard key={feed.id} feed={feed} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composer ───────────────────────────────────────────────────────────────

function FeedComposer({
  onSubmit,
  isPending,
  detectedLocation,
  hierarchy,
}: {
  onSubmit: (payload: Record<string, unknown>) => void;
  isPending: boolean;
  detectedLocation: { lat: number; lng: number } | null;
  hierarchy: Hierarchy | null;
}) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [open, setOpen] = useState(false);
  const [autoLocation, setAutoLocation] = useState<ReverseGeocodeResult | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [manual, setManual] = useState({ state: "", lga: "", ward: "", community: "" });

  // Reverse-geocode detected coordinates to auto-fill the location fields.
  const detectLocation = useCallback(async () => {
    if (!detectedLocation) return;
    setGeocoding(true);
    try {
      const res = await apiRequest("POST", "/api/feeds/reverse-geocode", detectedLocation);
      const data: ReverseGeocodeResult = await res.json();
      setAutoLocation(data);
      setManual({
        state: data.assignment.stateName || "",
        lga: data.assignment.lgaName || "",
        ward: data.assignment.wardName || "",
        community: data.assignment.communityName || "",
      });
    } catch {
      toast({ title: "Could not detect location", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  }, [detectedLocation, toast]);

  const handleSubmit = () => {
    if (content.trim().length < 3) return;
    const payload: Record<string, unknown> = {
      content: content.trim(),
      category,
      locationSource: detectedLocation ? "browser" : "manual",
    };
    if (detectedLocation) {
      payload.lat = detectedLocation.lat;
      payload.lng = detectedLocation.lng;
    }
    // Manual overrides take precedence.
    if (manual.state) payload.stateName = manual.state;
    if (manual.lga) payload.lgaName = manual.lga;
    if (manual.ward) payload.wardName = manual.ward;
    if (manual.community) payload.communityName = manual.community;

    onSubmit(payload);
    setContent("");
    setManual({ state: "", lga: "", ward: "", community: "" });
    setAutoLocation(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full rounded-xl p-3 text-left bg-card border border-dashed border-primary/40 hover:border-primary transition-colors flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Send className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">Share what's happening in your area…</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> New Community Post
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="e.g. Power has been out in my area since morning, transformer fault near the market…"
            rows={4}
            className="w-full rounded-lg text-sm p-3 outline-none bg-background text-foreground border border-border resize-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
            >
              {Object.entries(FEED_CATEGORY_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={detectLocation}
              disabled={!detectedLocation || geocoding}
              className="h-8 text-xs gap-1"
            >
              {geocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Locate className="h-3 w-3" />}
              Auto-detect location
            </Button>
          </div>

          {/* Location assignment (auto + manual override) */}
          <div className="rounded-lg p-2.5 space-y-2 bg-muted/30 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-medium text-muted-foreground">Location</span>
              {autoLocation && (
                <Badge variant="outline" className="text-[8px] gap-0.5">
                  <MapPin className="h-2 w-2" />
                  {autoLocation.assignment.assignmentConfidence}% confidence
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={manual.state} onChange={(e) => setManual((m) => ({ ...m, state: e.target.value, lga: "", ward: "", community: "" }))} className="h-7 rounded-md text-[11px] px-1.5 outline-none bg-background text-foreground border border-border">
                <option value="">State…</option>
                {(hierarchy?.states ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={manual.lga} onChange={(e) => setManual((m) => ({ ...m, lga: e.target.value, ward: "", community: "" }))} disabled={!manual.state} className="h-7 rounded-md text-[11px] px-1.5 outline-none bg-background text-foreground border border-border disabled:opacity-40">
                <option value="">LGA…</option>
                {(manual.state && hierarchy ? hierarchy.lgasByState[manual.state] || [] : []).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={manual.ward} onChange={(e) => setManual((m) => ({ ...m, ward: e.target.value, community: "" }))} disabled={!manual.lga} className="h-7 rounded-md text-[11px] px-1.5 outline-none bg-background text-foreground border border-border disabled:opacity-40">
                <option value="">Ward…</option>
                {(manual.state && manual.lga && hierarchy ? hierarchy.wardsByLga[`${manual.state}|${manual.lga}`] || [] : []).map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <input
                value={manual.community}
                onChange={(e) => setManual((m) => ({ ...m, community: e.target.value }))}
                placeholder="Community/village…"
                className="h-7 rounded-md text-[11px] px-1.5 outline-none bg-background text-foreground border border-border"
              />
            </div>
            {autoLocation && !manual.state && (
              <p className="text-[9px] text-muted-foreground">
                Auto-assigned to {autoLocation.assignment.communityName || autoLocation.assignment.wardName || autoLocation.assignment.lgaName}, {autoLocation.assignment.stateName} · you can override above
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Bot className="h-2.5 w-2.5" /> AI auto-tags, spam-checks & assigns location
            </span>
            <Button size="sm" onClick={handleSubmit} disabled={isPending || content.trim().length < 3} className="h-8 px-4 text-xs gap-1">
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Feed Card ──────────────────────────────────────────────────────────────

function FeedCard({ feed }: { feed: FeedItem }) {
  const meta = categoryIcon(feed.category);
  const locationParts = [
    feed.communityName,
    feed.wardName,
    feed.lgaName,
    feed.stateName,
  ].filter(Boolean);
  const spammy = feed.spamVerdict === "suspicious";

  return (
    <Card className={`border-border hover:border-primary/30 transition-colors ${spammy ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[9px]">{meta.label}</Badge>
            {feed.tags.slice(0, 3).filter((t) => t !== feed.category).map((t) => (
              <Badge key={t} variant="outline" className="text-[8px] gap-0.5">
                <Tag className="h-2 w-2" /> {t}
              </Badge>
            ))}
            {spammy && (
              <Badge className="text-[8px] bg-amber-500/20 text-amber-500 border-none gap-0.5">
                <AlertTriangle className="h-2 w-2" /> Flagged
              </Badge>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground">{timeAgo(feed.createdAt)}</span>
        </div>
        <p className="text-xs text-foreground line-clamp-3">{feed.content}</p>
        <div className="flex items-center gap-2 pt-1 text-[9px] text-muted-foreground">
          {locationParts.length > 0 ? (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {locationParts.slice(0, 2).join(", ")}
            </span>
          ) : null}
          {feed.distanceKm != null && (
            <span>· {feed.distanceKm.toFixed(1)} km away</span>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <ShieldCheck className="h-2.5 w-2.5" />
            {feed.trustScore}%
          </span>
          {feed.locationSource && feed.locationSource !== "manual" && (
            <Badge variant="outline" className="text-[7px] px-1 py-0 capitalize">{feed.locationSource}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

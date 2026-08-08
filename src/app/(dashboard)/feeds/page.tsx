"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Clock, ShieldCheck,
  ThumbsUp, ThumbsDown, MapPin, Newspaper,
  Brain, Loader2, Sparkles, Zap, Fuel, Car, Tag,
  TrendingUp, TrendingDown, Minus,
  Building2, Gauge,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";

// ─── Types ───

type FeedSnapshot = {
  summary: {
    activeTruths: number;
    neighborhoods: number;
    avgSafetyIndex: number;
    avgPriceIndex: number;
    meshNodes: number;
  };
  neighborhoods: NeighborhoodCard[];
};

type NeighborhoodCard = {
  id: number;
  name: string;
  region: string;
  truthCount: number;
  metrics: {
    power: string;
    fuel: string;
    traffic: string;
    prices: number;
    safety: number;
  };
  prediction: {
    category: string;
    text: string;
    confidence: number;
    timeframe: string;
    trend: string;
    modelVersion: string;
  } | null;
  recentReports: {
    id: number;
    category: string;
    content: string;
    trustScore: number;
    createdAt: string;
    neighborhoodName: string;
  }[];
  updatedAt: string | null;
};

type Suggestion = {
  truthId: number;
  neighborhoodId: number;
  category: string;
  content: string;
  neighborhoodName: string;
  trustScore: number;
  createdAt: string;
  score: number;
  reason: string;
};

// ─── Design tokens matching uploaded image ───

const COLORS = {
  bg: "#0A0C0B",
  card: "#121413",
  tile: "#1A1D1B",
  textPrimary: "#FFFFFF",
  textSecondary: "#8E928F",
  green: "#22C55E",
  orange: "#F97316",
  red: "#EF4444",
  blue: "#3B82F6",
  purple: "#A855F7",
  accent: "#6366F1",
};

const CATEGORY_META: Record<string, { icon: typeof Zap; color: string; dot: string; label: string }> = {
  power:    { icon: Zap,   color: "text-orange-400", dot: "bg-orange-500", label: "Power" },
  fuel:     { icon: Fuel,  color: "text-orange-400", dot: "bg-orange-500", label: "Fuel" },
  traffic:  { icon: Car,   color: "text-blue-400",   dot: "bg-blue-500",   label: "Traffic" },
  prices:   { icon: Tag,   color: "text-purple-400", dot: "bg-purple-500", label: "Prices" },
  safety:   { icon: ShieldCheck, color: "text-green-400", dot: "bg-green-500", label: "Safety" },
};

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

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (/on|available|clear|free|flowing|stable|low/.test(s)) return COLORS.green;
  if (/off|outage|unavailable|down|gridlock|heavy|scarce/.test(s)) return COLORS.red;
  if (/unstable|moderate|scarce/.test(s)) return COLORS.orange;
  return COLORS.textSecondary;
}

function trendIcon(trend: string) {
  if (trend === "up" || trend === "risk") return <TrendingUp className="h-3 w-3" style={{ color: trend === "risk" ? COLORS.red : COLORS.orange }} />;
  if (trend === "down") return <TrendingDown className="h-3 w-3" style={{ color: COLORS.green }} />;
  return <Minus className="h-3 w-3" style={{ color: COLORS.textSecondary }} />;
}

// ─── Browsing event tracker hook ───

function useBrowsingTracker() {
  const recordEvent = useCallback(async (eventType: string, data?: Record<string, any>) => {
    try {
      await apiRequest("POST", "/api/user/browsing-events", { eventType, ...data });
    } catch {
      // silently fail — tracking is non-critical
    }
  }, []);

  return { recordEvent };
}

// ─── Main Component ───

export default function Feeds() {
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { recordEvent } = useBrowsingTracker();
  const trackedRef = useRef<Set<number>>(new Set());

  // Geo filters for feeds
  const [geoFilter, setGeoFilter] = useState({
    country: "",
    region: "",
    state: "",
    lga: "",
  });

  // Fetch geo hierarchy for filter dropdowns
  const { data: geoHierarchy } = useQuery<{ regions: string[]; states: string[]; lgas: string[] }>({
    queryKey: ["/api/geo/hierarchy"],
  });

  // Fetch feed snapshots with auto-refresh every 5 seconds
  const { data: feedData, isLoading } = useQuery<FeedSnapshot>({
    queryKey: ["/api/feed/snapshots", geoFilter],
    queryFn: async ({ queryKey }) => {
      const [, filter] = queryKey as [string, typeof geoFilter];
      const params = new URLSearchParams();
      if (filter.region) params.set("region", filter.region);
      if (filter.state) params.set("state", filter.state);
      if (filter.lga) params.set("lga", filter.lga);
      const qs = params.toString();
      const url = qs ? `/api/feed/snapshots?${qs}` : "/api/feed/snapshots";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    refetchOnWindowFocus: true,
  });

  // Fetch AI suggestions
  const { data: suggestionsData } = useQuery<{ suggestions: Suggestion[] }>({
    queryKey: ["/api/feed/suggestions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/feed/suggestions?limit=5");
      return res.json();
    },
    enabled: isLoaded && isSignedIn,
  });

  // Track feed view on mount
  useEffect(() => {
    if (isLoaded) {
      recordEvent("feed_view", { path: "/feeds" });
    }
  }, [isLoaded, recordEvent]);

  const verifyMutation = useMutation({
    mutationFn: (data: { truthId: number; action: string }) =>
      apiRequest("POST", "/api/truths/verify", data),
    onSuccess: () => {
      toast({ title: "Verification submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
    },
    onError: () => {
      toast({ title: "Verification failed", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 max-w-[440px] mx-auto space-y-4" style={{ background: COLORS.bg }}>
        <div className="h-24 rounded-2xl animate-pulse" style={{ background: COLORS.card }} />
        <div className="h-8 rounded-lg animate-pulse" style={{ background: COLORS.card }} />
        <div className="h-[400px] rounded-2xl animate-pulse" style={{ background: COLORS.card }} />
        <div className="h-[400px] rounded-2xl animate-pulse" style={{ background: COLORS.card }} />
      </div>
    );
  }

  const summary = feedData?.summary;
  const neighborhoods = feedData?.neighborhoods ?? [];
  const suggestions = suggestionsData?.suggestions ?? [];
  const hasNearbyFeeds = neighborhoods.length > 0;

  // Build a fallback feed from all available truths if no nearby feeds
  const allReports = neighborhoods.length > 0
    ? neighborhoods.flatMap(n => n.recentReports || [])
    : [];

  // If no nearby feeds, show a message and other available posts
  const showFallback = !hasNearbyFeeds;
  return (
    <div
      className="min-h-screen pb-8"
      style={{ background: COLORS.bg, color: COLORS.textPrimary }}
    >
      <div className="max-w-[440px] mx-auto px-4 pt-4 space-y-4">
        {/* ─── Summary Grid (2×2) ─── */}
        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard
            icon={Newspaper}
            label="Active Truths"
            value={summary?.activeTruths ?? 0}
            color={COLORS.green}
          />
          <SummaryCard
            icon={Building2}
            label="Neighborhoods"
            value={summary?.neighborhoods ?? 0}
            color={COLORS.blue}
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Avg Safety Index"
            value={summary?.avgSafetyIndex ?? 0}
            color={COLORS.green}
          />
          <SummaryCard
            icon={Gauge}
            label="Avg Price Index"
            value={summary?.avgPriceIndex ?? 0}
            color={COLORS.purple}
          />
        </div>

        {/* ─── Geo Filters ─── */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: COLORS.card }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase" style={{ color: COLORS.textSecondary }}>Filter by Location</span>
            {(geoFilter.region || geoFilter.state || geoFilter.lga) && (
              <button
                onClick={() => setGeoFilter({ country: "", region: "", state: "", lga: "" })}
                className="text-[10px] text-blue-400 hover:underline"
              >Clear</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={geoFilter.region}
              onChange={(e) => setGeoFilter(f => ({ ...f, region: e.target.value, state: "", lga: "" }))}
              className="h-8 rounded-md text-xs px-2 outline-none"
              style={{ background: COLORS.tile, color: COLORS.textPrimary, border: `1px solid ${COLORS.textSecondary}30` }}
            >
              <option value="">All Regions</option>
              {(geoHierarchy?.regions || []).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={geoFilter.state}
              onChange={(e) => setGeoFilter(f => ({ ...f, state: e.target.value, lga: "" }))}
              className="h-8 rounded-md text-xs px-2 outline-none"
              style={{ background: COLORS.tile, color: COLORS.textPrimary, border: `1px solid ${COLORS.textSecondary}30` }}
            >
              <option value="">All States</option>
              {(geoHierarchy?.states || []).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={geoFilter.lga}
              onChange={(e) => setGeoFilter(f => ({ ...f, lga: e.target.value }))}
              className="h-8 rounded-md text-xs px-2 outline-none col-span-2"
              style={{ background: COLORS.tile, color: COLORS.textPrimary, border: `1px solid ${COLORS.textSecondary}30` }}
            >
              <option value="">All L.G.A</option>
              {(geoHierarchy?.lgas || []).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* ─── Auto-refresh indicator ─── */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-[10px] font-medium" style={{ color: COLORS.textSecondary }}>
            Auto-refreshing every 5s · Live
          </span>
        </div>

        {/* ─── Section Header ─── */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
            {hasNearbyFeeds ? "Neighborhood Snapshots" : "Other Posts"}
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-medium" style={{ color: COLORS.textSecondary }}>
              Live · {summary?.meshNodes ?? 0} mesh nodes
            </span>
          </div>
        </div>

        {/* ─── Fallback: No nearby feeds ─── */}
        {showFallback && (
          <div className="rounded-xl p-4 text-center" style={{ background: COLORS.card }}>
            <Newspaper className="h-6 w-6 mx-auto mb-2" style={{ color: COLORS.textSecondary }} />
            <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>No feeds nearby</p>
            <p className="text-xs mt-1" style={{ color: COLORS.textSecondary }}>
              Showing other posts from across the platform
            </p>
          </div>
        )}

        {/* ─── AI Suggestions (if available) ─── */}
        {suggestions.length > 0 && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.tile}` }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
              <span className="text-xs font-medium" style={{ color: COLORS.textPrimary }}>
                Suggested for You
              </span>
              <Badge
                className="text-[9px] px-1.5 py-0 rounded-full"
                style={{ background: `${COLORS.accent}20`, color: COLORS.accent, border: "none" }}
              >
                AI
              </Badge>
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s) => {
                const meta = CATEGORY_META[s.category] || CATEGORY_META.safety;
                const Icon = meta.icon;
                return (
                  <Dialog key={s.truthId}>
                    <DialogTrigger asChild>
                      <button
                        className="w-full flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                        onClick={() => recordEvent("suggestion_click", { truthId: s.truthId })}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: COLORS.textPrimary }}>
                            {s.content}
                          </p>
                          <p className="text-[9px]" style={{ color: COLORS.textSecondary }}>
                            {s.reason}
                          </p>
                        </div>
                        <span className="text-[9px] shrink-0" style={{ color: COLORS.textSecondary }}>
                          {timeAgo(s.createdAt)}
                        </span>
                      </button>
                    </DialogTrigger>
                    <SuggestionDialog
                      suggestion={s}
                      onVerify={(action) => verifyMutation.mutate({ truthId: s.truthId, action })}
                      isPending={verifyMutation.isPending}
                    />
                  </Dialog>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Neighborhood Snapshot Cards ─── */}
        {neighborhoods.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: COLORS.card }}
          >
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" style={{ color: COLORS.textSecondary }} />
            <p className="text-xs" style={{ color: COLORS.textSecondary }}>
              No neighborhood data yet. Be the first to share a truth.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {neighborhoods.map((nb) => (
              <NeighborhoodSnapshotCard
                key={nb.id}
                card={nb}
                onTrackView={(id) => {
                  if (!trackedRef.current.has(id)) {
                    trackedRef.current.add(id);
                    recordEvent("snapshot_view", { neighborhoodId: nb.id });
                  }
                }}
                onVerify={(truthId, action) => verifyMutation.mutate({ truthId, action })}
                isVerifyPending={verifyMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Summary Card (2×2 grid item) ───

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: COLORS.card }}
    >
      <Icon className="h-4 w-4" style={{ color }} />
      <div>
        <p className="text-xl font-bold" style={{ color: COLORS.textPrimary }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-[10px] uppercase tracking-normal" style={{ color: COLORS.textSecondary }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Neighborhood Snapshot Card ───

function NeighborhoodSnapshotCard({
  card,
  onTrackView,
  onVerify,
  isVerifyPending,
}: {
  card: NeighborhoodCard;
  onTrackView: (id: number) => void;
  onVerify: (truthId: number, action: string) => void;
  isVerifyPending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver for tracking card views
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          onTrackView(card.id);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.id, isVisible, onTrackView]);

  const metrics = [
    { key: "power", label: "Power", value: card.metrics.power, icon: Zap, category: "power" },
    { key: "fuel", label: "Fuel", value: card.metrics.fuel, icon: Fuel, category: "fuel" },
    { key: "traffic", label: "Traffic", value: card.metrics.traffic, icon: Car, category: "traffic" },
    { key: "prices", label: "Prices", value: card.metrics.prices, icon: Tag, category: "prices" },
    { key: "safety", label: "Safety", value: card.metrics.safety, icon: ShieldCheck, category: "safety" },
  ];

  return (
    <div
      ref={ref}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: COLORS.card }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
            {card.name}
          </h3>
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>
            {card.region}
          </p>
        </div>
        <Badge
          className="text-[10px] px-2.5 py-0.5 rounded-full"
          style={{ background: COLORS.tile, color: COLORS.textPrimary, border: "none" }}
        >
          {card.truthCount} truths
        </Badge>
      </div>

      {/* ─── Metrics Grid (3 top, 2 bottom) ─── */}
      <div className="grid grid-cols-3 gap-2">
        {metrics.slice(0, 3).map((m) => (
          <MetricTile key={m.key} metric={m} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-[66%] mx-auto">
        {metrics.slice(3).map((m) => (
          <MetricTile key={m.key} metric={m} />
        ))}
      </div>

      {/* ─── AI Prediction Box ─── */}
      {card.prediction && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{
            background: `${COLORS.tile}`,
            border: `1px solid ${COLORS.accent}30`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
              <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: COLORS.textSecondary }}>
                AI Prediction
              </span>
              {trendIcon(card.prediction.trend)}
            </div>
            <Badge
              className="text-[9px] px-1.5 py-0 rounded-full"
              style={{
                background: card.prediction.confidence >= 75 ? `${COLORS.green}20` : card.prediction.confidence >= 50 ? `${COLORS.orange}20` : `${COLORS.red}20`,
                color: card.prediction.confidence >= 75 ? COLORS.green : card.prediction.confidence >= 50 ? COLORS.orange : COLORS.red,
                border: "none",
              }}
            >
              {card.prediction.confidence}% confidence
            </Badge>
          </div>
          <p className="text-xs" style={{ color: COLORS.textPrimary }}>
            {card.prediction.text}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[9px]" style={{ color: COLORS.textSecondary }}>
              {card.prediction.category} · {card.prediction.timeframe}
            </span>
            {card.prediction.modelVersion.startsWith("kimi") && (
              <Badge
                className="text-[8px] px-1 py-0 rounded-full"
                style={{ background: `${COLORS.accent}15`, color: COLORS.accent, border: "none" }}
              >
                Kimi K3 AI
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* ─── Recent Reports ─── */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: COLORS.textSecondary }}>
          Recent Reports
        </p>
        {card.recentReports.length === 0 ? (
          <p className="text-[10px] py-2" style={{ color: COLORS.textSecondary }}>
            No reports yet
          </p>
        ) : (
          <div className="space-y-0.5">
            {card.recentReports.map((report) => {
              const meta = CATEGORY_META[report.category] || CATEGORY_META.safety;
              const Icon = meta.icon;
              return (
                <Dialog key={report.id}>
                  <DialogTrigger asChild>
                    <button className="group w-full">
                      <div
                        className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => {
                          // Track post detail open
                          apiRequest("POST", "/api/user/browsing-events", {
                            eventType: "post_detail_open",
                            truthId: report.id,
                            neighborhoodId: card.id,
                            category: report.category,
                          }).catch(() => {});
                        }}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
                        <p className="text-xs truncate flex-1 text-left" style={{ color: COLORS.textPrimary }}>
                          {report.content}
                        </p>
                        <span className="text-[10px] shrink-0" style={{ color: COLORS.textSecondary }}>
                          {timeAgo(report.createdAt)}
                        </span>
                      </div>
                    </button>
                  </DialogTrigger>
                  <ReportDialog
                    report={report}
                    neighborhoodName={card.name}
                    onVerify={(action) => onVerify(report.id, action)}
                    isPending={isVerifyPending}
                  />
                </Dialog>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <div className="flex items-center gap-1.5 pt-1">
        <Clock className="h-2.5 w-2.5" style={{ color: COLORS.textSecondary }} />
        <span className="text-[10px]" style={{ color: COLORS.textSecondary }}>
          Updated {card.updatedAt ? timeAgo(card.updatedAt) : "just now"}
        </span>
      </div>
    </div>
  );
}

// ─── Metric Tile ───

function MetricTile({ metric }: { metric: { label: string; value: string | number; icon: typeof Zap; category: string } }) {
  const Icon = metric.icon;
  const meta = CATEGORY_META[metric.category];
  const color = meta?.color || "text-gray-400";

  const isNumeric = typeof metric.value === "number";
  const statusStr = String(metric.value);
  const dotColor = statusColor(statusStr);

  return (
    <div
      className="rounded-xl p-2.5 space-y-1 overflow-hidden"
      style={{ background: COLORS.tile }}
    >
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <p className="text-[9px] uppercase tracking-normal whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: COLORS.textSecondary }}>
        {metric.label}
      </p>
      <div className="flex items-center gap-1">
        {!isNumeric && (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
        )}
        <span className="text-[11px] font-medium" style={{ color: COLORS.textPrimary }}>
          {isNumeric ? metric.value : statusStr}
        </span>
      </div>
    </div>
  );
}

// ─── Report Dialog (post detail) ───

function ReportDialog({
  report,
  neighborhoodName,
  onVerify,
  isPending,
}: {
  report: NeighborhoodCard["recentReports"][0];
  neighborhoodName: string;
  onVerify: (action: string) => void;
  isPending: boolean;
}) {
  const meta = CATEGORY_META[report.category] || CATEGORY_META.safety;
  const Icon = meta.icon;

  return (
    <DialogContent className="max-w-md" style={{ background: COLORS.card, border: `1px solid ${COLORS.tile}` }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <Icon className={`h-4 w-4 ${meta.color}`} />
          {meta.label} Report
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm" style={{ color: COLORS.textPrimary }}>{report.content}</p>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: COLORS.textSecondary }}>
          <span className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {neighborhoodName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(report.createdAt)}
          </span>
        </div>
        {/* Trust score */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: COLORS.tile }}>
          <ShieldCheck className="h-3.5 w-3.5" style={{ color: report.trustScore >= 70 ? COLORS.green : report.trustScore >= 40 ? COLORS.orange : COLORS.red }} />
          <div className="flex-1 max-w-[100px]">
            <Progress value={report.trustScore} className="h-1.5" />
          </div>
          <span className="text-xs font-mono font-medium" style={{ color: report.trustScore >= 70 ? COLORS.green : report.trustScore >= 40 ? COLORS.orange : COLORS.red }}>
            {report.trustScore}%
          </span>
          <span className="text-[9px] uppercase" style={{ color: COLORS.textSecondary }}>Trust</span>
        </div>
        {/* AI Verification Section */}
        <AIVerificationSection truthId={report.id} />
        <AIPredictionSection truthId={report.id} />
        {/* Actions */}
        <div className="flex items-center gap-0.5 pt-2" style={{ borderTop: `1px solid ${COLORS.tile}` }}>
          <Button
            size="sm" variant="ghost"
            onClick={() => onVerify("corroborate")}
            disabled={isPending}
            className="h-8 w-8 p-0"
            title="Corroborate" aria-label="Corroborate"
          >
            <ThumbsUp className="h-4 w-4" style={{ color: COLORS.green }} />
          </Button>
          <Button
            size="sm" variant="ghost"
            onClick={() => onVerify("dispute")}
            disabled={isPending}
            className="h-8 w-8 p-0"
            title="Dispute" aria-label="Dispute"
          >
            <ThumbsDown className="h-4 w-4" style={{ color: COLORS.red }} />
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── Suggestion Dialog ───

function SuggestionDialog({
  suggestion,
  onVerify,
}: {
  suggestion: Suggestion;
  onVerify: (action: string) => void;
  isPending: boolean;
}) {
  const meta = CATEGORY_META[suggestion.category] || CATEGORY_META.safety;
  const Icon = meta.icon;

  return (
    <DialogContent className="max-w-md" style={{ background: COLORS.card, border: `1px solid ${COLORS.tile}` }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4" style={{ color: COLORS.accent }} />
          AI Suggestion
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm" style={{ color: COLORS.textPrimary }}>{suggestion.content}</p>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: `${COLORS.accent}15` }}>
          <Brain className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
          <p className="text-[10px]" style={{ color: COLORS.textSecondary }}>{suggestion.reason}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]" style={{ color: COLORS.textSecondary }}>
          <span className="flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />
            {suggestion.neighborhoodName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(suggestion.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 pt-2" style={{ borderTop: `1px solid ${COLORS.tile}` }}>
          <Button
            size="sm" variant="ghost"
            onClick={() => onVerify("corroborate")}
            className="h-8 w-8 p-0"
            title="Corroborate"
          >
            <ThumbsUp className="h-4 w-4" style={{ color: COLORS.green }} />
          </Button>
          <Button
            size="sm" variant="ghost"
            onClick={() => onVerify("dispute")}
            className="h-8 w-8 p-0"
            title="Dispute"
          >
            <ThumbsDown className="h-4 w-4" style={{ color: COLORS.red }} />
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ─── AI Verification Section (inline on each post dialog) ───

function AIVerificationSection({ truthId }: { truthId: number }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/verify-ai`);
      if (!res.ok) throw new Error("Verification failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Could not run AI verification.");
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = (v: string) => {
    if (v === "authentic") return COLORS.green;
    if (v === "suspicious") return COLORS.red;
    return COLORS.orange;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1">
          <Brain className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
          AI Authenticity Check
        </p>
        {!result && !loading && (
          <Button size="sm" variant="outline" onClick={handleVerify} className="h-6 text-[10px] gap-1 px-2">
            <Sparkles className="h-2.5 w-2.5" />
            Verify
          </Button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs py-1" style={{ color: COLORS.textSecondary }}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing...
        </div>
      )}
      {error && <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>}
      {result && !loading && (
        <div className="rounded-md border p-2.5 space-y-2" style={{ background: COLORS.tile, borderColor: `${verdictColor(result.verdict)}30` }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium capitalize" style={{ color: verdictColor(result.verdict) }}>
              {result.verdict}
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: verdictColor(result.verdict) }}>
              {result.confidence}%
            </span>
          </div>
          <p className="text-[10px]" style={{ color: COLORS.textSecondary }}>{result.explanation}</p>
          <div className="grid grid-cols-4 gap-1 text-[9px]">
            {[
              { label: "Content", val: result.signals?.contentAnalysis?.score ?? 0 },
              { label: "Source", val: result.signals?.sourceCredibility?.score ?? 0 },
              { label: "Community", val: result.signals?.communitySignals?.score ?? 0 },
              { label: "Time", val: result.signals?.temporalPattern?.score ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded px-1 py-0.5 text-center" style={{ background: COLORS.card }}>
                <p style={{ color: COLORS.textSecondary }}>{s.label}</p>
                <p className="font-mono font-medium" style={{ color: COLORS.textPrimary }}>{Math.round(s.val)}%</p>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={handleVerify} className="h-5 text-[9px] gap-1">
            <Sparkles className="h-2 w-2" />
            Re-check
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── AI Prediction Section (inline on each post dialog) ───

function AIPredictionSection({ truthId }: { truthId: number }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/prediction`);
      if (!res.ok) throw new Error("Prediction failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Could not generate AI prediction.");
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (r: string) => {
    if (r === "high") return COLORS.red;
    if (r === "moderate") return COLORS.orange;
    return COLORS.green;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
          AI Prediction
        </p>
        {!result && !loading && (
          <Button size="sm" variant="outline" onClick={handlePredict} className="h-6 text-[10px] gap-1 px-2">
            <Sparkles className="h-2.5 w-2.5" />
            Predict
          </Button>
        )}
      </div>
      {loading && (
        <div className="flex items-center gap-2 text-xs py-1" style={{ color: COLORS.textSecondary }}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating prediction...
        </div>
      )}
      {error && <p className="text-xs" style={{ color: COLORS.red }}>{error}</p>}
      {result && !loading && (
        <div className="rounded-md border p-2.5 space-y-2" style={{ background: COLORS.tile, borderColor: `${riskColor(result.riskLevel)}30` }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: riskColor(result.riskLevel) }}>
              Risk: <span className="capitalize">{result.riskLevel}</span>
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: COLORS.accent }}>
              {result.confidence}%
            </span>
          </div>
          <p className="text-[10px]" style={{ color: COLORS.textSecondary }}>{result.prediction}</p>
          {result.aiPowered && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${COLORS.accent}15`, color: COLORS.accent }}>
              Kimi K3 AI
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={handlePredict} className="h-5 text-[9px] gap-1">
            <Sparkles className="h-2 w-2" />
            Re-predict
          </Button>
        </div>
      )}
    </div>
  );
}

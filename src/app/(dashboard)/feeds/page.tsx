"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Building2, Gauge, CloudRain, Store, AlertTriangle, Wifi,
  MessageCircle, Share2, Flag, Heart, BarChart3,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useUser } from "@/lib/use-user-safe";
import { NewsFeed } from "@/components/news-feed";
import { FeedComments } from "@/components/feed-comments";
import { PollCard } from "@/components/poll-card";
import { motion } from "framer-motion";
import { ClipboardList, Send as SendIcon } from "lucide-react";
import { NIGERIA_STATES, getLgasForState } from "@/lib/nigeria-locations";

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

type QuestionnaireQuestion = {
  id: number;
  question: string;
  type: string;
  options?: string[];
  required?: boolean;
};

// ─── Category metadata with Soke brand colors ───

const CATEGORY_META: Record<string, { icon: typeof Zap; color: string; dot: string; label: string }> = {
  power:    { icon: Zap,   color: "text-warm-orange", dot: "bg-orange-500", label: "Power" },
  fuel:     { icon: Fuel,  color: "text-warm-orange", dot: "bg-orange-500", label: "Fuel" },
  traffic:  { icon: Car,   color: "text-electric-blue", dot: "bg-blue-500",   label: "Traffic" },
  prices:   { icon: Tag,   color: "text-purple-glow", dot: "bg-purple-500", label: "Prices" },
  safety:   { icon: ShieldCheck, color: "text-neon-green", dot: "bg-green-500", label: "Safety" },
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
  if (/on|available|clear|free|flowing|stable|low/.test(s)) return "text-green-500";
  if (/off|outage|unavailable|down|gridlock|heavy|scarce/.test(s)) return "text-red-500";
  if (/unstable|moderate/.test(s)) return "text-amber-500";
  return "text-muted-foreground";
}

function statusDot(status: string): string {
  const s = status.toLowerCase();
  if (/on|available|clear|free|flowing|stable|low/.test(s)) return "bg-green-500";
  if (/off|outage|unavailable|down|gridlock|heavy|scarce/.test(s)) return "bg-red-500";
  if (/unstable|moderate/.test(s)) return "bg-amber-500";
  return "bg-muted-foreground";
}

function trendIcon(trend: string) {
  if (trend === "up" || trend === "risk") return <TrendingUp className="h-3 w-3 text-amber-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-green-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
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

  // Geo filters for feeds (state and lga only)
  const [geoFilter, setGeoFilter] = useState({
    state: "",
    lga: "",
  });

  // Fetch geo hierarchy for filter dropdowns (states and lgas only)
  const { data: geoHierarchy } = useQuery<{ states: string[]; lgas: string[] }>({
    queryKey: ["/api/geo/hierarchy"],
  });

  // Fetch feed snapshots with auto-refresh every 5 seconds
  const { data: feedData, isLoading } = useQuery<FeedSnapshot>({
    queryKey: ["/api/feed/snapshots", geoFilter],
    queryFn: async ({ queryKey }) => {
      const [, filter] = queryKey as [string, typeof geoFilter];
      const params = new URLSearchParams();
      if (filter.state) params.set("state", filter.state);
      if (filter.lga) params.set("lga", filter.lga);
      const qs = params.toString();
      const url = qs ? `/api/feed/snapshots?${qs}` : "/api/feed/snapshots";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Fetch recent truths directly (not just neighborhood-grouped)
  const { data: recentTruths } = useQuery({
    queryKey: ["/api/truths", geoFilter],
    queryFn: async ({ queryKey }) => {
      const [, filter] = queryKey as [string, typeof geoFilter];
      const params = new URLSearchParams({ limit: "50" });
      if (filter.state) params.set("state", filter.state);
      if (filter.lga) params.set("lga", filter.lga);
      const res = await apiRequest("GET", `/api/truths?${params.toString()}`);
      return res.json();
    },
    enabled: isLoaded,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Fetch active polls
  const { data: pollsData } = useQuery({
    queryKey: ["/api/polls"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/polls?limit=5");
      return res.json();
    },
    enabled: isLoaded,
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

  // Fetch active questionnaire questions
  const { data: questionnaireData } = useQuery<{ questions: QuestionnaireQuestion[] }>({
    queryKey: ["/api/questionnaire/manage"],
  });

  const submitAnswerMutation = useMutation({
    mutationFn: (data: { questionId: number; answer: string }) =>
      apiRequest("POST", "/api/questionnaire/manage/answer", data),
    onSuccess: () => {
      toast({ title: "Answer submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/questionnaire/manage"] });
    },
    onError: () => {
      toast({ title: "Failed to submit answer", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isLoaded) {
      recordEvent("feed_view", { path: "/feeds" });
    }
  }, [isLoaded, recordEvent]);

  const verifyMutation = useMutation({
    mutationFn: (data: { truthId: number; action: string }) =>
      apiRequest("POST", `/api/truths/${data.truthId}/verify`, { action: data.action }),
    onSuccess: () => {
      toast({ title: "Verification submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed/snapshots"] });
    },
    onError: () => {
      toast({ title: "Verification failed", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-24 rounded-2xl bg-card animate-pulse" />
        <div className="h-8 rounded-lg bg-card animate-pulse" />
        <div className="h-[400px] rounded-2xl bg-card animate-pulse" />
        <div className="h-[400px] rounded-2xl bg-card animate-pulse" />
      </div>
    );
  }

  const summary = feedData?.summary;
  const neighborhoods = feedData?.neighborhoods ?? [];
  const suggestions = suggestionsData?.suggestions ?? [];
  const hasNearbyFeeds = neighborhoods.length > 0;
  const showFallback = !hasNearbyFeeds;

  return (
    <div className="min-h-screen pb-8 bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 space-y-4">
        {/* ─── Summary Grid (2x2) ─── */}
        <div className="grid grid-cols-2 gap-2.5">
          <SummaryCard icon={Newspaper} label="Active Truths" value={summary?.activeTruths ?? 0} colorClass="text-neon-green" />
          <SummaryCard icon={Building2} label="Neighborhoods" value={summary?.neighborhoods ?? 0} colorClass="text-electric-blue" />
          <SummaryCard icon={ShieldCheck} label="Avg Safety Index" value={summary?.avgSafetyIndex ?? 0} colorClass="text-neon-green" />
          <SummaryCard icon={Gauge} label="Avg Price Index" value={summary?.avgPriceIndex ?? 0} colorClass="text-purple-glow" />
        </div>

        {/* ─── Geo Filters ─── */}
        <div className="rounded-xl p-3 space-y-2 bg-card border border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">Filter by Location</span>
            {(geoFilter.state || geoFilter.lga) && (
              <button
                onClick={() => setGeoFilter({ state: "", lga: "" })}
                className="text-[10px] text-primary hover:underline"
              >Clear</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={geoFilter.state}
              onChange={(e) => setGeoFilter(f => ({ ...f, state: e.target.value, lga: "" }))}
              className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
            >
              <option value="">All States</option>
              {(geoHierarchy?.states?.length ? geoHierarchy.states : NIGERIA_STATES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={geoFilter.lga}
              onChange={(e) => setGeoFilter(f => ({ ...f, lga: e.target.value }))}
              className="h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
            >
              <option value="">All L.G.A</option>
              {(geoFilter.state ? getLgasForState(geoFilter.state) : (geoHierarchy?.lgas || [])).map(l => <option key={l} value={l}>{l}</option>)}
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
            Auto-refreshing every 5s · Live
          </span>
        </div>

        {/* ─── Recent Posts (direct truth feed) ─── */}
        {recentTruths?.truths && recentTruths.truths.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Newspaper className="h-4 w-4 text-primary" />
              Recent Posts
              <span className="text-[10px] text-muted-foreground font-normal">
                ({recentTruths.truths.length})
              </span>
            </h2>
            <div className="grid gap-2">
              {recentTruths.truths.slice(0, 15).map((truth: any) => (
                <Card key={truth.id} className="border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {truth.category && (
                          <Badge variant="secondary" className="text-[9px]">
                            {truth.category}
                          </Badge>
                        )}
                        {truth.neighborhoodName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {truth.neighborhoodName}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(truth.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{truth.content}</p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Trust: {truth.trustScore ?? 50}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── Active Polls ─── */}
        {pollsData?.polls && pollsData.polls.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" />
              Active Polls
            </h2>
            <div className="grid gap-2">
              {pollsData.polls.map((poll: any) => (
                <PollCard key={poll.id} pollId={poll.id} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Additional dashboard widgets row (POS, Weather, Scam Alerts) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ExtraWidget icon={Store} label="POS Network" value={summary ? (summary.neighborhoods > 0 ? `${Math.min(summary.meshNodes, 100)}% online` : "No data") : "—"} colorClass="text-electric-blue" />
          <ExtraWidget icon={CloudRain} label="Micro-Climate" value="Clear · 28°C" colorClass="text-purple-glow" />
          <ExtraWidget icon={AlertTriangle} label="Scam Alerts" value="0 active" colorClass="text-warm-orange" />
        </div>

        {/* ─── Section Header ─── */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="text-sm font-semibold text-foreground">
            {hasNearbyFeeds ? "Neighborhood Snapshots" : "Other Posts"}
          </h2>
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-neon-green animate-pulse-soft" />
            <span className="text-[10px] font-medium text-muted-foreground">
              Live · {summary?.meshNodes ?? 0} mesh nodes
            </span>
          </div>
        </div>

        {/* ─── Fallback: No nearby feeds ─── */}
        {showFallback && (
          <div className="rounded-xl p-4 text-center bg-card border border-border">
            <Newspaper className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No feeds nearby</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Showing other posts from across the platform
            </p>
          </div>
        )}

        {/* ─── AI Suggestions (if available) ─── */}
        {suggestions.length > 0 && (
          <div className="rounded-2xl p-4 space-y-3 bg-card border border-purple-glow">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-glow" />
              <span className="text-xs font-medium text-foreground">Suggested for You</span>
              <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-purple-glow/20 text-purple-glow border-none">AI</Badge>
            </div>
            <div className="space-y-2">
              {suggestions.slice(0, 3).map((s) => {
                const meta = CATEGORY_META[s.category] || CATEGORY_META.safety;
                const Icon = meta.icon;
                return (
                  <Dialog key={s.truthId}>
                    <DialogTrigger asChild>
                      <button
                        className="w-full flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        onClick={() => recordEvent("suggestion_click", { truthId: s.truthId })}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate text-foreground">{s.content}</p>
                          <p className="text-[9px] text-muted-foreground">{s.reason}</p>
                        </div>
                        <span className="text-[9px] shrink-0 text-muted-foreground">{timeAgo(s.createdAt)}</span>
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
          <div className="rounded-2xl p-8 text-center bg-card border border-border">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No neighborhood data yet. Be the first to share a truth.</p>
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

        {/* ─── News Section ─── */}
        <div className="pt-2">
          <NewsFeed />
        </div>

        {/* ─── Questionnaire Section ─── */}
        {questionnaireData?.questions && questionnaireData.questions.length > 0 && (
          <div className="rounded-2xl p-4 space-y-3 bg-card border border-border">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Active Questionnaire</h2>
            </div>
            <div className="space-y-3">
              {questionnaireData.questions.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.08 }}
                  className="rounded-xl border border-border p-3 space-y-2"
                >
                  <p className="text-xs font-medium text-foreground">
                    {q.question}
                    {q.required && <span className="text-red-500 ml-0.5">*</span>}
                  </p>
                  <QuestionnaireItem
                    question={q}
                    onSubmit={(answer) => submitAnswerMutation.mutate({ questionId: q.id, answer })}
                    isPending={submitAnswerMutation.isPending}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Questionnaire Item (inline answer) ───

function QuestionnaireItem({
  question,
  onSubmit,
  isPending,
}: {
  question: QuestionnaireQuestion;
  onSubmit: (answer: string) => void;
  isPending: boolean;
}) {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim()) return;
    onSubmit(answer.trim());
    setAnswer("");
  };

  if (question.options && question.options.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {question.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onSubmit(opt)}
              disabled={isPending}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isPending) handleSubmit();
        }}
        placeholder="Your answer..."
        className="flex-1 h-8 rounded-md text-xs px-2 outline-none bg-background text-foreground border border-border"
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={isPending || !answer.trim()}
        className="h-8 px-3 text-xs gap-1"
      >
        <SendIcon className="h-3 w-3" />
        Submit
      </Button>
    </div>
  );
}

// ─── Summary Card ───

function SummaryCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: typeof Zap;
  label: string;
  value: number | string;
  colorClass: string;
}) {
  return (
    <div className="rounded-2xl p-4 space-y-2 bg-card border border-border">
      <Icon className={`h-4 w-4 ${colorClass}`} />
      <div>
        <p className="text-xl font-bold text-foreground">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-[10px] uppercase tracking-normal text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Extra Widget (POS, Weather, Scam) ───

function ExtraWidget({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3 bg-card border border-border">
      <div className="rounded-lg bg-muted/50 p-2">
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <div>
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground">{value}</p>
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
    <div ref={ref} className="rounded-2xl p-5 space-y-4 bg-card border border-border">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">{card.name}</h3>
          <p className="text-xs text-muted-foreground">{card.region}</p>
        </div>
        <Badge className="text-[10px] px-2.5 py-0.5 rounded-full bg-muted text-foreground border-none">
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
        <div className="rounded-xl p-3 space-y-2 bg-muted/30 border border-purple-glow prediction-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-purple-glow" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">AI Prediction</span>
              {trendIcon(card.prediction.trend)}
            </div>
            <Badge
              className="text-[9px] px-1.5 py-0 rounded-full border-none"
              style={{
                background: card.prediction.confidence >= 75 ? "hsl(142 100% 50% / 0.2)" : card.prediction.confidence >= 50 ? "hsl(25 95% 55% / 0.2)" : "hsl(0 84% 60% / 0.2)",
                color: card.prediction.confidence >= 75 ? "hsl(142 100% 50%)" : card.prediction.confidence >= 50 ? "hsl(25 95% 55%)" : "hsl(0 84% 60%)",
              }}
            >
              {card.prediction.confidence}% confidence
            </Badge>
          </div>
          <p className="text-xs text-foreground">{card.prediction.text}</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">
              {card.prediction.category} · {card.prediction.timeframe}
            </span>
            {card.prediction.modelVersion?.startsWith("kimi") && (
              <Badge className="text-[8px] px-1 py-0 rounded-full border-none bg-purple-glow/15 text-purple-glow">
                Kimi K3 AI
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* ─── Recent Reports ─── */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">Recent Reports</p>
        {card.recentReports.length === 0 ? (
          <p className="text-[10px] py-2 text-muted-foreground">No reports yet</p>
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
                        className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          apiRequest("POST", "/api/user/browsing-events", {
                            eventType: "post_detail_open",
                            truthId: report.id,
                            neighborhoodId: card.id,
                            category: report.category,
                          }).catch(() => {});
                        }}
                      >
                        <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
                        <p className="text-xs truncate flex-1 text-left text-foreground">{report.content}</p>
                        <span className="text-[10px] shrink-0 text-muted-foreground">{timeAgo(report.createdAt)}</span>
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
        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
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
  const colorClass = meta?.color || "text-muted-foreground";
  const isNumeric = typeof metric.value === "number";
  const statusStr = String(metric.value);
  const dotClass = statusDot(statusStr);

  return (
    <div className="rounded-xl p-2.5 space-y-1 overflow-hidden bg-muted/30">
      <Icon className={`h-3.5 w-3.5 ${colorClass}`} />
      <p className="text-[9px] uppercase tracking-normal whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground">
        {metric.label}
      </p>
      <div className="flex items-center gap-1">
        {!isNumeric && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
        <span className="text-[11px] font-medium text-foreground">
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
  const { toast } = useToast();
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/feeds?truth=${report.id}` : `/feeds?truth=${report.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Soke Truth Report", text: report.content.slice(0, 100), url });
      } catch { /* user cancelled */ }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied!" });
      } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
    }
    try {
      await apiRequest("POST", `/api/truths/${report.id}/share`, { channel: "link" });
    } catch { /* best-effort */ }
  };

  const handleReport = async () => {
    try {
      await apiRequest("POST", `/api/truths/${report.id}/report`, { reason: "inappropriate" });
      setReportSubmitted(true);
      toast({ title: "Report submitted. Thank you." });
    } catch {
      toast({ title: "Could not submit report. Please try again.", variant: "destructive" });
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <Icon className={`h-4 w-4 ${meta.color}`} />
          {meta.label} Report
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-foreground">{report.content}</p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{neighborhoodName}</span>
          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{timeAgo(report.createdAt)}</span>
        </div>
        {/* Trust score */}
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/30">
          <ShieldCheck className={`h-3.5 w-3.5 ${report.trustScore >= 70 ? "text-green-500" : report.trustScore >= 40 ? "text-amber-500" : "text-red-500"}`} />
          <div className="flex-1 max-w-[100px]">
            <Progress value={report.trustScore} className="h-1.5" />
          </div>
          <span className={`text-xs font-mono font-medium ${report.trustScore >= 70 ? "text-green-500" : report.trustScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
            {report.trustScore}%
          </span>
          <span className="text-[9px] uppercase text-muted-foreground">Trust</span>
        </div>
        {/* AI Verification Section */}
        <AIVerificationSection truthId={report.id} />
        <AIPredictionSection truthId={report.id} />
        {/* Actions */}
        <div className="flex items-center gap-0.5 pt-2 border-t border-border">
          <LikeButton truthId={report.id} />
          <Button size="sm" variant="ghost" onClick={() => onVerify("corroborate")} disabled={isPending} className="h-8 w-8 p-0" title="Corroborate" aria-label="Corroborate">
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onVerify("dispute")} disabled={isPending} className="h-8 w-8 p-0" title="Dispute" aria-label="Dispute">
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </Button>
          <FeedComments truthId={report.id} commentCount={0} setCommentCount={() => {}} />
          <Button size="sm" variant="ghost" onClick={handleShare} className="h-8 w-8 p-0" title="Share" aria-label="Share">
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReport} disabled={reportSubmitted} className="h-8 w-8 p-0 ml-auto" title="Report" aria-label="Report">
            <Flag className={`h-4 w-4 ${reportSubmitted ? "text-red-500" : "text-muted-foreground"}`} />
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
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-purple-glow" />
          AI Suggestion
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-foreground">{suggestion.content}</p>
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-purple-glow/10">
          <Brain className="h-3.5 w-3.5 text-purple-glow" />
          <p className="text-[10px] text-muted-foreground">{suggestion.reason}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{suggestion.neighborhoodName}</span>
          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{timeAgo(suggestion.createdAt)}</span>
        </div>
        <div className="flex items-center gap-0.5 pt-2 border-t border-border">
          <Button size="sm" variant="ghost" onClick={() => onVerify("corroborate")} className="h-8 w-8 p-0" title="Corroborate">
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onVerify("dispute")} className="h-8 w-8 p-0" title="Dispute">
            <ThumbsDown className="h-4 w-4 text-red-500" />
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
    if (v === "authentic") return "text-green-500";
    if (v === "suspicious") return "text-red-500";
    return "text-amber-500";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1">
          <Brain className="h-3.5 w-3.5 text-purple-glow" />
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
        <div className="flex items-center gap-2 text-xs py-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing...
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {result && !loading && (
        <div className="rounded-md border p-2.5 space-y-2 bg-muted/30 border-border">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium capitalize ${verdictColor(result.verdict)}`}>{result.verdict}</span>
            <span className={`text-xs font-mono font-bold ${verdictColor(result.verdict)}`}>{result.confidence}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{result.explanation}</p>
          <div className="grid grid-cols-4 gap-1 text-[9px]">
            {[
              { label: "Content", val: result.signals?.contentAnalysis?.score ?? 0 },
              { label: "Source", val: result.signals?.sourceCredibility?.score ?? 0 },
              { label: "Community", val: result.signals?.communitySignals?.score ?? 0 },
              { label: "Time", val: result.signals?.temporalPattern?.score ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded px-1 py-0.5 text-center bg-card">
                <p className="text-muted-foreground">{s.label}</p>
                <p className="font-mono font-medium text-foreground">{Math.round(s.val)}%</p>
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
    if (r === "high") return "text-red-500";
    if (r === "moderate") return "text-amber-500";
    return "text-green-500";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5 text-purple-glow" />
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
        <div className="flex items-center gap-2 text-xs py-1 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating prediction...
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      {result && !loading && (
        <div className="rounded-md border p-2.5 space-y-2 bg-muted/30 border-border">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-medium ${riskColor(result.riskLevel)}`}>
              Risk: <span className="capitalize">{result.riskLevel}</span>
            </span>
            <span className="text-xs font-mono font-bold text-purple-glow">{result.confidence}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{result.prediction}</p>
          {result.aiPowered && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-glow/15 text-purple-glow">
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

// ─── Like Button with Counter ───

function LikeButton({ truthId }: { truthId: number }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/truths/${truthId}/like`);
        if (active && res.ok) {
          const data = await res.json();
          setLiked(data.liked ?? false);
          setLikeCount(data.likeCount ?? 0);
        }
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [truthId]);

  const toggleLike = async () => {
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/like`);
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked ?? !liked);
        setLikeCount(data.likeCount ?? likeCount);
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled>
        <Heart className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={toggleLike}
      className="h-8 px-2 gap-1"
      title="Like"
      aria-label="Like"
    >
      <motion.span whileTap={{ scale: 1.3 }}>
        <Heart className={`h-4 w-4 ${liked ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
      </motion.span>
      {likeCount > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground">{likeCount}</span>
      )}
    </Button>
  );
}

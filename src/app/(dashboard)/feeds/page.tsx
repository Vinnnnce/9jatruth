"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Info, Clock, ShieldCheck, CheckCircle2,
  ThumbsUp, ThumbsDown, MapPin, Newspaper,
  Brain, Loader2, Sparkles, Zap, Fuel, Car, Tag, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { FeedFilterBar, DEFAULT_FILTERS, type FeedFilters } from "@/components/feed-filter-bar";
import { FeedInteractions } from "@/components/feed-interactions";
import { VerifiedBadge } from "@/components/verified-badge";
import { useUser } from "@/lib/use-user-safe";

type Truth = {
  id: number;
  neighborhoodId: number;
  category: string;
  content: string;
  trustScore: number;
  decayFactor: number;
  verificationChain: string;
  userHash: string;
  status: string;
  createdAt: string;
  distanceKm?: number;
  neighborhoodName?: string;
  ipRegion?: string | null;
  locationSource?: string | null;
  orgName?: string | null;
  orgVerified?: boolean;
};

type Neighborhood = { id: number; name: string; region: string };

const CATEGORY_META: Record<string, { icon: typeof Zap; color: string; dot: string; label: string }> = {
  power:    { icon: Zap,   color: "text-orange-500", dot: "bg-orange-500", label: "Power" },
  fuel:     { icon: Fuel,  color: "text-orange-500", dot: "bg-orange-500", label: "Fuel" },
  traffic:  { icon: Car,   color: "text-blue-500",   dot: "bg-blue-500",   label: "Traffic" },
  prices:   { icon: Tag,   color: "text-purple-500", dot: "bg-purple-500", label: "Prices" },
  safety:   { icon: ShieldCheck, color: "text-green-500", dot: "bg-green-500", label: "Safety" },
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

function trustColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function getCategoryStatus(truths: Truth[], category: string): { status: string; score: number; color: string } {
  const catTruths = truths.filter(t => t.category === category);
  if (catTruths.length === 0) return { status: "No data", score: 0, color: "text-muted-foreground" };

  const avgTrust = catTruths.reduce((s, t) => s + t.trustScore, 0) / catTruths.length;
  const recent = catTruths[0];
  const content = recent.content.toLowerCase();

  // Category-specific status
  if (category === "power" || category === "fuel") {
    if (/restored|available|on\b|normal|stable/.test(content)) return { status: "On", score: Math.round(avgTrust), color: "text-green-500" };
    if (/off|outage|unavailable|down|scarcity|shortage/.test(content)) return { status: "Off", score: Math.round(avgTrust), color: "text-red-500" };
    return { status: "Unstable", score: Math.round(avgTrust), color: "text-amber-500" };
  }
  if (category === "traffic") {
    if (/free|flowing|clear|smooth/.test(content)) return { status: "Clear", score: Math.round(avgTrust), color: "text-green-500" };
    if (/heavy|congest|jam|block/.test(content)) return { status: "Heavy", score: Math.round(avgTrust), color: "text-red-500" };
    return { status: "Moderate", score: Math.round(avgTrust), color: "text-blue-500" };
  }
  if (category === "prices") return { status: String(Math.round(avgTrust)), score: Math.round(avgTrust), color: "text-white" };
  if (category === "safety") return { status: String(Math.round(avgTrust)), score: Math.round(avgTrust), color: "text-white" };

  return { status: "—", score: Math.round(avgTrust), color: "text-muted-foreground" };
}

export default function Feeds() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [currentUserHash, setCurrentUserHash] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (filters.category) queryParams.set("category", filters.category);
  queryParams.set("limit", "50");

  const { data: truths, isLoading } = useQuery<Truth[]>({
    queryKey: ["/api/truths", filters.category],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/truths?${queryParams.toString()}`);
      return res.json();
    },
    enabled: isLoaded,
  });

  // Detect user location for area header
  const [userArea, setUserArea] = useState<{ city: string; region: string } | null>(null);
  useEffect(() => {
    fetch("/api/geo/nearby")
      .then(res => res.json())
      .then(data => {
        if (data.userLocation) {
          setUserArea({
            city: data.userLocation.city || "Your Area",
            region: data.userLocation.region || "",
          });
        }
      })
      .catch(() => {});
  }, []);

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

  // Derive area name from truths or user location
  const areaName = userArea?.city || truths?.[0]?.neighborhoodName || truths?.[0]?.ipRegion || "Your Area";
  const areaRegion = userArea?.region || "";
  const truthCount = truths?.length || 0;

  // Status grid data
  const categories = ["power", "fuel", "traffic", "prices", "safety"];
  const statusGrid = categories.map(cat => ({
    category: cat,
    ...getCategoryStatus(truths || [], cat),
  }));

  // Filtered truths for recent reports
  const recentTruths = truths?.slice(0, 20) || [];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      {/* ─── Main Card (matches uploaded design) ─── */}
      <div className="rounded-2xl bg-card border border-border p-5 space-y-5">
        {/* Header: Area name + truth count badge */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{areaName}</h1>
            <p className="text-sm text-muted-foreground">{areaRegion || "Nigeria"}</p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1 rounded-full">
            {truthCount} {truthCount === 1 ? "truth" : "truths"}
          </Badge>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Top row: Power, Fuel, Traffic */}
          {statusGrid.slice(0, 3).map(({ category, status, color }) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <div key={category} className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    status === "On" || status === "Clear" ? "bg-green-500" :
                    status === "Off" || status === "Heavy" ? "bg-red-500" :
                    status === "Moderate" || status === "Unstable" ? "bg-amber-500" :
                    "bg-muted-foreground"
                  }`} />
                  <span className={`text-xs font-medium ${color}`}>{status}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom row: Prices, Safety — centered, 2 cols */}
        <div className="grid grid-cols-2 gap-2.5 max-w-[66%] mx-auto">
          {statusGrid.slice(3).map(({ category, status, color }) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <div key={category} className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                <p className={`text-lg font-bold ${color}`}>{status}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Reports */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Recent Reports</p>

          {recentTruths.length === 0 ? (
            <div className="text-center py-6">
              <Newspaper className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No reports yet. Be the first to share a truth.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTruths.map((truth) => {
                const meta = CATEGORY_META[truth.category] || CATEGORY_META.safety;
                const Icon = meta.icon;
                return (
                  <div key={truth.id} className="group">
                    {/* Report row — matches uploaded design */}
                    <div className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-muted/30 transition-colors">
                      <Icon className={`h-3.5 w-3.5 ${meta.color} shrink-0`} />
                      <p className="text-xs text-foreground truncate flex-1">{truth.content}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(truth.createdAt)}</span>
                    </div>

                    {/* Expanded details on hover/click — Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="w-full text-left opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary pl-6 pb-1">
                          View details →
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-sm">
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            {meta.label} Report
                            {truth.orgVerified && <VerifiedBadge showLabel label={truth.orgName || "Verified"} />}
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3">
                          {/* Full content */}
                          <p className="text-sm text-foreground">{truth.content}</p>

                          {/* Meta */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" />
                              {truth.neighborhoodName || truth.ipRegion || "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {timeAgo(truth.createdAt)}
                            </span>
                          </div>

                          {/* Trust score card */}
                          <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5">
                            <ShieldCheck className={`h-3.5 w-3.5 ${trustColor(truth.trustScore)}`} />
                            <div className="flex-1 max-w-[100px]">
                              <Progress value={truth.trustScore} className="h-1.5" />
                            </div>
                            <span className={`text-xs font-mono font-medium ${trustColor(truth.trustScore)}`}>
                              {truth.trustScore}%
                            </span>
                            <span className="text-[9px] text-muted-foreground uppercase">Trust</span>
                          </div>

                          {/* AI Verification Section */}
                          <AIVerificationSection truthId={truth.id} />

                          {/* Actions — icon-only */}
                          <div className="flex items-center gap-0.5 pt-2 border-t">
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => verifyMutation.mutate({ truthId: truth.id, action: "corroborate" })}
                              disabled={verifyMutation.isPending}
                              className="h-8 w-8 p-0"
                              title="Corroborate" aria-label="Corroborate"
                            >
                              <ThumbsUp className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => verifyMutation.mutate({ truthId: truth.id, action: "dispute" })}
                              disabled={verifyMutation.isPending}
                              className="h-8 w-8 p-0"
                              title="Dispute" aria-label="Dispute"
                            >
                              <ThumbsDown className="h-4 w-4 text-red-500" />
                            </Button>
                            <FeedInteractions truth={truth} currentUserHash={currentUserHash} />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Updated timestamp */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
          <Clock className="h-2.5 w-2.5" />
          Updated {truths && truths.length > 0 ? timeAgo(truths[0].createdAt) : "just now"}
        </div>
      </div>

      {/* Filter bar */}
      <FeedFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={truthCount}
      />
    </div>
  );
}

// ─── AI Verification Section (inline on each post) ───

function AIVerificationSection({ truthId }: { truthId: number }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/truths/${truthId}/verify-ai`, { method: "POST" });
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

  const verdictBg = (v: string) => {
    if (v === "authentic") return "bg-green-500/10 border-green-500/20";
    if (v === "suspicious") return "bg-red-500/10 border-red-500/20";
    return "bg-amber-500/10 border-amber-500/20";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1">
          <Brain className="h-3.5 w-3.5 text-primary" />
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analyzing...
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {result && !loading && (
        <div className={`rounded-md border p-2.5 space-y-2 ${verdictBg(result.verdict)}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium capitalize ${verdictColor(result.verdict)}`}>
              {result.verdict}
            </span>
            <span className={`text-xs font-mono font-bold ${verdictColor(result.verdict)}`}>
              {result.confidence}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{result.explanation}</p>

          {/* Signal bars */}
          <div className="grid grid-cols-4 gap-1 text-[9px]">
            {[
              { label: "Content", val: result.signals.contentAnalysis.score },
              { label: "Source", val: result.signals.sourceCredibility.score },
              { label: "Community", val: result.signals.communitySignals.score },
              { label: "Time", val: result.signals.temporalPattern.score },
            ].map((s) => (
              <div key={s.label} className="rounded bg-background/50 px-1 py-0.5 text-center">
                <p className="text-muted-foreground">{s.label}</p>
                <p className="font-mono font-medium">{Math.round(s.val)}%</p>
              </div>
            ))}
          </div>

          {result.signals.contentAnalysis.redFlags?.length > 0 && (
            <p className="text-[9px] text-red-500">
              Flags: {result.signals.contentAnalysis.redFlags.join(", ")}
            </p>
          )}

          <Button size="sm" variant="ghost" onClick={handleVerify} className="h-5 text-[9px] gap-1">
            <Sparkles className="h-2 w-2" />
            Re-check
          </Button>
        </div>
      )}
    </div>
  );
}

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Zap, Fuel, Car, Tag, Shield, ChevronRight, Clock, ShieldCheck, CheckCircle2,
  ThumbsUp, ThumbsDown, MapPin, Newspaper,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { FeedFilterBar, DEFAULT_FILTERS, type FeedFilters } from "@/components/feed-filter-bar";

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
};

type Neighborhood = { id: number; name: string; region: string };

const categoryConfig: Record<string, { icon: typeof Zap; color: string; label: string; bg: string }> = {
  power: { icon: Zap, color: "text-amber-500", label: "Power", bg: "bg-amber-500/10" },
  fuel: { icon: Fuel, color: "text-orange-500", label: "Fuel", bg: "bg-orange-500/10" },
  traffic: { icon: Car, color: "text-blue-500", label: "Traffic", bg: "bg-blue-500/10" },
  prices: { icon: Tag, color: "text-purple-500", label: "Prices", bg: "bg-purple-500/10" },
  safety: { icon: Shield, color: "text-green-500", label: "Safety", bg: "bg-green-500/10" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function trustColor(score: number): string {
  if (score >= 85) return "text-green-500";
  if (score >= 65) return "text-blue-500";
  if (score >= 45) return "text-amber-500";
  return "text-red-500";
}

function trustBg(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 65) return "bg-blue-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-red-500";
}

export default function FeedsPage() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all truths (feeds)
  const { data: truths, isLoading } = useQuery<Truth[]>({
    queryKey: ["/api/truths", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      const res = await apiRequest("GET", `/api/truths?${params.toString()}`);
      return res.json();
    },
  });

  // Verify truth mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ truthId, action }: { truthId: number; action: string }) => {
      return apiRequest("POST", `/api/truths/${truthId}/verify`, { action });
    },
    onSuccess: () => {
      toast({ title: "Verification submitted", description: "Thank you for contributing to truth verification." });
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-feeds-title">
            <Newspaper className="h-5 w-5 text-primary" />
            Feeds
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All posts and reports across the platform
          </p>
        </div>
        {truths && truths.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {truths.length} posts
          </Badge>
        )}
      </div>

      {/* Filter bar */}
      <FeedFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={truths?.length || 0}
      />

      {/* Feeds list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !truths || truths.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">No posts yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Be the first to report truth in your area
            </p>
            <Button asChild className="mt-4">
              <a href="/submit">Submit a Report</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {truths.map((truth) => {
            const cat = categoryConfig[truth.category] || categoryConfig.safety;
            const Icon = cat.icon;
            return (
              <Card key={truth.id} data-testid={`card-feed-${truth.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${cat.bg} shrink-0`}>
                      <Icon className={`h-5 w-5 ${cat.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{cat.label}</Badge>
                          {truth.status === "verified" && (
                            <Badge className="text-[10px] bg-green-500/10 text-green-500 border-green-500/20">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {truth.status === "rejected" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Rejected
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {timeAgo(truth.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm">{truth.content}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {truth.neighborhoodName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {truth.neighborhoodName}
                          </span>
                        )}
                        {truth.distanceKm != null && (
                          <span>{truth.distanceKm}km away</span>
                        )}
                        {truth.ipRegion && (
                          <span>IP: {truth.ipRegion}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(truth.createdAt)}
                        </span>
                      </div>

                      {/* Trust score */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[120px]">
                          <Progress
                            value={truth.trustScore}
                            className="h-1.5"
                          />
                        </div>
                        <span className={`text-xs font-mono ${trustColor(truth.trustScore)}`}>
                          {truth.trustScore}% trust
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verifyMutation.mutate({ truthId: truth.id, action: "corroborate" })}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-corroborate-${truth.id}`}
                          className="h-7 text-xs"
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Corroborate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verifyMutation.mutate({ truthId: truth.id, action: "dispute" })}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-dispute-${truth.id}`}
                          className="h-7 text-xs"
                        >
                          <ThumbsDown className="h-3 w-3 mr-1" />
                          Dispute
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs ml-auto"
                              data-testid={`button-details-${truth.id}`}
                            >
                              Details
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Truth Report #{truth.id}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3">
                              <div>
                                <p className="text-sm">{truth.content}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Category:</span> {cat.label}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Status:</span> {truth.status}
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Trust Score:</span>{" "}
                                  <span className={trustColor(truth.trustScore)}>{truth.trustScore}%</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Submitted:</span> {timeAgo(truth.createdAt)}
                                </div>
                                {truth.ipRegion && (
                                  <div>
                                    <span className="text-muted-foreground">IP Region:</span> {truth.ipRegion}
                                  </div>
                                )}
                                {truth.locationSource && (
                                  <div>
                                    <span className="text-muted-foreground">Location:</span> {truth.locationSource}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium mb-1">Verification Chain</p>
                                <div className="space-y-1">
                                  {(() => {
                                    try {
                                      const chain = JSON.parse(truth.verificationChain);
                                      return chain.map((step: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                                          <span>{step.step}: {step.result}</span>
                                        </div>
                                      ));
                                    } catch {
                                      return <p className="text-xs text-muted-foreground">No verification data</p>;
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

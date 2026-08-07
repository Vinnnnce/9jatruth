"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search as SearchIcon,
  Zap, Fuel, Car, Tag, Shield,
  MapPin, TrendingUp, FileText, AlertCircle, Clock,
} from "lucide-react";
import Link from "next/link";

type SearchResult = {
  type: "truth" | "neighborhood" | "prediction" | "alert";
  id: number | string;
  title: string;
  description: string;
  category?: string;
  region?: string;
  trustScore?: number;
  createdAt?: string;
};

const categoryConfig: Record<string, { icon: typeof Zap; color: string }> = {
  power: { icon: Zap, color: "text-amber-500" },
  fuel: { icon: Fuel, color: "text-orange-500" },
  traffic: { icon: Car, color: "text-blue-500" },
  prices: { icon: Tag, color: "text-purple-500" },
  safety: { icon: Shield, color: "text-green-500" },
};

const typeConfig: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  truth: { icon: FileText, color: "text-blue-500", label: "Truth" },
  neighborhood: { icon: MapPin, color: "text-green-500", label: "Neighborhood" },
  prediction: { icon: TrendingUp, color: "text-purple-500", label: "Prediction" },
  alert: { icon: AlertCircle, color: "text-red-500", label: "Alert" },
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

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");

  const { data: results, isLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", searchQuery, category, region],
    queryFn: async ({ queryKey }) => {
      const [, q, cat, reg] = queryKey as [string, string, string, string];
      if (!q) return [];
      let url = `/api/search?q=${encodeURIComponent(q)}`;
      if (cat) url += `&category=${cat}`;
      if (reg) url += `&region=${reg}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: searchQuery.length > 0,
  });

  const handleSearch = () => {
    setSearchQuery(query);
  };

  const truthCount = results?.filter(r => r.type === "truth").length ?? 0;
  const neighborhoodCount = results?.filter(r => r.type === "neighborhood").length ?? 0;
  const predictionCount = results?.filter(r => r.type === "prediction").length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <SearchIcon className="h-5 w-5 text-primary" />
          Global Search
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Search across truths, neighborhoods, predictions, and alerts
        </p>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search for power, fuel, traffic, Lekki, Abuja..."
                className="pl-9"
                data-testid="search-input"
              />
            </div>
            <Button onClick={handleSearch} data-testid="search-button">
              Search
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={category} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px]" data-testid="search-category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="power">Power</SelectItem>
                <SelectItem value="fuel">Fuel</SelectItem>
                <SelectItem value="traffic">Traffic</SelectItem>
                <SelectItem value="prices">Prices</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
              </SelectContent>
            </Select>
            <Select value={region} onValueChange={(v) => setRegion(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px]" data-testid="search-region">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                <SelectItem value="Lagos">Lagos</SelectItem>
                <SelectItem value="Abuja">Abuja</SelectItem>
                <SelectItem value="Enugu">Enugu</SelectItem>
                <SelectItem value="Port Harcourt">Port Harcourt</SelectItem>
                <SelectItem value="Ibadan">Ibadan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {searchQuery && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-display font-700 tabular-nums text-blue-500">{truthCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Truths</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-display font-700 tabular-nums text-green-500">{neighborhoodCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Neighborhoods</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-display font-700 tabular-nums text-purple-500">{predictionCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Predictions</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)
            ) : results && results.length > 0 ? (
              results.map((result) => {
                const tConfig = typeConfig[result.type];
                const TIcon = tConfig.icon;
                const catConfig = result.category ? categoryConfig[result.category] : null;
                const CatIcon = catConfig?.icon;
                return (
                  <Card key={`${result.type}-${result.id}`} className="border-border hover:border-primary/20 transition-colors animate-fade-in">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 shrink-0">
                          <TIcon className={`h-4 w-4 ${tConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[9px]">{tConfig.label}</Badge>
                            {CatIcon && result.category && (
                              <Badge variant="outline" className="text-[9px] capitalize gap-0.5">
                                <CatIcon className={`h-2.5 w-2.5 ${catConfig!.color}`} />
                                {result.category}
                              </Badge>
                            )}
                            {result.region && (
                              <span className="text-[10px] text-muted-foreground">{result.region}</span>
                            )}
                            {result.trustScore !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-mono">{result.trustScore} trust</span>
                            )}
                            {result.createdAt && (
                              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{timeAgo(result.createdAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed">{result.title}</p>
                          <p className="text-[11px] text-muted-foreground">{result.description}</p>
                          {result.type === "neighborhood" && (
                            <Link href="/map">
                              <span className="text-[10px] text-primary hover:underline cursor-pointer">
                                View on map
                              </span>
                            </Link>
                          )}
                          {result.type === "truth" && (
                            <Link href="/feeds">
                              <span className="text-[10px] text-primary hover:underline cursor-pointer">
                                View in feed
                              </span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <SearchIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                  <p className="text-xs mt-1">Try different keywords or remove filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {!searchQuery && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <SearchIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start searching to find truths, neighborhoods, predictions, and alerts</p>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {["power outage", "fuel", "Lekki", "traffic", "Abuja", "safety"].map((term) => (
                <button
                  key={term}
                  onClick={() => { setQuery(term); setSearchQuery(term); }}
                  className="text-[11px] px-3 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

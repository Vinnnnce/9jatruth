"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { VoiceSelector } from "@/components/voice-selector";
import { useVoiceSelection } from "@/components/hooks/use-voice-selection";
import {
  Newspaper, Search, Volume2, VolumeX, Loader2, ExternalLink, Clock, Tag,
  Sparkles, TrendingUp, TrendingDown, Minus, MapPin, ChevronRight, Globe,
} from "lucide-react";
import Link from "next/link";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "general", label: "General" },
  { value: "business", label: "Business" },
  { value: "technology", label: "Technology" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "health", label: "Health" },
  { value: "science", label: "Science" },
];

interface AiAnalysis {
  summary: string;
  tags: string[];
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  takeaways: string[];
  regionTags: string[];
  keyEntities: string[];
  credibilityScore: number;
  source: string;
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10", label: "Positive" },
  negative: { icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10", label: "Negative" },
  neutral: { icon: Minus, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Neutral" },
};

function fmtPublished(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Yesterday";
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function ExternalNewsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [analyzing, setAnalyzing] = useState<Set<number>>(new Set());
  const [analyses, setAnalyses] = useState<Record<number, AiAnalysis>>({});
  const [playingId, setPlayingId] = useState<number | null>(null);

  const { speak, stop, speaking, supported } = useVoiceSelection();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/news/external", category, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "30" });
      if (category) params.set("category", category);
      if (search) params.set("search", search);
      return apiRequest("GET", `/api/news/external?${params.toString()}`).then((r) => r.json());
    },
  });

  const articles = data?.articles || [];
  const newsApiKeyConfigured = Boolean(data?.newsApiKeyConfigured);

  const [refreshing, setRefreshing] = useState(false);
  const refreshNews = async () => {
    setRefreshing(true);
    try {
      let res = await apiRequest("POST", "/api/admin/news/refresh").catch(() => null);
      if (!res || !res.ok) {
        res = await apiRequest("GET", "/api/news/cron").catch(() => null);
      }
      const result = res ? await res.json().catch(() => ({})) : {};
      qc.invalidateQueries({ queryKey: ["/api/news/external"] });
      toast({
        title: "News refreshed",
        description: `Fetched ${result.fetched ?? 0} articles, stored ${result.stored ?? 0}.${result.notConfigured ? " (NewsAPI key not set — used RSS fallback)" : ""}`,
      });
    } catch {
      toast({ title: "Refresh failed", description: "Try again later.", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const analyzeArticle = useCallback(async (articleId: number) => {
    setAnalyzing((prev) => new Set(prev).add(articleId));
    try {
      const res = await fetch(`/api/news/external/${articleId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.analysis) {
        setAnalyses((prev) => ({ ...prev, [articleId]: data.analysis }));
        toast({ title: "AI Analysis complete", description: `Analyzed via ${data.analysis.source}` });
      }
    } catch (err) {
      toast({ title: "Analysis failed", description: "Could not analyze article", variant: "destructive" });
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  }, [toast]);

  const handleListen = useCallback((article: any) => {
    if (!supported) {
      toast({ title: "Not supported", description: "Text-to-speech is not available on this browser", variant: "destructive" });
      return;
    }
    if (playingId === article.id && speaking) {
      stop();
      setPlayingId(null);
      return;
    }
    const analysis = analyses[article.id];
    const text = analysis?.summary || `${article.title}. ${article.description || ""}`.slice(0, 3000);
    speak(text, () => setPlayingId(null));
    setPlayingId(article.id);
  }, [playingId, speaking, analyses, speak, stop, supported, toast]);

  const stopListening = useCallback(() => {
    stop();
    setPlayingId(null);
  }, [stop]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            External News
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered Nigerian news from external sources
          </p>
        </div>
        <Badge variant="secondary">{articles.length} articles</Badge>
      </div>

      {/* Voice Settings Panel */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Audio Read Settings</span>
          </div>
          <VoiceSelector />
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search external news..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={refreshNews} disabled={refreshing} className="gap-1.5 shrink-0">
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Newspaper className="h-3.5 w-3.5" />}
          {refreshing ? "Fetching…" : "Refresh news"}
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={category === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat.value)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Top Headlines Section */}
      {articles.length > 0 && !search && !category && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Top Headlines
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.slice(0, 3).map((article: any) => (
              <ArticleCard
                key={article.id}
                article={article}
                featured
                analysis={analyses[article.id]}
                analyzing={analyzing.has(article.id)}
                onAnalyze={analyzeArticle}
                onListen={handleListen}
                onStop={stopListening}
                isPlaying={playingId === article.id && speaking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Latest News */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Latest News
        </h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Newspaper className="h-8 w-8 mx-auto mb-3 text-muted-foreground/60" />
              {newsApiKeyConfigured ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    No external news articles found{search || category ? " for this filter" : " yet"}.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    News is fetched automatically every night. New articles will appear here shortly.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    No news fetched yet
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2 max-w-md mx-auto">
                    The <code className="font-mono">NEWS_API_KEY</code> environment variable is not
                    set. News will still be fetched from free RSS feeds (Punch, Vanguard, Guardian,
                    etc.) as a fallback. Click <strong>Refresh news</strong> above to fetch now,
                    or wait for the nightly auto-refresh.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(search || category ? articles : articles.slice(3)).map((article: any) => (
              <ArticleCard
                key={article.id}
                article={article}
                analysis={analyses[article.id]}
                analyzing={analyzing.has(article.id)}
                onAnalyze={analyzeArticle}
                onListen={handleListen}
                onStop={stopListening}
                isPlaying={playingId === article.id && speaking}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  featured,
  analysis,
  analyzing,
  onAnalyze,
  onListen,
  onStop,
  isPlaying,
}: {
  article: any;
  featured?: boolean;
  analysis?: AiAnalysis;
  analyzing: boolean;
  onAnalyze: (id: number) => void;
  onListen: (article: any) => void;
  onStop: () => void;
  isPlaying: boolean;
}) {
  const sentiment = analysis ? sentimentConfig[analysis.sentiment] : null;
  const SentimentIcon = sentiment?.icon;

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow flex flex-col ${featured ? "ring-2 ring-primary/20" : ""}`}>
      {article.image_url && (
        <div className="aspect-video bg-muted">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {article.category}
          </Badge>
          {article.source_name && (
            <span className="text-xs text-muted-foreground">{article.source_name}</span>
          )}
          {analysis?.credibilityScore && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {analysis.credibilityScore}% credible
            </span>
          )}
        </div>
        <CardTitle className={`line-clamp-2 ${featured ? "text-lg" : "text-base"}`}>
          <Link href={`/news/external/${article.id}`} className="hover:text-primary">
            {article.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        {/* AI Summary */}
        {analysis?.summary ? (
          <div className="rounded-md bg-primary/5 border border-primary/10 p-2 mb-2">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[9px] font-medium text-primary">AI Summary</span>
              <span className="text-[8px] text-muted-foreground ml-auto">via {analysis.source}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {analysis.summary}
            </p>
          </div>
        ) : (
          article.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
              {article.description}
            </p>
          )
        )}

        {/* Sentiment & Tags */}
        {sentiment && SentimentIcon && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${sentiment.bg} ${sentiment.color} flex items-center gap-0.5 font-medium`}>
              <SentimentIcon className="h-2.5 w-2.5" />
              {sentiment.label}
            </span>
            {analysis?.tags?.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-[8px] py-0 h-3.5 px-1.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Region tags */}
        {analysis?.regionTags && analysis.regionTags.length > 0 && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
            {analysis.regionTags.slice(0, 4).map((region, i) => (
              <span key={i} className="text-[9px] text-muted-foreground">
                {region}{i < Math.min(analysis.regionTags.length, 4) - 1 ? "," : ""}
              </span>
            ))}
          </div>
        )}

        {/* AI Takeaways */}
        {analysis?.takeaways && analysis.takeaways.length > 0 && (
          <details className="text-xs mb-2">
            <summary className="cursor-pointer text-primary hover:text-primary/80 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Key Takeaways
            </summary>
            <ul className="mt-1 ml-4 space-y-0.5">
              {analysis.takeaways.map((t, i) => (
                <li key={i} className="text-muted-foreground list-disc">{t}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-2">
          {article.published_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtPublished(article.published_at)}
            </span>
          )}
          <div className="flex gap-1">
            {isPlaying ? (
              <Button size="sm" variant="destructive" onClick={onStop}>
                <VolumeX className="h-3 w-3 mr-1" />
                Stop
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onListen(article)}>
                <Volume2 className="h-3 w-3 mr-1" />
                Listen
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAnalyze(article.id)}
              disabled={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {analysis ? "Re-analyze" : "AI"}
            </Button>
            {article.url && (
              <Button size="sm" variant="ghost" asChild>
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

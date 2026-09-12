"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceSelector } from "@/components/voice-selector";
import { useVoiceSelection } from "@/components/hooks/use-voice-selection";
import {
  ExternalLink, Clock, Loader2, Sparkles, TrendingUp, TrendingDown, Minus,
  Volume2, Square, Play, Pause, MapPin, Tag, AlertCircle, ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ExternalArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  source_name: string | null;
  published_at: string | null;
  category: string;
  is_audio_generated: boolean;
  audio_url: string | null;
}

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
  return date.toLocaleDateString();
}

export function ExternalNewsSection() {
  const [activeArticleId, setActiveArticleId] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState<Set<number>>(new Set());
  const [analyses, setAnalyses] = useState<Record<number, AiAnalysis>>({});
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const { speak, stop, speaking, voices, selectedVoiceURI, selectVoice } = useVoiceSelection();

  const { data: articles, isLoading } = useQuery({
    queryKey: ["/api/news/external", "limit-6"],
    queryFn: async () => {
      const res = await fetch("/api/news/external?limit=6");
      if (!res.ok) throw new Error("Failed to load news");
      const data = await res.json();
      return data.articles || data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const analyzeArticle = useCallback(async (articleId: number) => {
    setAnalyzing((prev) => new Set(prev).add(articleId));
    try {
      const res = await fetch(`/api/news/external/${articleId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.analysis) {
        setAnalyses((prev) => ({ ...prev, [articleId]: data.analysis }));
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  }, []);

  const handleSpeak = useCallback((article: ExternalArticle) => {
    if (speakingId === article.id && speaking) {
      stop();
      setSpeakingId(null);
      return;
    }
    const analysis = analyses[article.id];
    const textToSpeak = analysis?.summary || article.description || article.title;
    speak(textToSpeak, () => setSpeakingId(null));
    setSpeakingId(article.id);
  }, [speakingId, speaking, analyses, speak, stop]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No external news articles available at the moment.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Voice selector for audio read */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <VoiceSelector />
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {articles.map((article: ExternalArticle) => {
          const analysis = analyses[article.id];
          const isAnalyzing = analyzing.has(article.id);
          const isSpeaking = speakingId === article.id && speaking;
          const sentiment = analysis ? sentimentConfig[analysis.sentiment] : null;
          const SentimentIcon = sentiment?.icon;

          return (
            <Card key={article.id} className="overflow-hidden border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  {article.image_url && (
                    <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-muted">
                      <img
                        src={article.image_url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {article.source_name && (
                        <Badge variant="secondary" className="text-[9px] py-0 h-4">
                          {article.source_name}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {fmtPublished(article.published_at)}
                      </span>
                      {sentiment && SentimentIcon && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${sentiment.bg} ${sentiment.color} flex items-center gap-0.5 font-medium`}>
                          <SentimentIcon className="h-2.5 w-2.5" />
                          {sentiment.label}
                        </span>
                      )}
                      {analysis?.credibilityScore && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {analysis.credibilityScore}% credible
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-medium leading-snug line-clamp-2">
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {article.title}
                      </a>
                    </h3>

                    {/* AI Summary */}
                    {analysis?.summary && (
                      <div className="rounded-md bg-primary/5 border border-primary/10 p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span className="text-[9px] font-medium text-primary">AI Summary</span>
                          <span className="text-[8px] text-muted-foreground ml-auto">
                            via {analysis.source}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {analysis.summary}
                        </p>
                      </div>
                    )}

                    {/* AI Tags */}
                    {analysis?.tags && analysis.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Tag className="h-2.5 w-2.5 text-muted-foreground" />
                        {analysis.tags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-[8px] py-0 h-3.5 px-1.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Region tags */}
                    {analysis?.regionTags && analysis.regionTags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                        {analysis.regionTags.map((region, i) => (
                          <span key={i} className="text-[9px] text-muted-foreground">
                            {region}{i < analysis.regionTags.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AI Takeaways */}
                    {analysis?.takeaways && analysis.takeaways.length > 0 && (
                      <details className="text-xs">
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

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSpeak(article)}
                        className="h-7 text-xs gap-1"
                      >
                        {isSpeaking ? (
                          <><Square className="h-3 w-3" /> Stop</>
                        ) : (
                          <><Volume2 className="h-3 w-3" /> Listen</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => analyzeArticle(article.id)}
                        disabled={isAnalyzing}
                        className="h-7 text-xs gap-1"
                      >
                        {isAnalyzing ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing...</>
                        ) : analysis ? (
                          <><Sparkles className="h-3 w-3" /> Re-analyze</>
                        ) : (
                          <><Sparkles className="h-3 w-3" /> AI Analyze</>
                        )}
                      </Button>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
                      >
                        Read full <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Link to full external news page */}
      <div className="text-center pt-2">
        <a href="/news/external" className="text-xs text-primary hover:text-primary/80">
          View all external news →
        </a>
      </div>
    </div>
  );
}

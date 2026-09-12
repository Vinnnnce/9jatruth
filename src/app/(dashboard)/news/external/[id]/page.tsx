"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { VoiceSelector } from "@/components/voice-selector";
import { useVoiceSelection } from "@/components/hooks/use-voice-selection";
import {
  Volume2, VolumeX, Loader2, ExternalLink, Clock, ArrowLeft, Tag,
  Sparkles, TrendingUp, TrendingDown, Minus, MapPin, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";

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

export default function ExternalNewsArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);

  const { speak, stop, speaking, supported } = useVoiceSelection();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/news/external", id],
    queryFn: () => apiRequest("GET", `/api/news/external/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const article = data?.article;

  // Auto-analyze on load if not already analyzed
  const analyzeArticle = useCallback(async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/news/external/${id}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.analysis) {
        setAnalysis(data.analysis);
        toast({ title: "AI Analysis complete", description: `Analyzed via ${data.analysis.source}` });
      }
    } catch {
      toast({ title: "Analysis failed", description: "Could not analyze article", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [id, toast]);

  // Auto-load existing analysis from the article if present
  useEffect(() => {
    if (article?.ai_summary) {
      setAnalysis({
        summary: article.ai_summary,
        tags: safeParse(article.ai_tags, []),
        sentiment: article.ai_sentiment || "neutral",
        sentimentScore: 0,
        takeaways: safeParse(article.ai_takeaways, []),
        regionTags: safeParse(article.ai_region_tags, []),
        keyEntities: safeParse(article.ai_key_entities, []),
        credibilityScore: article.ai_credibility_score || 50,
        source: article.ai_source || "cached",
      });
    }
  }, [article]);

  const handleListen = useCallback(() => {
    if (!article) return;
    if (speaking) {
      stop();
      return;
    }
    const text = analysis?.summary || `${article.title}. ${article.description || ""} ${article.content || ""}`.slice(0, 3000);
    speak(text);
  }, [article, analysis, speaking, speak, stop]);

  const stopAudio = useCallback(() => {
    stop();
  }, [stop]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <p className="text-muted-foreground">Article not found.</p>
        <Button asChild className="mt-4">
          <Link href="/news/external">Back to News</Link>
        </Button>
      </div>
    );
  }

  const sentiment = analysis ? sentimentConfig[analysis.sentiment] : null;
  const SentimentIcon = sentiment?.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/news/external">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to News
        </Link>
      </Button>

      <article className="space-y-4">
        {/* Metadata */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">
            <Tag className="h-3 w-3 mr-1" />
            {article.category}
          </Badge>
          {article.source_name && (
            <Badge variant="secondary">{article.source_name}</Badge>
          )}
          {article.published_at && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(article.published_at).toLocaleString("en-NG")}
            </span>
          )}
          {analysis?.credibilityScore && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {analysis.credibilityScore}% credible
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>

        {article.description && (
          <p className="text-lg text-muted-foreground">{article.description}</p>
        )}

        {/* Image */}
        {article.image_url && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full h-auto"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          </div>
        )}

        {/* AI Analysis Panel */}
        {analysis ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI-Powered Analysis</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  via {analysis.source}
                </span>
              </div>

              {/* Summary */}
              {analysis.summary && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm leading-relaxed">{analysis.summary}</p>
                </div>
              )}

              {/* Sentiment */}
              {sentiment && SentimentIcon && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Sentiment:</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sentiment.bg} ${sentiment.color} flex items-center gap-1 font-medium`}>
                    <SentimentIcon className="h-3 w-3" />
                    {sentiment.label}
                  </span>
                </div>
              )}

              {/* Tags */}
              {analysis.tags?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">Tags:</span>
                  {analysis.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Region Tags */}
              {analysis.regionTags?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {analysis.regionTags.map((region, i) => (
                    <span key={i} className="text-xs text-muted-foreground">
                      {region}{i < analysis.regionTags.length - 1 ? "," : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* Key Entities */}
              {analysis.keyEntities?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">Key entities:</span>
                  {analysis.keyEntities.map((entity, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {entity}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Takeaways */}
              {analysis.takeaways?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Key Takeaways</p>
                  <ul className="space-y-1">
                    {analysis.takeaways.map((t, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                        <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Re-analyze button */}
              <Button
                size="sm"
                variant="outline"
                onClick={analyzeArticle}
                disabled={analyzing}
                className="gap-1.5"
              >
                {analyzing ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Re-analyzing...</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Re-analyze</>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  {analyzing ? "Analyzing article with AI..." : "AI analysis available"}
                </span>
              </div>
              <Button
                size="sm"
                onClick={analyzeArticle}
                disabled={analyzing}
                className="gap-1.5"
              >
                {analyzing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {analyzing ? "Analyzing..." : "Analyze with AI"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Voice Settings + Audio Player */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Audio Read Settings</span>
            </div>
            <VoiceSelector />
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              {speaking ? (
                <Button variant="destructive" size="sm" onClick={stopAudio} className="gap-1.5">
                  <VolumeX className="h-4 w-4" />
                  Stop Audio
                </Button>
              ) : (
                <Button size="sm" onClick={handleListen} disabled={analyzing} className="gap-1.5">
                  <Volume2 className="h-4 w-4" />
                  Listen as Audio
                </Button>
              )}
              {article.url && (
                <Button variant="outline" size="sm" asChild className="gap-1.5 ml-auto">
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Source
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {article.author && (
          <p className="text-sm text-muted-foreground">By {article.author}</p>
        )}

        {article.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-line">{article.content}</p>
          </div>
        )}

        {article.url && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground mb-2">
                This article was aggregated from an external source.
              </p>
              <Button asChild>
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read Full Article at {article.source_name || "Source"}
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </article>
    </div>
  );
}

function safeParse(raw: any, fallback: any): any {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

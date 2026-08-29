"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Newspaper, Search, Volume2, Loader2, ExternalLink, Clock, Tag } from "lucide-react";
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

export default function ExternalNewsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);

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

  const generateAudio = async (articleId: number) => {
    setAudioLoading(articleId);
    try {
      const res = await apiRequest("POST", `/api/news/external/${articleId}/audio`);
      const result = await res.json();
      if (result.audio_url) {
        // Decode the data URL and use SpeechSynthesis
        const article = articles.find((a: any) => a.id === articleId);
        if (result.audio_url.startsWith("data:text/plain;base64,")) {
          // Decode the base64 text from the data URL
          const base64Text = result.audio_url.split(",")[1];
          const text = atob(base64Text);
          if ("speechSynthesis" in window) {
            speakText(text);
          }
        } else if (article && "speechSynthesis" in window) {
          // Fallback: speak the article content directly
          const text = `${article.title}. ${article.description || ""} ${article.content || ""}`.slice(0, 3000);
          speakText(text);
        }
        qc.invalidateQueries({ queryKey: ["/api/news/external"] });
        toast({ title: "Audio ready", description: "Listen to the article now" });
      }
    } catch {
      // Fallback to browser TTS
      const article = articles.find((a: any) => a.id === articleId);
      if (article && "speechSynthesis" in window) {
        const text = `${article.title}. ${article.description || ""} ${article.content || ""}`.slice(0, 3000);
        speakText(text);
        toast({ title: "Playing audio", description: "Using browser text-to-speech" });
      } else {
        toast({ title: "Audio not available", description: "Try again later", variant: "destructive" });
      }
    } finally {
      setAudioLoading(null);
    }
  };

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    setPlayingAudio(null); // will be set after we find the article
    const article = articles.find((a: any) => a.title && text.startsWith(a.title));
    if (article) setPlayingAudio(article.id);
    utterance.onend = () => setPlayingAudio(null);
    utterance.onerror = () => setPlayingAudio(null);
    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudio(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="h-6 w-6" />
            External News
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nigerian news aggregated from external sources
          </p>
        </div>
        <Badge variant="secondary">{articles.length} articles</Badge>
      </div>

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
                onListen={generateAudio}
                onStop={stopAudio}
                audioLoading={audioLoading}
                playingAudio={playingAudio}
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
            <CardContent className="py-12 text-center text-muted-foreground">
              No external news articles found. New articles will appear here automatically.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(search || category ? articles : articles.slice(3)).map((article: any) => (
              <ArticleCard
                key={article.id}
                article={article}
                onListen={generateAudio}
                onStop={stopAudio}
                audioLoading={audioLoading}
                playingAudio={playingAudio}
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
  onListen,
  onStop,
  audioLoading,
  playingAudio,
}: {
  article: any;
  featured?: boolean;
  onListen: (id: number) => void;
  onStop: () => void;
  audioLoading: number | null;
  playingAudio: number | null;
}) {
  const isPlaying = playingAudio === article.id;
  const isLoading = audioLoading === article.id;

  return (
    <Card className={`overflow-hidden hover:shadow-lg transition-shadow ${featured ? "ring-2 ring-primary/20" : ""}`}>
      {article.image_url && (
        <div className="aspect-video bg-muted">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            <Tag className="h-3 w-3 mr-1" />
            {article.category}
          </Badge>
          {article.source_name && (
            <span className="text-xs text-muted-foreground">{article.source_name}</span>
          )}
        </div>
        <CardTitle className={`line-clamp-2 ${featured ? "text-lg" : "text-base"}`}>
          <Link href={`/news/external/${article.id}`} className="hover:text-primary">
            {article.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {article.description && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {article.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {article.published_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(article.published_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          <div className="flex gap-1">
            {isPlaying ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={onStop}
              >
                <Volume2 className="h-3 w-3 mr-1" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={() => onListen(article.id)}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Volume2 className="h-3 w-3 mr-1" />
                )}
                Listen
              </Button>
            )}
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

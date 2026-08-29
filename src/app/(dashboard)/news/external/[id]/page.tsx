"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Volume2, Loader2, ExternalLink, Clock, ArrowLeft, Tag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function ExternalNewsArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const [audioLoading, setAudioLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/news/external", id],
    queryFn: () => apiRequest("GET", `/api/news/external/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const article = data?.article;

  const handleListen = async () => {
    if (!article) return;
    setAudioLoading(true);
    try {
      await apiRequest("POST", `/api/news/external/${id}/audio`);
      if ("speechSynthesis" in window) {
        const text = `${article.title}. ${article.description || ""} ${article.content || ""}`.slice(0, 3000);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        setPlaying(true);
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(utterance);
      }
      toast({ title: "Audio ready", description: "Listening to article" });
    } catch {
      toast({ title: "Error", description: "Could not generate audio", variant: "destructive" });
    } finally {
      setAudioLoading(false);
    }
  };

  const stopAudio = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
  };

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/news/external">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to News
        </Link>
      </Button>

      <article className="space-y-4">
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
        </div>

        <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>

        {article.description && (
          <p className="text-lg text-muted-foreground">{article.description}</p>
        )}

        {article.image_url && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={article.image_url}
              alt={article.title}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Audio Player */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          {playing ? (
            <Button variant="destructive" size="sm" onClick={stopAudio}>
              <Volume2 className="h-4 w-4 mr-2" />
              Stop Audio
            </Button>
          ) : (
            <Button size="sm" onClick={handleListen} disabled={audioLoading}>
              {audioLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Volume2 className="h-4 w-4 mr-2" />
              )}
              Listen as Audio
            </Button>
          )}
          {article.audio_url && (
            <audio controls className="h-8 flex-1">
              <source src={article.audio_url} />
            </audio>
          )}
          {article.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Source
              </a>
            </Button>
          )}
        </div>

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

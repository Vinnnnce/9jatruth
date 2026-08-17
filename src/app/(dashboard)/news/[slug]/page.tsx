"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/components/hooks/use-toast";
import { motion } from "framer-motion";
import { NewsComments } from "@/components/news-comments";
import { AIContentSummaries } from "@/components/ai-content-summaries";
import {
  Heart,
  Share2,
  Clock,
  ShieldCheck,
  ChevronLeft,
  Facebook,
  Twitter,
  Linkedin,
  Link2,
  Newspaper,
  ArrowUp,
} from "lucide-react";

// ─── Types ───

type Article = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string; // HTML
  coverImage: string | null;
  category: string;
  tags: string[];
  authorName: string;
  authorAvatar?: string | null;
  authorVerified: boolean;
  publishedAt: string;
  likeCount: number;
  liked?: boolean;
};

type RelatedArticle = {
  id: number;
  slug: string;
  title: string;
  coverImage: string | null;
  category: string;
  publishedAt: string;
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

export default function NewsArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageZoom, setImageZoom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: article, isLoading } = useQuery<Article>({
    queryKey: ["/api/news/article", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/news/article?slug=${slug}`);
      return res.json();
    },
  });

  const { data: relatedData } = useQuery<{ articles: RelatedArticle[] }>({
    queryKey: ["/api/news/related", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/news/related?slug=${slug}`);
      return res.json();
    },
  });

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/news/article/like`, { slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/article", slug] });
    },
  });

  const handleLike = () => {
    likeMutation.mutate();
  };

  const handleShare = async (platform: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = article?.title || "9jatruth News";
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied!" });
      } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
      return;
    }
    if (platform === "native" && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: text, url });
      } catch {
        /* cancelled */
      }
      return;
    }
    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    };
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], "_blank", "width=600,height=400");
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto text-center space-y-3">
        <Newspaper className="h-12 w-12 mx-auto opacity-30 text-muted-foreground" />
        <h1 className="text-lg font-display font-700">Article not found</h1>
        <p className="text-sm text-muted-foreground">The article you're looking for doesn't exist or has been removed.</p>
        <Button asChild variant="outline">
          <Link href="/news">
            <ChevronLeft className="h-4 w-4" />
            Back to News
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* ─── Back link ─── */}
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to News
      </Link>

      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/90 text-primary-foreground border-none">
            {article.category}
          </Badge>
          {article.authorVerified && (
            <Badge className="text-[10px] px-2 py-0 rounded-full bg-green-500/15 text-green-600 border-green-500/30 flex items-center gap-0.5">
              <ShieldCheck className="h-2.5 w-2.5" />
              Verified Source
            </Badge>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-display font-700 leading-tight">{article.title}</h1>
        <p className="text-sm text-muted-foreground">{article.excerpt}</p>

        {/* Author + meta */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Avatar className="h-8 w-8">
            {article.authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.authorAvatar} alt={article.authorName} className="h-full w-full object-cover rounded-full" />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {article.authorName?.slice(0, 2).toUpperCase() || "AN"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-xs font-medium flex items-center gap-1">
              {article.authorName || "Anonymous"}
              {article.authorVerified && <ShieldCheck className="h-3 w-3 text-green-500" />}
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(article.publishedAt)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Cover image ─── */}
      {article.coverImage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-xl"
        >
          <motion.div whileHover={{ scale: imageZoom ? 1 : 1.02 }} className="cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-64 md:h-80 object-cover"
              onClick={() => setImageZoom((z) => !z)}
            />
          </motion.div>
        </motion.div>
      )}

      {/* ─── Article content ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.4 }}
        ref={contentRef}
        className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* ─── Tags ─── */}
      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* ─── Like + Share ─── */}
      <div className="flex items-center gap-2 py-3 border-y border-border">
        <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
          <Button
            variant={article.liked ? "default" : "outline"}
            size="sm"
            onClick={handleLike}
            disabled={likeMutation.isPending}
            className={article.liked ? "bg-red-500 hover:bg-red-500/90 border-red-500" : ""}
          >
            <motion.span
              key={article.likeCount}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className="flex items-center gap-1.5"
            >
              <Heart className={`h-4 w-4 ${article.liked ? "fill-white" : ""}`} />
              {article.likeCount}
            </motion.span>
          </Button>
        </motion.div>

        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-muted-foreground mr-1">Share:</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleShare("facebook")} title="Facebook">
            <Facebook className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleShare("twitter")} title="Twitter">
            <Twitter className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleShare("linkedin")} title="LinkedIn">
            <Linkedin className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleShare("copy")} title="Copy link">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── AI Summary ─── */}
      <AIContentSummaries
        articleId={article.id}
        title={article.title}
        content={article.content}
      />

      {/* ─── Comments ─── */}
      <NewsComments articleSlug={article.slug} />

      {/* ─── Related articles ─── */}
      {relatedData && relatedData.articles.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="space-y-3 pt-4 border-t border-border"
        >
          <h3 className="text-sm font-display font-700 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Related Articles
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedData.articles.map((rel, i) => (
              <motion.div
                key={rel.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                whileHover={{ y: -3 }}
              >
                <Link href={`/news/${rel.slug}`}>
                  <Card className="border-border overflow-hidden hover:border-primary/30 transition-colors h-full">
                    <div className="h-24 bg-muted overflow-hidden">
                      {rel.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={rel.coverImage} alt={rel.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Newspaper className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <Badge className="text-[9px] px-1.5 py-0 rounded-full border-none bg-primary/10 text-primary">
                        {rel.category}
                      </Badge>
                      <h4 className="text-xs font-medium leading-snug line-clamp-2">{rel.title}</h4>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(rel.publishedAt)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Scroll to top ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="flex justify-center pt-2"
      >
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 rounded-full"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

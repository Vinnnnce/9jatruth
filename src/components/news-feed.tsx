"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Newspaper,
} from "lucide-react";

// ─── Types ───

export type NewsArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  category: string;
  authorName: string;
  authorVerified: boolean;
  publishedAt: string;
  likeCount: number;
  commentCount: number;
};

type NewsFeedResponse = {
  articles: NewsArticle[];
};

const CATEGORIES = ["All", "Politics", "Technology", "Business", "Sports", "Entertainment", "Health", "Local"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── News Feed Component ───

export function NewsFeed() {
  const [activeCategory, setActiveCategory] = useState("All");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<NewsFeedResponse>({
    queryKey: ["/api/news/feed"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/news/feed");
      return res.json();
    },
  });

  const articles = data?.articles ?? [];
  const filtered =
    activeCategory === "All" ? articles : articles.filter((a) => a.category === activeCategory);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
      {/* ─── Category filter pills ─── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            whileTap={{ scale: 0.95 }}
            className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground bg-muted/50"
            }`}
          >
            {activeCategory === cat && (
              <motion.div
                layoutId="active-category-pill"
                className="absolute inset-0 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{cat}</span>
          </motion.button>
        ))}
      </div>

      {/* ─── Scroll controls ─── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-display font-700 flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          Latest News
        </h3>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => scroll("left")}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => scroll("right")}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Horizontal scrollable cards ─── */}
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center">
          <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No articles available.</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-thin pb-2 snap-x snap-mandatory"
        >
          <AnimatePresence>
            {filtered.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                whileHover={{ y: -6 }}
                className="w-72 shrink-0 snap-start"
              >
                <Link href={`/news/${article.slug}`}>
                  <div className="rounded-xl border border-border bg-card overflow-hidden h-full transition-colors hover:border-primary/30">
                    {/* Cover image */}
                    <div className="relative h-32 bg-muted overflow-hidden">
                      {article.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={article.coverImage}
                          alt={article.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Newspaper className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <Badge className="text-[9px] px-2 py-0 rounded-full bg-primary/90 text-primary-foreground border-none">
                          {article.category}
                        </Badge>
                      </div>
                      {article.authorVerified && (
                        <div className="absolute top-2 right-2">
                          <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-green-500/90 text-white border-none flex items-center gap-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Verified
                          </Badge>
                        </div>
                      )}
                    </div>
                    {/* Body */}
                    <div className="p-3 space-y-2">
                      <h4 className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                        {article.title}
                      </h4>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{article.excerpt}</p>
                      {/* Author */}
                      <div className="flex items-center gap-2 pt-1">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {article.authorName?.slice(0, 2).toUpperCase() || "AN"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-muted-foreground truncate flex-1">
                          {article.authorName || "Anonymous"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/70 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>
                      {/* Stats */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border">
                        <span className="flex items-center gap-0.5">
                          <Heart className="h-2.5 w-2.5" />
                          {article.likeCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="h-2.5 w-2.5" />
                          {article.commentCount}
                        </span>
                        <span className="ml-auto text-primary font-medium">Read More</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default NewsFeed;

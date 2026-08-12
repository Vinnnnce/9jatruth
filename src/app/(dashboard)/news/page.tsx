"use client";

import { NewsFeed } from "@/components/news-feed";
import { NewsAdmin } from "@/components/news-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Newspaper, FilePlus } from "lucide-react";

export default function NewsPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-700 flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            News
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verified community news and reporting.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/news/create">
            <FilePlus className="h-3.5 w-3.5" />
            Create Article
          </Link>
        </Button>
      </div>

      {/* ─── News Feed ─── */}
      <NewsFeed />

      {/* ─── Admin panel ─── */}
      <NewsAdmin />
    </div>
  );
}

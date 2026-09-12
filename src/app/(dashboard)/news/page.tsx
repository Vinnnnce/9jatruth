"use client";

import { useState } from "react";
import { NewsFeed } from "@/components/news-feed";
import { NewsAdmin } from "@/components/news-admin";
import { ExternalNewsSection } from "@/components/external-news-section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Newspaper, FilePlus, Globe, Sparkles } from "lucide-react";

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState<"community" | "external">("community");

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
            Verified community news and AI-powered external reporting.
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/news/create">
            <FilePlus className="h-3.5 w-3.5" />
            Create Article
          </Link>
        </Button>
      </div>

      {/* ─── Tab Selector ─── */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
        <button
          onClick={() => setActiveTab("community")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "community"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Newspaper className="h-3.5 w-3.5" />
          Community News
        </button>
        <button
          onClick={() => setActiveTab("external")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "external"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          External News
          <Sparkles className="h-3 w-3 text-primary" />
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      {activeTab === "community" ? (
        <>
          <NewsFeed />
          <NewsAdmin />
        </>
      ) : (
        <>
          <ExternalNewsSection />
          <div className="text-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/news/external">
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                View Full External News Page
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

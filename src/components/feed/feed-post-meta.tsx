"use client";

// ─── FeedPostMeta — Zone 5: location, AI tags, category, source ───

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Car,
  ChevronRight,
  Fuel,
  MapPin,
  MessageSquareQuote,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { FeedAITag, FeedLocation } from "./types";

const CATEGORY_META: Record<string, { icon: typeof Zap; label: string }> = {
  power: { icon: Zap, label: "Power" },
  fuel: { icon: Fuel, label: "Fuel" },
  traffic: { icon: Car, label: "Traffic" },
  prices: { icon: Tag, label: "Prices" },
  safety: { icon: ShieldCheck, label: "Safety" },
  politics: { icon: TrendingUp, label: "Politics" },
  motivation: { icon: Sparkles, label: "Motivation" },
  community: { icon: MessageSquareQuote, label: "Community" },
  news: { icon: Newspaper, label: "News" },
};

const AI_TAG_STYLES: Record<FeedAITag["kind"], string> = {
  topic: "bg-feed-accent/10 text-feed-accent",
  sentiment: "bg-purple-500/10 text-purple-500 dark:text-purple-400",
  category: "bg-feed-gift/10 text-feed-gift",
};

function Chip({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
        onClick
          ? "hover:brightness-95 active:scale-[0.97] cursor-pointer"
          : ""
      }`}
    >
      {children}
    </Comp>
  );
}

export function FeedPostMeta({
  location,
  aiTags,
  category,
  source,
  onLocationClick,
  onCategoryClick,
}: {
  location?: FeedLocation;
  aiTags?: FeedAITag[];
  category?: string;
  source?: string;
  onLocationClick?: (loc: FeedLocation) => void;
  onCategoryClick?: (category: string) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  if (!location && !aiTags?.length && !category && !source) return null;

  const locParts = [
    location?.community,
    location?.ward,
    location?.lga,
    location?.state,
  ].filter(Boolean) as string[];

  const catMeta = category ? CATEGORY_META[category] : undefined;
  const visibleTags = showAllTags ? aiTags : aiTags?.slice(0, 2);

  return (
    <div className="feed-meta flex flex-wrap items-center gap-1.5">
      {/* Location breadcrumb — State › LGA › Ward › Community */}
      {locParts.length > 0 && (
        <Chip
          onClick={() => onLocationClick?.(location!)}
          title="Open community feed"
        >
          <span className="inline-flex items-center gap-1 truncate rounded-full bg-feed-chip px-2.5 py-1 text-feed-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-feed-accent" />
            <span className="flex items-center truncate">
              {[...locParts].reverse().map((p, i, arr) => (
                <span key={i} className="flex items-center truncate">
                  <span className="truncate">{p}</span>
                  {i < arr.length - 1 && (
                    <ChevronRight className="mx-0.5 h-3 w-3 shrink-0 opacity-50" />
                  )}
                </span>
              ))}
            </span>
          </span>
        </Chip>
      )}

      {/* Category tag */}
      {catMeta && (
        <Chip onClick={() => onCategoryClick?.(category!)} title={`Filter by ${catMeta.label}`}>
          <span className="inline-flex items-center gap-1 rounded-full bg-feed-chip px-2.5 py-1 text-feed-muted">
            <catMeta.icon className="h-3.5 w-3.5 text-feed-accent" />
            {catMeta.label}
          </span>
        </Chip>
      )}

      {/* AI tags */}
      {visibleTags && visibleTags.length > 0 && (
        <>
          {visibleTags.map((t, i) => (
            <Chip key={`${t.kind}-${i}`} title={`AI ${t.kind}`}>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${AI_TAG_STYLES[t.kind]}`}
              >
                <Sparkles className="h-3 w-3" />
                {t.label}
              </span>
            </Chip>
          ))}
          {(aiTags?.length ?? 0) > 2 && !showAllTags && (
            <Chip onClick={() => setShowAllTags(true)}>
              <span className="rounded-full bg-feed-chip px-2.5 py-1 text-feed-muted">
                +{(aiTags?.length ?? 0) - 2}
              </span>
            </Chip>
          )}
        </>
      )}

      {/* Imported source */}
      {source && (
        <Chip title={`Imported from ${source}`}>
          <span className="inline-flex items-center gap-1 rounded-full bg-feed-chip px-2.5 py-1 text-feed-muted">
            <Newspaper className="h-3.5 w-3.5" />
            {source}
          </span>
        </Chip>
      )}
    </div>
  );
}

"use client";

// ─── Feed showcase — live preview of the redesigned FeedPost component ───

import { useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { FeedPost, type FeedPostData } from "@/components/feed";
import { SokeLogoFull } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";

const now = Date.parse("2026-09-05T07:43:00Z"); // fixed to avoid hydration drift

const SAMPLE_POSTS: FeedPostData[] = [
  {
    id: "p1",
    user: {
      id: "u1",
      displayName: "Adaeze Okonkwo",
      handle: "adaeze_truth",
      badges: ["verified", "premium"],
      bio: "Community reporter · Surulere resident · Verified since 2024",
      followers: 12400,
      trustScore: 96,
    },
    createdAt: new Date(now - 4 * 60000).toISOString(),
    text: "IKEJA ELECTRIC UPDATE — After 11 hours of blackout, power just returned to Opebi, Allen Avenue and parts of Ikeja GRA. ⚡\n\nNeighbours around Adeniyi Jones confirm it came back around 9:35am. If you're still in the dark around Oregun, drop your street below so we can map the affected areas.\n\nRemember: report outages with your location so the community tracker stays accurate. #PowerWatch #IkejaUpdates @9jatruth",
    media: [
      {
        type: "image",
        url: "/demo/feed/power-grid.svg",
        alt: "Transmission towers at dusk with restored power glow",
      },
    ],
    location: { state: "Lagos", lga: "Ikeja", ward: "Ward 06", community: "Opebi" },
    aiTags: [
      { kind: "topic", label: "Power restoration" },
      { kind: "sentiment", label: "Positive" },
      { kind: "category", label: "Infrastructure" },
    ],
    category: "power",
    likeCount: 342,
    commentCount: 87,
    shareCount: 64,
    repostCount: 41,
    giftCount: 12,
    comments: [
      {
        id: "c1",
        user: { id: "u2", displayName: "Tunde Bakare", handle: "tundeb" },
        content: "Still nothing in Oregun since yesterday evening. Added my street to the tracker 🙏",
        createdAt: new Date(now - 2 * 60000).toISOString(),
        likeCount: 18,
        replies: [
          {
            id: "c1r1",
            user: { id: "u3", displayName: "Ikeja Watch", handle: "ikejawatch" },
            content: "Oregun feeder is on the maintenance list — Ikeja Electric confirmed 2pm ETA.",
            createdAt: new Date(now - 60000).toISOString(),
            likeCount: 9,
          },
        ],
      },
      {
        id: "c2",
        user: { id: "u4", displayName: "Chiamaka Eze", handle: "chiamaka_e" },
        content: "Thank you for this update, generator don almost finish my pocket 😩",
        createdAt: new Date(now - 3 * 60000).toISOString(),
        likeCount: 31,
      },
    ],
  },
  {
    id: "p2",
    user: {
      id: "u5",
      displayName: "Yusuf Ibrahim",
      handle: "yusuf_kano",
      badges: ["superfan"],
      bio: "Market prices tracker · Kano",
      followers: 3820,
      trustScore: 88,
    },
    createdAt: new Date(now - 55 * 60000).toISOString(),
    text: "This morning's price check at Sabon Gari market, Kano 🧺\n\nA bag of rice now ₦98,000 (up from ₦92,000 last week). Tomatoes are cheaper though — big basket down to ₦14,500.\n\nSwipe for this week's full board. What are prices like in your market today? #PriceWatch",
    media: [
      { type: "image", url: "/demo/feed/market.svg", alt: "Busy market stalls with produce" },
      { type: "image", url: "/demo/feed/traffic.svg", alt: "Traffic on the way to the market" },
      { type: "image", url: "/demo/feed/power-grid.svg", alt: "Power lines over the market district" },
    ],
    location: { state: "Kano", lga: "Fagge", community: "Sabon Gari" },
    aiTags: [
      { kind: "topic", label: "Food prices" },
      { kind: "sentiment", label: "Neutral" },
    ],
    category: "prices",
    likeCount: 1284,
    commentCount: 203,
    shareCount: 311,
    repostCount: 96,
    giftCount: 57,
    comments: [
      {
        id: "c3",
        user: { id: "u6", displayName: "Mama Nkechi", handle: "nkechi_aba" },
        content: "Same ₦98,000 in Aba. Rice is finished 😭",
        createdAt: new Date(now - 40 * 60000).toISOString(),
        likeCount: 44,
        replies: [
          {
            id: "c3r1",
            user: { id: "u5", displayName: "Yusuf Ibrahim", handle: "yusuf_kano" },
            content: "Hold on small, harvest season is close. Prices should ease by October.",
            createdAt: new Date(now - 35 * 60000).toISOString(),
            likeCount: 12,
          },
          {
            id: "c3r2",
            user: { id: "u7", displayName: "Oga Farmer", handle: "ogafarmer" },
            content: "Confirmed. Benue farms had a strong season.",
            createdAt: new Date(now - 30 * 60000).toISOString(),
            likeCount: 7,
          },
        ],
      },
    ],
  },
  {
    id: "p3",
    user: {
      id: "u8",
      displayName: "Lagos Traffic Live",
      handle: "lagostraffic",
      badges: ["verified", "agency", "top-contributor"],
      bio: "Real-time traffic reports powered by the community",
      followers: 48200,
      trustScore: 92,
    },
    createdAt: new Date(now - 3 * 3600000).toISOString(),
    text: "THIRD MAINLAND BRIDGE: heavy inbound traffic from Oworonshoki to Adeniji. Outbound is free-flowing. 🚗\n\nAlternative: Ikorodu Road through Anthony is moving well. Plan your movement accordingly.",
    media: [
      {
        type: "video",
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        thumbnailUrl: "/demo/feed/traffic.svg",
        alt: "Traffic cam view of the bridge approach",
        durationSeconds: 15,
      },
    ],
    location: { state: "Lagos", lga: "Lagos Island", ward: "Ward 02" },
    aiTags: [{ kind: "topic", label: "Traffic alert" }],
    category: "traffic",
    source: "NewsAPI",
    likeCount: 892,
    commentCount: 118,
    shareCount: 452,
    repostCount: 267,
    comments: [
      {
        id: "c4",
        user: { id: "u9", displayName: "Emeka Obi", handle: "emeka_o" },
        content: "Left Adekunle 20 minutes ago, can confirm it's a parking lot 🚗🚗🚗",
        createdAt: new Date(now - 2.5 * 3600000).toISOString(),
        likeCount: 26,
      },
    ],
  },
  {
    id: "p4",
    user: {
      id: "u10",
      displayName: "Blessing Adeyemi",
      handle: "blessing_writes",
      badges: ["premium"],
      bio: "Storyteller · Community builder · Lagos",
      followers: 7640,
      trustScore: 90,
    },
    createdAt: new Date(now - 26 * 3600000).toISOString(),
    text: "A danfo driver stopped his bus this morning, came down, and helped an elderly woman cross Ojuelegba road with her load. Nobody asked him. Passengers waited patiently.\n\nNigeria works when we decide it works. Small kindness, big ripple. ❤️🇳🇬\n\nWho witnessed something beautiful this week? Share below — let's flood the feed with good news.",
    media: [],
    linkPreview: {
      url: "https://9jatruth.com/news/kindness-ojuelegba",
      domain: "9jatruth.com",
      title: "The Ojuelegba moment: why small acts are rebuilding trust in our streets",
      description:
        "Community reporters documented over 200 acts of everyday kindness across Lagos this month.",
      thumbnailUrl: "/demo/feed/market.svg",
    },
    location: { state: "Lagos", lga: "Surulere", community: "Ojuelegba" },
    aiTags: [
      { kind: "topic", label: "Community kindness" },
      { kind: "sentiment", label: "Uplifting" },
      { kind: "category", label: "Motivation" },
    ],
    category: "motivation",
    likeCount: 5217,
    commentCount: 389,
    shareCount: 1204,
    repostCount: 433,
    giftCount: 210,
    comments: [
      {
        id: "c5",
        user: { id: "u11", displayName: "Ngozi Umeh", handle: "ngozi_u" },
        content: "This is the content I signed up for. More of this energy on this app 💚",
        createdAt: new Date(now - 20 * 3600000).toISOString(),
        likeCount: 156,
        replies: [
          {
            id: "c5r1",
            user: { id: "u10", displayName: "Blessing Adeyemi", handle: "blessing_writes" },
            content: "We move! Tag me when you witness something, I'll feature it next week.",
            createdAt: new Date(now - 19 * 3600000).toISOString(),
            likeCount: 22,
          },
        ],
      },
      {
        id: "c6",
        user: { id: "u12", displayName: "Kelechi N.", handle: "kelechi_n" },
        content: "A vulcanizer near my place refuses payment from okada riders every Friday. Quietly. Every single Friday.",
        createdAt: new Date(now - 12 * 3600000).toISOString(),
        likeCount: 89,
      },
    ],
  },
];

export function FeedShowcase() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-feed-surface">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-feed-border bg-feed-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <SokeLogoFull />
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-feed-chip px-3 py-1 text-xs font-medium text-feed-muted sm:block">
              Feed post redesign · v2
            </span>
            <button
              type="button"
              aria-label="Toggle dark mode"
              onClick={toggleTheme}
              className="rounded-full border border-feed-border bg-feed-card p-2 text-feed-muted transition-colors hover:text-feed-text"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="mx-auto max-w-[640px] space-y-4 px-3 py-5 sm:px-4">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1 pb-1 text-[13px] text-feed-muted"
        >
          Community feed — redesigned post component. Try like, reactions,
          gifts, read-more, media viewer and threaded comments.
        </motion.p>
        {SAMPLE_POSTS.map((post, i) => (
          <FeedPost key={post.id} post={post} index={i} />
        ))}
        <p className="py-6 text-center text-xs text-feed-muted">
          You&apos;ve reached the end of the preview · 9jatruth
        </p>
      </main>
    </div>
  );
}

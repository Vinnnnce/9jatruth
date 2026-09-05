// ─── 9jatruth Feed Post — shared types ───

export type FeedBadgeType =
  | "verified"
  | "premium"
  | "superfan"
  | "agency"
  | "top-contributor";

export type FeedUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  badges?: FeedBadgeType[];
  bio?: string;
  followers?: number;
  trustScore?: number; // 0–100
};

export type FeedMediaItem = {
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string; // poster for videos
  alt?: string;
  durationSeconds?: number;
};

export type FeedLinkPreview = {
  url: string;
  domain: string;
  title: string;
  description?: string;
  thumbnailUrl?: string | null;
};

export type FeedLocation = {
  state?: string;
  lga?: string;
  ward?: string;
  community?: string;
};

export type FeedAITag = {
  kind: "topic" | "sentiment" | "category";
  label: string;
};

export type FeedComment = {
  id: string;
  user: Pick<FeedUser, "id" | "displayName" | "handle" | "avatarUrl">;
  content: string;
  createdAt: string;
  likeCount?: number;
  replies?: FeedComment[];
};

export type FeedPostData = {
  id: string;
  user: FeedUser;
  createdAt: string;
  text: string;
  media?: FeedMediaItem[];
  linkPreview?: FeedLinkPreview;
  location?: FeedLocation;
  aiTags?: FeedAITag[];
  category?: string; // e.g. "power" | "fuel" | "traffic" | "prices" | "safety" | "politics"
  source?: string; // e.g. "NewsAPI" for imported articles
  isLiked?: boolean;
  isReposted?: boolean;
  isBookmarked?: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  repostCount: number;
  giftCount?: number;
  reaction?: string | null; // selected emoji reaction
  comments?: FeedComment[];
};

// ─── Helpers ───

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

export function formatDuration(seconds?: number): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

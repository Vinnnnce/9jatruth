"use client";

// ─── TruthPostCard ─────────────────────────────────────────────
// A dark, premium feed post card matching the 9jatruth reference
// design. Self-contained optimistic interaction state for the action
// bar (flame/upvote, comment, share, repost, gift, react) and a
// footer with edit / delete / mute controls. Delete is wired to the
// parent mutation so it actually removes the post; the rest are
// optimistic + best-effort API calls where endpoints exist.

import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import {
  Flame,
  MessageCircle,
  Share2,
  Repeat2,
  Gift,
  Smile,
  Pencil,
  Trash2,
  BellOff,
  ChevronDown,
  Crown,
  MapPin,
} from "lucide-react";

export interface TruthPostData {
  id: number;
  content: string;
  category?: string | null;
  trustScore?: number | null;
  createdAt: string;
  displayName?: string | null;
  neighborhoodName?: string | null;
  state?: string | null;
  lga?: string | null;
  isAuthor?: boolean;
  likeCount?: number | null;
}

interface TruthPostCardProps {
  truth: TruthPostData;
  index?: number;
  onDelete?: (id: number) => void;
  deleting?: boolean;
  /** Server-computed: viewer may delete this post (author or super admin). */
  canDelete?: boolean;
}

const AVATAR_GRADIENTS = [
  "from-amber-500 to-yellow-600",
  "from-orange-500 to-red-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
];

function gradientFor(id: string | number) {
  const key = String(id);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function initials(name?: string | null): string {
  if (!name) return "9J";
  const parts = name.trim().split(/\s+/);
  return (parts.map((p) => p[0]).slice(0, 2).join("") || name.slice(0, 2)).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function TruthPostCard({ truth, index = 0, onDelete, deleting, canDelete }: TruthPostCardProps) {
  const [upvoted, setUpvoted] = useState(false);
  const [upvotes, setUpvotes] = useState(Math.max(0, Number(truth.likeCount ?? 0)));
  const [commentCount, setCommentCount] = useState(0);
  const [shares, setShares] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [gifted, setGifted] = useState(false);
  const [copied, setCopied] = useState(false);

  const name = truth.displayName?.trim() || "Anonymous";
  const handle = (truth.displayName || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 14);

  const toggleUpvote = async () => {
    const next = !upvoted;
    setUpvoted(next);
    setUpvotes((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await apiRequest("POST", `/api/truths/${truth.id}/like`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.likeCount === "number") setUpvotes(data.likeCount);
        if (typeof data.liked === "boolean") setUpvoted(data.liked);
      }
    } catch {
      /* keep optimistic state */
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/feeds?truth=${truth.id}` : "";
    setShares((c) => c + 1);
    try {
      if (navigator.share) {
        await navigator.share({ title: "9jatruth", text: truth.content.slice(0, 100), url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
      apiRequest("POST", `/api/truths/${truth.id}/share`, { channel: "link" }).catch(() => {});
    } catch {
      /* user cancelled */
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94], delay: Math.min(index, 4) * 0.05 }}
      className="rounded-[24px] border border-[#2A261F] bg-[#0D0F14] p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-col gap-4">
        {/* ─── Header ─── */}
        <header className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="rounded-full p-[2px] bg-gradient-to-br from-[#D6A838] to-[#8A6A1F]">
              <Avatar className="h-11 w-11 border-2 border-[#0D0F14]">
                {truth.displayName ? (
                  <AvatarImage src={undefined} alt={name} />
                ) : null}
                <AvatarFallback
                  className={`bg-gradient-to-br ${gradientFor(truth.id)} text-[13px] font-bold text-white`}
                >
                  {initials(truth.displayName)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-bold text-[#D6B06C] truncate">{name}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/30 bg-[#C89D42]/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#C89D42]">
                <Crown className="h-2.5 w-2.5" />
                Premium
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/20 bg-[#C89D42]/5 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#C89D42]/80">
                <Crown className="h-2.5 w-2.5" />
                Super Fan
              </span>
              {truth.category && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/20 bg-[#C89D42]/5 px-2 py-[2px] text-[10px] font-semibold capitalize text-[#C89D42]/80">
                  {truth.category}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#7F7666]">
              <span className="truncate">@{handle || "9jauser"}</span>
              <span>·</span>
              <span>{timeAgo(truth.createdAt)}</span>
              {truth.neighborhoodName && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <MapPin className="h-3 w-3" />
                    {truth.neighborhoodName}
                  </span>
                </>
              )}
            </div>
          </div>
          {typeof truth.trustScore === "number" && (
            <div className="shrink-0 rounded-lg border border-[#2A261F] bg-[#15171D] px-2 py-1 text-right">
              <p className="text-[9px] uppercase tracking-wide text-[#7F7666]">Trust</p>
              <p
                className={`text-[13px] font-bold tabular-nums ${
                  (truth.trustScore ?? 0) >= 70
                    ? "text-[#5CB85C]"
                    : (truth.trustScore ?? 0) >= 40
                    ? "text-[#D6A838]"
                    : "text-[#A94A4A]"
                }`}
              >
                {truth.trustScore}%
              </p>
            </div>
          )}
        </header>

        {/* ─── Body ─── */}
        <p className="whitespace-pre-line break-words text-[15px] leading-[1.5] text-[#DEC196]">
          {truth.content}
        </p>

        {/* ─── Action bar ─── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Flame / upvote pill */}
          <button
            type="button"
            onClick={toggleUpvote}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
              upvoted
                ? "border-[#7A2E2E] bg-[#3A1414] text-[#E0883C] shadow-[0_0_12px_rgba(224,136,60,0.25)]"
                : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:border-[#7A2E2E]/50 hover:text-[#E0883C]"
            }`}
            aria-pressed={upvoted}
            aria-label={upvoted ? "Remove upvote" : "Upvote"}
          >
            <Flame className={`h-3.5 w-3.5 ${upvoted ? "fill-[#E0883C] text-[#E0883C]" : ""}`} />
            <span className="tabular-nums">{upvotes}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {/* Comment */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#2A261F] bg-[#15171D] px-3 py-1.5 text-[12px] font-medium text-[#8A857A] transition-colors hover:text-[#DEC196]"
            aria-label="Comment"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="tabular-nums">{commentCount}</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#2A261F] bg-[#15171D] px-3 py-1.5 text-[12px] font-medium text-[#8A857A] transition-colors hover:text-[#DEC196]"
            aria-label="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>{copied ? "Copied" : "Share"}</span>
          </button>

          {/* Repost */}
          <button
            type="button"
            onClick={() => {
              setReposted((v) => !v);
            }}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              reposted
                ? "border-[#2E6B4A] bg-[#13241A] text-[#5CB85C]"
                : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#DEC196]"
            }`}
            aria-pressed={reposted}
            aria-label="Repost"
          >
            <Repeat2 className="h-3.5 w-3.5" />
          </button>

          {/* Gift */}
          <button
            type="button"
            onClick={() => setGifted((v) => !v)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
              gifted
                ? "border-[#7A5A1F] bg-[#2A2114] text-[#D6A838]"
                : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#DEC196]"
            }`}
            aria-label="Gift"
          >
            <Gift className="h-3.5 w-3.5" />
          </button>

          {/* Reaction */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactions((v) => !v)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                reaction
                  ? "border-[#7A5A1F] bg-[#2A2114] text-[#D6A838]"
                  : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#DEC196]"
              }`}
              aria-label="React"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {showReactions && (
              <div className="absolute bottom-10 left-0 z-10 flex gap-1 rounded-full border border-[#2A261F] bg-[#15171D] p-1 shadow-xl">
                {["🔥", "❤️", "😮", "😢", "👏"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setReaction(reaction === emoji ? null : emoji);
                      setShowReactions(false);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] hover:bg-[#2A261F]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Footer: author controls ─── */}
        {(canDelete || truth.isAuthor || onDelete) && (
          <div className="flex items-center gap-1 border-t border-[#2A261F] pt-3">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#7A818E] transition-colors hover:bg-[#1C1F26] hover:text-[#DEC196]"
              aria-label="Edit"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {(canDelete || truth.isAuthor) && onDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(truth.id)}
                data-testid={`button-delete-truth-${truth.id}`}
                title="Delete your post"
                aria-label="Delete"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#A94A4A] transition-colors hover:bg-[#2A1414] hover:text-[#D9534F] disabled:opacity-50"
              >
                {deleting ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#A94A4A] border-t-transparent" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#7A818E] transition-colors hover:bg-[#1C1F26] hover:text-[#DEC196]"
              aria-label="Mute notifications"
              title="Mute"
            >
              <BellOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </motion.article>
  );
}

"use client";

// ─── TruthPostDetail ──────────────────────────────────────────
// Full post detail view (the image-1 "report card" design) shown when a
// user clicks a post in the feed. Wires every engagement action to a real
// API endpoint:
//   like      → POST   /api/truths/[id]/like        (trust +1)
//   dislike   → POST   /api/truths/[id]/dislike    (trust -1)
//   comment   → POST   /api/truths/[id]/comments
//   share     → POST   /api/truths/[id]/share
//   repost    → POST   /api/truths/[id]/repost
//   gift      → POST   /api/truths/[id]/gift        (uses accumulated points)
//   subscribe → POST   /api/users/[userHash]/subscribe (become a fan)
//   delete    → DELETE /api/truths/[id]             (author or super admin)

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Flame,
  ThumbsDown,
  MessageCircle,
  Share2,
  Repeat2,
  Gift,
  Send,
  Crown,
  MapPin,
  Trash2,
  ChevronLeft,
  Check,
  Heart,
  Star,
  Trophy,
  Coffee,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/components/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TruthDetail {
  id: number;
  content: string;
  category?: string | null;
  trustScore?: number | null;
  createdAt: string;
  userHash: string;
  displayName?: string | null;
  neighborhoodName?: string | null;
  stateName?: string | null;
  lgaName?: string | null;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  repostCount: number;
  giftCount: number;
  shareCount: number;
  fanCount: number;
  isAuthor: boolean;
  canDelete: boolean;
  signedIn: boolean;
  viewerLiked: boolean;
  viewerDisliked: boolean;
  viewerReposted: boolean;
  viewerSubscribed: boolean;
  viewerPoints: number;
}

interface Comment {
  id: number;
  displayName?: string | null;
  content: string;
  createdAt: string;
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

const GIFTS = [
  { id: "coffee", icon: Coffee, label: "Coffee", points: 5 },
  { id: "star", icon: Star, label: "Star", points: 10 },
  { id: "trophy", icon: Trophy, label: "Trophy", points: 25 },
  { id: "heart", icon: Heart, label: "Heart", points: 50 },
];

export function TruthPostDetail({ truthId }: { truthId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [truth, setTruth] = useState<TruthDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest("GET", `/api/truths/${truthId}`);
      if (res.ok) {
        setTruth(await res.json());
      } else if (res.status === 404) {
        setTruth(null);
      }
    } catch {
      /* keep loading state */
    } finally {
      setLoading(false);
    }
  }, [truthId]);

  const loadComments = useCallback(async () => {
    try {
      const res = await apiRequest("GET", `/api/truths/${truthId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {
      /* ignore */
    }
  }, [truthId]);

  useEffect(() => {
    load();
    loadComments();
  }, [load, loadComments]);

  const requireAuth = useCallback((): boolean => {
    if (truth?.signedIn) return true;
    toast({ title: "Sign in required", description: "Please sign in to perform this action.", variant: "destructive" });
    return false;
  }, [truth?.signedIn, toast]);

  const patch = (partial: Partial<TruthDetail>) =>
    setTruth((t) => (t ? { ...t, ...partial } : t));

  // ── Like (trust +1) ──
  const onLike = async () => {
    if (!truth || !requireAuth()) return;
    const wasLiked = truth.viewerLiked;
    patch({ viewerLiked: !wasLiked, viewerDisliked: false, likeCount: truth.likeCount + (wasLiked ? -1 : 1) });
    setBusy("like");
    try {
      const res = wasLiked
        ? await apiRequest("DELETE", `/api/truths/${truthId}/like`)
        : await apiRequest("POST", `/api/truths/${truthId}/like`);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        patch({ likeCount: d.likeCount ?? truth.likeCount, trustScore: d.trustScore ?? truth.trustScore, viewerLiked: d.liked ?? !wasLiked });
      }
    } catch { /* optimistic */ } finally { setBusy(null); }
  };

  // ── Dislike (trust -1) ──
  const onDislike = async () => {
    if (!truth || !requireAuth()) return;
    const wasDisliked = truth.viewerDisliked;
    patch({ viewerDisliked: !wasDisliked, viewerLiked: false, dislikeCount: truth.dislikeCount + (wasDisliked ? -1 : 1) });
    setBusy("dislike");
    try {
      const res = wasDisliked
        ? await apiRequest("DELETE", `/api/truths/${truthId}/dislike`)
        : await apiRequest("POST", `/api/truths/${truthId}/dislike`);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        patch({ dislikeCount: d.dislikeCount ?? truth.dislikeCount, likeCount: d.likeCount ?? truth.likeCount, trustScore: d.trustScore ?? truth.trustScore, viewerDisliked: d.disliked ?? !wasDisliked });
      }
    } catch { /* optimistic */ } finally { setBusy(null); }
  };

  // ── Repost ──
  const onRepost = async () => {
    if (!truth || !requireAuth()) return;
    const wasReposted = truth.viewerReposted;
    patch({ viewerReposted: !wasReposted, repostCount: truth.repostCount + (wasReposted ? -1 : 1) });
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/repost`);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        patch({ repostCount: d.repostCount ?? truth.repostCount, viewerReposted: d.reposted ?? !wasReposted });
      }
    } catch { /* optimistic */ }
  };

  // ── Subscribe as fan ──
  const onSubscribe = async () => {
    if (!truth || !requireAuth()) return;
    const wasSubscribed = truth.viewerSubscribed;
    patch({ viewerSubscribed: !wasSubscribed, fanCount: truth.fanCount + (wasSubscribed ? -1 : 1) });
    try {
      const res = wasSubscribed
        ? await apiRequest("DELETE", `/api/users/${truth.userHash}/subscribe`)
        : await apiRequest("POST", `/api/users/${truth.userHash}/subscribe`);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        patch({ fanCount: d.subscriberCount ?? truth.fanCount, viewerSubscribed: d.subscribed ?? !wasSubscribed });
        toast({ title: wasSubscribed ? "Unsubscribed" : "You're now a fan", description: wasSubscribed ? "You stopped following this user." : "You'll see their posts in your feed." });
      }
    } catch { /* optimistic */ }
  };

  // ── Share ──
  const onShare = async () => {
    if (!truth) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}/truths/${truth.id}` : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: "9jatruth", text: truth.content.slice(0, 100), url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Post link copied to clipboard." });
      }
      apiRequest("POST", `/api/truths/${truth.id}/share`, { channel: "link" }).catch(() => {});
      patch({ shareCount: truth.shareCount + 1 });
    } catch { /* user cancelled */ }
  };

  // ── Gift (uses accumulated points) ──
  const onGift = async (giftId: string, points: number) => {
    if (!truth || !requireAuth()) return;
    setBusy(`gift-${giftId}`);
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/gift`, { giftId, points });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        patch({ giftCount: d.giftCount ?? truth.giftCount + 1, viewerPoints: d.balance ?? truth.viewerPoints });
        setGiftOpen(false);
        toast({ title: "Gift sent", description: `You sent a ${giftId} gift (${points} points).` });
      } else {
        toast({ title: "Couldn't send gift", description: d.message || "Not enough points.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't send gift", description: "Something went wrong.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  // ── Comment ──
  const onComment = async () => {
    if (!truth || !requireAuth()) return;
    const content = commentText.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/truths/${truthId}/comments`, { content });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        setComments((c) => [...c, d]);
        patch({ commentCount: truth.commentCount + 1 });
        setCommentText("");
      } else {
        toast({ title: "Couldn't comment", description: "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't comment", description: "Something went wrong.", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  // ── Delete (author or admin) ──
  const onDelete = async () => {
    if (!truth || !truth.canDelete) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setBusy("delete");
    try {
      const res = await apiRequest("DELETE", `/api/truths/${truthId}`);
      if (res.ok) {
        toast({ title: "Post deleted" });
        router.push("/feeds");
      } else {
        toast({ title: "Couldn't delete", description: "You may not have permission.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't delete", description: "Something went wrong.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-[24px] border border-[#2A261F] bg-[#0D0F14]" />
      </div>
    );
  }

  if (!truth) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-lg font-semibold text-[#D6B06C]">Post not found</p>
        <p className="mt-1 text-sm text-[#7F7666]">This post may have been deleted.</p>
        <button onClick={() => router.push("/feeds")} className="mt-4 inline-flex items-center gap-1 text-sm text-[#C89D42] hover:underline">
          <ChevronLeft className="h-4 w-4" /> Back to feed
        </button>
      </div>
    );
  }

  const name = truth.displayName?.trim() || "Anonymous";
  const handle = (truth.displayName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14);

  return (
    <div className="mx-auto max-w-2xl px-3 py-5 sm:px-4 sm:py-8">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-[#7F7666] transition-colors hover:text-[#D6B06C]">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="rounded-[24px] border border-[#2A261F] bg-[#0D0F14] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] sm:p-6"
      >
        <div className="flex flex-col gap-4">
          {/* ─── Header ─── */}
          <header className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="rounded-full p-[2px] bg-gradient-to-br from-[#D6A838] to-[#8A6A1F]">
                <Avatar className="h-11 w-11 border-2 border-[#0D0F14]">
                  <AvatarFallback className={`bg-gradient-to-br ${gradientFor(truth.userHash)} text-[13px] font-bold text-white`}>
                    {initials(truth.displayName)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-bold text-[#D6B06C] truncate">{name}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/30 bg-[#C89D42]/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#C89D42]">
                  <Crown className="h-2.5 w-2.5" /> Premium
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/20 bg-[#C89D42]/5 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#C89D42]/80">
                  <Crown className="h-2.5 w-2.5" /> Super Fan
                </span>
                {truth.category && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#C89D42]/20 bg-[#C89D42]/5 px-2 py-[2px] text-[10px] font-semibold capitalize text-[#C89D42]/80">
                    {truth.category}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#7F7666]">
                <span className="truncate">@{handle || "9jauser"}</span>
                <span>·</span>
                <span>{timeAgo(truth.createdAt)}</span>
                {(truth.neighborhoodName || truth.stateName) && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <MapPin className="h-3 w-3" />
                      {truth.neighborhoodName || truth.stateName}
                    </span>
                  </>
                )}
              </div>
            </div>
            {/* Trust metric */}
            <div className="shrink-0 rounded-lg border border-[#2A261F] bg-[#15171D] px-2 py-1 text-right">
              <p className="text-[9px] uppercase tracking-wide text-[#7F7666]">Trust</p>
              <p
                className={`text-[13px] font-bold tabular-nums ${
                  (truth.trustScore ?? 0) >= 70 ? "text-[#5CB85C]" : (truth.trustScore ?? 0) >= 40 ? "text-[#D6A838]" : "text-[#A94A4A]"
                }`}
              >
                {truth.trustScore ?? 0}%
              </p>
            </div>
          </header>

          {/* ─── Body ─── */}
          <p className="whitespace-pre-line break-words text-[16px] leading-[1.55] text-[#DEC196]">
            {truth.content}
          </p>

          {/* ─── Engagement stats row ─── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[#2A261F] py-2 text-[11px] text-[#7F7666]">
            <span><Flame className="mr-1 inline h-3 w-3 text-[#E0883C]" />{truth.likeCount} likes</span>
            <span><ThumbsDown className="mr-1 inline h-3 w-3" />{truth.dislikeCount} dislikes</span>
            <span><MessageCircle className="mr-1 inline h-3 w-3" />{truth.commentCount} comments</span>
            <span><Repeat2 className="mr-1 inline h-3 w-3" />{truth.repostCount} reposts</span>
            <span><Gift className="mr-1 inline h-3 w-3 text-[#D6A838]" />{truth.giftCount} gifts</span>
            <span><Crown className="mr-1 inline h-3 w-3 text-[#C89D42]" />{truth.fanCount} fans</span>
          </div>

          {/* ─── Action bar ─── */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Like (trust +1) */}
            <button
              type="button" onClick={onLike} disabled={busy === "like"} aria-pressed={truth.viewerLiked}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50 ${
                truth.viewerLiked ? "border-[#7A2E2E] bg-[#3A1414] text-[#E0883C] shadow-[0_0_12px_rgba(224,136,60,0.25)]" : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:border-[#7A2E2E]/50 hover:text-[#E0883C]"
              }`}
            >
              <Flame className={`h-3.5 w-3.5 ${truth.viewerLiked ? "fill-[#E0883C] text-[#E0883C]" : ""}`} />
              <span className="tabular-nums">{truth.likeCount}</span>
            </button>

            {/* Dislike (trust -1) */}
            <button
              type="button" onClick={onDislike} disabled={busy === "dislike"} aria-pressed={truth.viewerDisliked}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-50 ${
                truth.viewerDisliked ? "border-[#3A3F4A] bg-[#1A1F2A] text-[#8A95B0]" : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#8A95B0]"
              }`}
              title="Dislike reduces the trust score"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              <span className="tabular-nums">{truth.dislikeCount}</span>
            </button>

            {/* Comment */}
            <button
              type="button" onClick={() => document.getElementById("comment-input")?.focus()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2A261F] bg-[#15171D] px-3 py-1.5 text-[12px] font-medium text-[#8A857A] transition-colors hover:text-[#DEC196]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="tabular-nums">{truth.commentCount}</span>
            </button>

            {/* Share */}
            <button
              type="button" onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2A261F] bg-[#15171D] px-3 py-1.5 text-[12px] font-medium text-[#8A857A] transition-colors hover:text-[#DEC196]"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>

            {/* Repost */}
            <button
              type="button" onClick={onRepost} aria-pressed={truth.viewerReposted}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                truth.viewerReposted ? "border-[#2E6B4A] bg-[#13241A] text-[#5CB85C]" : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#DEC196]"
              }`}
            >
              <Repeat2 className="h-3.5 w-3.5" />
              <span className="tabular-nums">{truth.repostCount}</span>
            </button>

            {/* Gift (uses points) */}
            <button
              type="button" onClick={() => setGiftOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                truth.giftCount > 0 ? "border-[#7A5A1F] bg-[#2A2114] text-[#D6A838]" : "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:text-[#D6A838]"
              }`}
            >
              <Gift className="h-3.5 w-3.5" />
              <span className="tabular-nums">{truth.giftCount}</span>
            </button>

            {/* Subscribe as fan */}
            <button
              type="button" onClick={onSubscribe} aria-pressed={truth.viewerSubscribed}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                truth.viewerSubscribed ? "border-[#C89D42]/40 bg-[#C89D42]/10 text-[#C89D42]" : "border-[#C89D42]/30 bg-[#C89D42]/5 text-[#C89D42] hover:bg-[#C89D42]/15"
              }`}
            >
              {truth.viewerSubscribed ? <Check className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
              {truth.viewerSubscribed ? "Following" : "Subscribe"}
            </button>
          </div>

          {/* ─── Footer: author / admin controls ─── */}
          {truth.canDelete && (
            <div className="flex items-center gap-1 border-t border-[#2A261F] pt-3">
              <button
                type="button" onClick={onDelete} disabled={busy === "delete"}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#A94A4A] transition-colors hover:bg-[#2A1414] hover:text-[#D9534F] disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete post
              </button>
            </div>
          )}
        </div>
      </motion.article>

      {/* ─── Comments section ─── */}
      <div className="mt-5 rounded-[20px] border border-[#2A261F] bg-[#0D0F14] p-4 sm:p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#D6B06C]">
          <MessageCircle className="h-4 w-4" /> Comments ({comments.length})
        </h3>

        <div className="mb-4 flex items-end gap-2">
          <textarea
            id="comment-input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={2}
            placeholder={truth.signedIn ? "Add a comment..." : "Sign in to comment"}
            className="flex-1 resize-none rounded-xl border border-[#2A261F] bg-[#15171D] px-3 py-2 text-sm text-[#DEC196] placeholder:text-[#7F7666] focus:border-[#C89D42]/40 focus:outline-none"
          />
          <button
            type="button" onClick={onComment} disabled={submitting || !commentText.trim()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#C89D42] text-[#0D0F14] transition-opacity hover:opacity-90 disabled:opacity-40"
            aria-label="Send comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {comments.length === 0 && (
            <p className="py-4 text-center text-xs text-[#7F7666]">No comments yet. Be the first to comment.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(c.id)} text-[11px] font-bold text-white`}>
                {initials(c.displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-[#D6B06C]">{c.displayName || "Anonymous"}</span>
                  <span className="text-[11px] text-[#7F7666]">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="break-words text-[13px] leading-snug text-[#DEC196]">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Gift modal ─── */}
      <Dialog open={giftOpen} onOpenChange={setGiftOpen}>
        <DialogContent className="rounded-2xl border-[#2A261F] bg-[#0D0F14] text-[#DEC196] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#D6B06C]">Send a gift</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#7F7666]">Your accumulated points: <span className="font-semibold text-[#D6A838]">{truth.viewerPoints}</span></p>
          <div className="grid grid-cols-2 gap-2">
            {GIFTS.map((g) => {
              const Icon = g.icon;
              const affordable = truth.viewerPoints >= g.points;
              return (
                <button
                  key={g.id} type="button" disabled={!affordable || busy === `gift-${g.id}`}
                  onClick={() => onGift(g.id, g.points)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors ${
                    affordable ? "border-[#2A261F] bg-[#15171D] text-[#8A857A] hover:border-[#7A5A1F] hover:text-[#D6A838]" : "border-[#2A261F] bg-[#15171D] text-[#7F7666] opacity-40"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[12px] font-medium">{g.label}</span>
                  <span className="text-[10px] text-[#D6A838]">{g.points} pts</span>
                </button>
              );
            })}
          </div>
          {!truth.signedIn && <p className="text-center text-[11px] text-[#A94A4A]">Sign in to send gifts.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

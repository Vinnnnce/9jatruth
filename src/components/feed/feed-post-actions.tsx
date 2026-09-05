"use client";

// ─── FeedPostActions — Zone 6: reaction bar (like, comment, share, repost, gift, emoji) ───

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Check,
  Coffee,
  Gift,
  Heart,
  Link2,
  MessageCircle,
  Repeat2,
  Send,
  Share2,
  Star,
  Trophy,
} from "lucide-react";
import { formatCount } from "./types";

export const REACTIONS = [
  { emoji: "👏", label: "Celebrate" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "😂", label: "Haha" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😮", label: "Wow" },
  { emoji: "💪", label: "Strong" },
];

const GIFTS = [
  { id: "coffee", icon: Coffee, label: "Coffee" },
  { id: "star", icon: Star, label: "Star" },
  { id: "trophy", icon: Trophy, label: "Trophy" },
  { id: "heart", icon: Heart, label: "Heart" },
];

/** Floating heart burst when a post is liked. */
function LikeBurst({ show }: { show: number }) {
  return (
    <AnimatePresence>
      {show > 0 && (
        <span key={show} className="pointer-events-none absolute inset-0">
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = -90 + (i - 2) * 26;
            const rad = (angle * Math.PI) / 180;
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos(rad) * (26 + (i % 2) * 10),
                  y: Math.sin(rad) * (30 + (i % 3) * 8),
                  scale: [0.4, 0.9, 0.2],
                }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 text-feed-like"
              >
                <Heart className="h-3 w-3 fill-feed-like" />
              </motion.span>
            );
          })}
        </span>
      )}
    </AnimatePresence>
  );
}

type ActionButtonProps = {
  label: string;
  active?: boolean;
  activeClass?: string;
  count?: number;
  onClick?: () => void;
  children: React.ReactNode;
};

function ActionButton({
  label,
  active,
  activeClass = "text-feed-accent",
  count,
  onClick,
  children,
}: ActionButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={active}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onClick={onClick}
      className={`group/action relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 sm:px-3 ${
        active
          ? `${activeClass} hover:opacity-80`
          : "text-feed-muted hover:bg-feed-chip hover:text-feed-text"
      }`}
    >
      {children}
      {count != null && count > 0 && (
        <span key={count} className="tabular-nums">
          <motion.span
            initial={{ scale: 1.25, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="inline-block"
          >
            {formatCount(count)}
          </motion.span>
        </span>
      )}
    </motion.button>
  );
}

export function FeedPostActions({
  isLiked,
  isReposted,
  reaction,
  likeCount,
  commentCount,
  shareCount,
  repostCount,
  giftCount,
  onLike,
  onComment,
  onShare,
  onRepost,
  onGift,
  onReact,
}: {
  isLiked?: boolean;
  isReposted?: boolean;
  reaction?: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  repostCount: number;
  giftCount?: number;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onRepost?: () => void;
  onGift?: (giftId: string) => void;
  onReact?: (emoji: string | null) => void;
}) {
  const [burst, setBurst] = useState(0);
  const [likePulse, setLikePulse] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLike = useCallback(() => {
    const willLike = !isLiked;
    onLike?.();
    if (willLike) {
      setBurst((b) => b + 1);
      setLikePulse(true);
      window.setTimeout(() => setLikePulse(false), 500);
    }
  }, [isLiked, onLike]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* clipboard unavailable — still show feedback */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, []);

  return (
    <>
      <div className="feed-actions -mx-1 flex items-center justify-between sm:-mx-1.5">
        {/* Like */}
        <div className="relative">
          <LikeBurst show={burst} />
          <ActionButton
            label={isLiked ? "Unlike" : "Like"}
            active={isLiked}
            activeClass="text-feed-like"
            count={likeCount}
            onClick={handleLike}
          >
            <motion.span
              animate={likePulse ? { scale: [1, 1.45, 0.85, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={`inline-flex rounded-full ${
                isLiked ? "drop-shadow-[0_0_6px_rgba(255,59,48,0.45)]" : ""
              }`}
            >
              <Heart
                className={`h-[18px] w-[18px] transition-colors ${
                  isLiked ? "fill-feed-like text-feed-like" : "group-hover/action:text-feed-like"
                }`}
              />
            </motion.span>
          </ActionButton>

          {/* Active emoji reaction chip */}
          <AnimatePresence>
            {reaction && (
              <motion.span
                initial={{ opacity: 0, scale: 0.4, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                className="absolute -bottom-1.5 -right-1 rounded-full border border-feed-border bg-feed-card px-1 py-0.5 text-[10px] shadow-sm"
              >
                {reaction}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Comment */}
        <ActionButton
          label="Comment"
          count={commentCount}
          onClick={onComment}
        >
          <MessageCircle className="h-[18px] w-[18px] transition-colors group-hover/action:text-feed-accent" />
        </ActionButton>

        {/* Repost */}
        <ActionButton
          label={isReposted ? "Undo repost" : "Repost"}
          active={isReposted}
          activeClass="text-feed-repost"
          count={repostCount}
          onClick={onRepost}
        >
          <Repeat2
            className={`h-[19px] w-[19px] transition-colors ${
              isReposted ? "" : "group-hover/action:text-feed-repost"
            }`}
          />
        </ActionButton>

        {/* Share */}
        <ActionButton label="Share" count={shareCount} onClick={() => setShareOpen(true)}>
          <Share2 className="h-[17px] w-[17px] transition-colors group-hover/action:text-feed-accent" />
        </ActionButton>

        {/* Gift — popover trigger is the outer button (Radix requires it) */}
        <Popover open={giftOpen} onOpenChange={setGiftOpen}>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              aria-label="Send a gift"
              aria-pressed={(giftCount ?? 0) > 0}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className={`group/action relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 sm:px-3 ${
                (giftCount ?? 0) > 0
                  ? "text-feed-gift hover:opacity-80"
                  : "text-feed-muted hover:bg-feed-chip hover:text-feed-text"
              }`}
            >
              <motion.span
                whileHover={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.4 }}
                className="inline-flex"
              >
                <Gift className="h-[17px] w-[17px] transition-colors group-hover/action:text-feed-gift" />
              </motion.span>
              {giftCount != null && giftCount > 0 && (
                <span className="tabular-nums">
                  <motion.span
                    initial={{ scale: 1.25, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="inline-block"
                  >
                    {formatCount(giftCount)}
                  </motion.span>
                </span>
              )}
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={8}
            className="w-auto rounded-xl p-2"
          >
            <p className="mb-1.5 px-1 text-xs font-medium text-feed-muted">
              Send a gift
            </p>
            <div className="flex gap-1">
              {GIFTS.map((g) => (
                <motion.button
                  key={g.id}
                  type="button"
                  whileHover={{ scale: 1.15, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label={`Send ${g.label} gift`}
                  onClick={() => {
                    onGift?.(g.id);
                    setGiftOpen(false);
                  }}
                  className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-feed-muted transition-colors hover:bg-feed-chip hover:text-feed-gift"
                >
                  <g.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{g.label}</span>
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji reaction */}
        <Popover>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              aria-label="React with emoji"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="rounded-full px-2.5 py-1.5 text-feed-muted transition-colors hover:bg-feed-chip"
            >
              <motion.span
                aria-hidden
                animate={{ rotate: [0, 10, -10, 6, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.6 }}
                className="inline-block text-[15px] leading-none"
              >
                🙂
              </motion.span>
            </motion.button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={8}
            className="w-auto rounded-full p-1.5"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 26 }}
              className="flex gap-0.5"
            >
              {REACTIONS.map((r) => (
                <motion.button
                  key={r.emoji}
                  type="button"
                  aria-label={`React ${r.label}`}
                  whileHover={{ scale: 1.3, y: -4 }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 600, damping: 18 }}
                  onClick={() => onReact?.(reaction === r.emoji ? null : r.emoji)}
                  className={`rounded-full px-2 py-1 text-lg transition-colors ${
                    reaction === r.emoji ? "bg-feed-chip" : "hover:bg-feed-chip"
                  }`}
                >
                  {r.emoji}
                </motion.button>
              ))}
            </motion.div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Share modal */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-left text-base">Share this post</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "WhatsApp", className: "bg-[#25D366]", icon: "💬" },
              { label: "X", className: "bg-black dark:bg-white", icon: "𝕏" },
              { label: "Facebook", className: "bg-[#1877F2]", icon: "f" },
              { label: "Telegram", className: "bg-[#229ED9]", icon: "✈️" },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => onShare?.()}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white transition-transform hover:scale-105 active:scale-95 ${s.className}`}
                >
                  {s.icon}
                </span>
                <span className="text-[11px] font-medium text-feed-muted">{s.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-2 flex items-center justify-between rounded-xl border border-feed-border bg-feed-chip/50 px-3.5 py-2.5 text-sm text-feed-muted transition-colors hover:border-feed-accent/40"
          >
            <span className="flex items-center gap-2 truncate">
              <Link2 className="h-4 w-4 shrink-0" />
              <span className="truncate">Copy post link</span>
            </span>
            {copied ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <Send className="h-4 w-4 shrink-0" />
            )}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

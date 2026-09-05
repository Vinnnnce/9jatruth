"use client";

// ─── FeedPostFooter — Zone 7: comments preview + threaded comments ───

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, CornerDownRight, Heart, MessageCircle } from "lucide-react";
import type { FeedComment } from "./types";
import { formatCount, timeAgo } from "./types";

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-lime-400",
  "from-purple-500 to-fuchsia-400",
  "from-orange-500 to-amber-400",
  "from-rose-500 to-pink-400",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function MiniAvatar({ user }: { user: FeedComment["user"] }) {
  return (
    <Avatar className="h-7 w-7 shrink-0">
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.displayName} /> : null}
      <AvatarFallback
        className={`bg-gradient-to-br ${gradientFor(user.id)} text-[10px] font-semibold text-white`}
      >
        {user.displayName
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

/** A single comment with its nested replies (threaded, collapsible). */
function CommentThread({ comment, depth = 0 }: { comment: FeedComment; depth?: number }) {
  const [showReplies, setShowReplies] = useState(false);
  const [liked, setLiked] = useState(false);
  const replies = comment.replies ?? [];

  return (
    <div className={depth > 0 ? "ml-7 sm:ml-9" : ""}>
      <div className="flex gap-2">
        <MiniAvatar user={comment.user} />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-md bg-feed-chip/70 px-3 py-2">
            <p className="text-[13px] font-semibold leading-tight text-feed-text">
              {comment.user.displayName}
              <span className="ml-1.5 font-normal text-feed-muted">
                @{comment.user.handle} · {timeAgo(comment.createdAt)}
              </span>
            </p>
            <p className="mt-0.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-feed-text/90">
              {comment.content}
            </p>
          </div>
          <div className="mt-1 flex items-center gap-3 pl-1">
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              aria-label={liked ? "Unlike comment" : "Like comment"}
              className={`inline-flex items-center gap-1 text-[11px] font-medium transition-colors ${
                liked ? "text-feed-like" : "text-feed-muted hover:text-feed-like"
              }`}
            >
              <Heart className={`h-3 w-3 ${liked ? "fill-feed-like" : ""}`} />
              {(comment.likeCount ?? 0) + (liked ? 1 : 0) > 0 &&
                formatCount((comment.likeCount ?? 0) + (liked ? 1 : 0))}
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-feed-muted transition-colors hover:text-feed-accent"
            >
              Reply
            </button>
          </div>

          {replies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              aria-expanded={showReplies}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-feed-accent transition-colors hover:text-feed-accent/80"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${showReplies ? "rotate-180" : ""}`}
              />
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showReplies && replies.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 border-l-2 border-feed-border pl-2">
              {replies.map((r) => (
                <div key={r.id} className="flex items-start gap-1.5">
                  <CornerDownRight className="mt-1 h-3 w-3 shrink-0 text-feed-muted/60" />
                  <CommentThread comment={r} depth={depth + 1} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FeedPostFooter({
  comments,
  commentCount,
  expanded,
  onToggle,
}: {
  comments?: FeedComment[];
  commentCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const topComment = comments?.[0];

  return (
    <footer className="feed-footer border-t border-feed-border/80 pt-3">
      {!expanded && topComment ? (
        /* Collapsed: top-comment preview + view-all link */
        <button
          type="button"
          onClick={onToggle}
          className="group flex w-full items-start gap-2 rounded-lg p-1 text-left transition-colors hover:bg-feed-chip/40"
        >
          <MiniAvatar user={topComment.user} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] leading-snug text-feed-text/90">
              <span className="font-semibold text-feed-text">
                {topComment.user.displayName}
              </span>{" "}
              {topComment.content}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-3 text-[12px] text-feed-muted">
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                View all {formatCount(commentCount)} comments
              </span>
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-feed-accent transition-colors hover:text-feed-accent/80"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {expanded ? "Hide comments" : `View all ${formatCount(commentCount)} comments`}
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && comments && comments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {comments.map((c) => (
                <CommentThread key={c.id} comment={c} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}

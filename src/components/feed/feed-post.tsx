"use client";

// ─── FeedPost — the redesigned 9jatruth feed post card ───
// Zones: header → content → media → meta → actions → footer.
// Self-contained interaction state (optimistic) with optional
// controlled callbacks for wiring to the API layer.

import { useState } from "react";
import { motion } from "framer-motion";
import { FeedPostHeader } from "./feed-post-header";
import { FeedPostContent } from "./feed-post-content";
import { FeedPostMedia } from "./feed-post-media";
import { FeedPostMeta } from "./feed-post-meta";
import { FeedPostActions } from "./feed-post-actions";
import { FeedPostFooter } from "./feed-post-footer";
import type { FeedLocation, FeedPostData, FeedUser } from "./types";

export interface FeedPostProps {
  post: FeedPostData;
  /** Index in the feed — used for staggered entrance animation. */
  index?: number;
  /** Disable entrance animation (e.g. inside virtualized lists). */
  animateOnMount?: boolean;
  onLike?: (post: FeedPostData) => void;
  onComment?: (post: FeedPostData) => void;
  onShare?: (post: FeedPostData) => void;
  onRepost?: (post: FeedPostData) => void;
  onGift?: (post: FeedPostData, giftId: string) => void;
  onReact?: (post: FeedPostData, emoji: string | null) => void;
  onBookmark?: (post: FeedPostData) => void;
  onHide?: (post: FeedPostData) => void;
  onReport?: (post: FeedPostData) => void;
  onOpenProfile?: (user: FeedUser) => void;
  onLocationClick?: (loc: FeedLocation) => void;
  onCategoryClick?: (category: string) => void;
}

export function FeedPost({
  post,
  index = 0,
  animateOnMount = true,
  onLike,
  onComment,
  onShare,
  onRepost,
  onGift,
  onReact,
  onBookmark,
  onHide,
  onReport,
  onOpenProfile,
  onLocationClick,
  onCategoryClick,
}: FeedPostProps) {
  // Optimistic local interaction state
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [isReposted, setIsReposted] = useState(post.isReposted ?? false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked ?? false);
  const [reaction, setReaction] = useState(post.reaction ?? null);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [giftCount, setGiftCount] = useState(post.giftCount ?? 0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard?.writeText(
      typeof window !== "undefined" ? window.location.href : ""
    ).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1500);
  };

  return (
    <motion.article
      initial={animateOnMount ? { opacity: 0, y: 20 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.35,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: Math.min(index, 4) * 0.06,
      }}
      className="feed-post group/post rounded-2xl border border-feed-border bg-feed-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] sm:p-5"
    >
      <div className="flex flex-col gap-3">
        {/* Zone 1 — Header */}
        <FeedPostHeader
          user={post.user}
          createdAt={post.createdAt}
          isBookmarked={isBookmarked}
          onBookmark={() => {
            setIsBookmarked((v) => !v);
            onBookmark?.(post);
          }}
          onHide={() => onHide?.(post)}
          onReport={() => onReport?.(post)}
          onCopyLink={handleCopyLink}
          onOpenProfile={onOpenProfile}
        />

        {/* Zone 2 — Content */}
        <FeedPostContent text={post.text} />

        {/* Zone 3 — Media (optional) */}
        <FeedPostMedia media={post.media} linkPreview={post.linkPreview} />

        {/* Zone 4 — Meta (location, AI tags, category, source) */}
        <FeedPostMeta
          location={post.location}
          aiTags={post.aiTags}
          category={post.category}
          source={post.source}
          onLocationClick={onLocationClick}
          onCategoryClick={onCategoryClick}
        />

        {/* Zone 5 — Engagement */}
        <FeedPostActions
          isLiked={isLiked}
          isReposted={isReposted}
          reaction={reaction}
          likeCount={likeCount}
          commentCount={post.commentCount}
          shareCount={shareCount}
          repostCount={repostCount}
          giftCount={giftCount}
          onLike={() => {
            setIsLiked((v) => !v);
            setLikeCount((c) => c + (isLiked ? -1 : 1));
            onLike?.(post);
          }}
          onComment={() => {
            setCommentsExpanded(true);
            onComment?.(post);
          }}
          onShare={() => {
            setShareCount((c) => c + 1);
            onShare?.(post);
          }}
          onRepost={() => {
            setIsReposted((v) => !v);
            setRepostCount((c) => c + (isReposted ? -1 : 1));
            onRepost?.(post);
          }}
          onGift={(giftId) => {
            setGiftCount((c) => c + 1);
            onGift?.(post, giftId);
          }}
          onReact={(emoji) => {
            setReaction(emoji);
            onReact?.(post, emoji);
          }}
        />

        {/* Zone 6 — Footer (comments) */}
        <FeedPostFooter
          comments={post.comments}
          commentCount={post.commentCount}
          expanded={commentsExpanded}
          onToggle={() => setCommentsExpanded((v) => !v)}
        />
      </div>

      {/* Screen-reader announcement for link copy */}
      <span aria-live="polite" className="sr-only">
        {copiedLink ? "Post link copied" : ""}
      </span>
    </motion.article>
  );
}

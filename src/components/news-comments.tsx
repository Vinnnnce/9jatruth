"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Reply,
  Send,
  Smile,
  Image as ImageIcon,
  Sticker,
  Gift,
  Bold,
  Italic,
  Loader2,
  ChevronDown,
} from "lucide-react";

// ─── Types ───

type Comment = {
  id: number;
  articleId: number;
  authorName: string;
  authorAvatar?: string | null;
  content: string; // HTML
  imageUrl?: string | null;
  sticker?: string | null;
  gift?: { name: string; icon: string } | null;
  likeCount: number;
  liked?: boolean;
  createdAt: string;
  replyCount?: number;
  replies?: Comment[];
};

// ─── Static pickers data ───

const EMOJIS = [
  "😀", "😂", "🥰", "😍", "😎", "🤔", "😢", "😭", "😡", "👍",
  "👎", "👏", "🙏", "🔥", "💯", "✨", "🎉", "💪", "🤝", "❤️",
  "🇳🇬", "⭐", "💡", "🚀", "👀", "🤣", "😅", "🥳", "😇", "🤗",
];

const STICKERS = [
  { id: "s1", url: "https://placehold.co/80x80/6366f1/white?text=🔥" },
  { id: "s2", url: "https://placehold.co/80x80/ec4899/white?text=❤️" },
  { id: "s3", url: "https://placehold.co/80x80/22c55e/white?text=👍" },
  { id: "s4", url: "https://placehold.co/80x80/f59e0b/white?text=🎉" },
  { id: "s5", url: "https://placehold.co/80x80/8b5cf6/white?text=✨" },
  { id: "s6", url: "https://placehold.co/80x80/06b6d4/white?text=🚀" },
];

const GIFTS = [
  { id: "g1", name: "Rose", icon: "🌹" },
  { id: "g2", name: "Trophy", icon: "🏆" },
  { id: "g3", name: "Cake", icon: "🎂" },
  { id: "g4", name: "Star", icon: "⭐" },
  { id: "g5", name: "Diamond", icon: "💎" },
  { id: "g6", name: "Heart", icon: "💖" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Rich Text Toolbar ───

function RichToolbar({
  onBold,
  onItalic,
  onEmoji,
  onSticker,
  onGift,
  onImage,
}: {
  onBold: () => void;
  onItalic: () => void;
  onEmoji: (e: string) => void;
  onSticker: (s: string) => void;
  onGift: (g: { name: string; icon: string }) => void;
  onImage: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-t border-border p-1.5 bg-muted/30">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onBold} title="Bold">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onItalic} title="Italic">
        <Italic className="h-3.5 w-3.5" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Emoji">
            <Smile className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="grid grid-cols-6 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onEmoji(e)}
                className="text-lg rounded hover:bg-muted p-1 transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Sticker">
            <Sticker className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="grid grid-cols-3 gap-2">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => onSticker(s.url)}
                className="rounded hover:bg-muted p-1 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="sticker" className="w-full h-auto" />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Gift">
            <Gift className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="start">
          <div className="grid grid-cols-3 gap-2">
            {GIFTS.map((g) => (
              <button
                key={g.id}
                onClick={() => onGift({ name: g.name, icon: g.icon })}
                className="flex flex-col items-center gap-0.5 rounded p-2 hover:bg-muted transition-colors"
              >
                <span className="text-2xl">{g.icon}</span>
                <span className="text-[9px] text-muted-foreground">{g.name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onImage} title="Image">
        <ImageIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Comment Item ───

function CommentItem({
  comment,
  articleSlug,
  onLike,
  onReply,
}: {
  comment: Comment;
  articleSlug: string;
  onLike: (id: number) => void;
  onReply: (parentId: number, content: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setReplying(false);
    setShowReplies(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-3"
    >
      <Avatar className="h-8 w-8 shrink-0">
        {comment.authorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.authorAvatar} alt={comment.authorName} className="h-full w-full object-cover rounded-full" />
        ) : null}
        <AvatarFallback className="text-[10px]">
          {comment.authorName?.slice(0, 2).toUpperCase() || "AN"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{comment.authorName || "Anonymous"}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
        </div>
        {/* Rich text content */}
        <div
          className="text-xs prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: comment.content }}
        />
        {/* Image attachment */}
        {comment.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.imageUrl}
            alt="attachment"
            className="max-w-xs rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(comment.imageUrl!, "_blank")}
          />
        )}
        {/* Sticker */}
        {comment.sticker && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.sticker} alt="sticker" className="w-16 h-16" />
        )}
        {/* Gift */}
        {comment.gift && (
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12 }}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5"
          >
            <span className="text-base">{comment.gift.icon}</span>
            <span className="text-[10px] text-amber-600 font-medium">{comment.gift.name}</span>
          </motion.div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 1.3 }}
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1 text-[10px] transition-colors ${
              comment.liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`h-3 w-3 ${comment.liked ? "fill-red-500" : ""}`} />
            {comment.likeCount}
          </motion.button>
          <button
            onClick={() => setReplying((r) => !r)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Reply className="h-3 w-3" />
            Reply
          </button>
          {(comment.replyCount ?? 0) > 0 && (
            <button
              onClick={() => setShowReplies((s) => !s)}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showReplies ? "rotate-180" : ""}`} />
              {comment.replyCount} replies
            </button>
          )}
        </div>

        {/* Inline reply form */}
        <AnimatePresence>
          {replying && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 pt-1"
            >
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                }}
                placeholder={`Reply to ${comment.authorName}...`}
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2" onClick={handleSubmitReply}>
                <Send className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nested replies (one level deep) */}
        <AnimatePresence>
          {showReplies && comment.replies && comment.replies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 pl-4 border-l border-border"
            >
              {comment.replies.map((reply) => (
                <motion.div
                  key={reply.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[9px]">
                      {reply.authorName?.slice(0, 2).toUpperCase() || "AN"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium">{reply.authorName || "Anonymous"}</span>
                      <span className="text-[9px] text-muted-foreground">{timeAgo(reply.createdAt)}</span>
                    </div>
                    <div
                      className="text-[11px] text-foreground"
                      dangerouslySetInnerHTML={{ __html: reply.content }}
                    />
                    {reply.gift && (
                      <span className="inline-flex items-center gap-0.5 text-xs">
                        {reply.gift.icon} <span className="text-[9px] text-amber-600">{reply.gift.name}</span>
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main Comments Component ───

export function NewsComments({ articleSlug }: { articleSlug: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [pendingSticker, setPendingSticker] = useState<string | null>(null);
  const [pendingGift, setPendingGift] = useState<{ name: string; icon: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const queryKey = ["/api/news/comments", articleSlug];

  const { data, isLoading } = useQuery<{ comments: Comment[]; total: number; totalLikes: number }>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/news/comments?slug=${articleSlug}`);
      return res.json();
    },
  });

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;
  const totalLikes = data?.totalLikes ?? 0;

  const focusEditor = () => editorRef.current?.focus();

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    focusEditor();
  };

  const insertText = (text: string) => {
    focusEditor();
    document.execCommand("insertText", false, text);
  };

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          exec("insertImage", data.url);
        }
      } catch {
        toast({ title: "Image upload failed", variant: "destructive" });
      }
    };
    input.click();
  };

  const handleSubmit = async () => {
    const content = editorRef.current?.innerHTML?.trim() || "";
    if (!content || content === "<br>") {
      toast({ title: "Comment cannot be empty", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/news/comments", {
        slug: articleSlug,
        content,
        sticker: pendingSticker,
        gift: pendingGift,
      });
      editorRef.current!.innerHTML = "";
      setPendingSticker(null);
      setPendingGift(null);
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Comment posted" });
    } catch {
      toast({ title: "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = (commentId: number) => {
    apiRequest("POST", `/api/news/comments/${commentId}/like`).catch(() => {});
    queryClient.invalidateQueries({ queryKey });
  };

  const handleReply = (parentId: number, content: string) => {
    apiRequest("POST", `/api/news/comments/${parentId}/reply`, { content, slug: articleSlug })
      .then(() => {
        queryClient.invalidateQueries({ queryKey });
      })
      .catch(() => {
        toast({ title: "Reply failed", variant: "destructive" });
      });
  };

  return (
    <div className="space-y-4">
      {/* ─── Summary ─── */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-display font-700 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Comments
        </h3>
        <Badge variant="secondary" className="text-[10px]">{total} comments</Badge>
        <Badge variant="outline" className="text-[10px] gap-0.5">
          <Heart className="h-2.5 w-2.5" />
          {totalLikes} likes
        </Badge>
      </div>

      {/* ─── Rich text composer ─── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write a comment..."
          className="min-h-[80px] p-3 text-sm prose prose-sm max-w-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60"
        />
        {pendingGift && (
          <div className="px-3 py-1.5 bg-amber-500/5 flex items-center gap-2 text-xs">
            <span>{pendingGift.icon}</span>
            <span className="text-amber-600">Sending {pendingGift.name}</span>
            <button
              onClick={() => setPendingGift(null)}
              className="text-muted-foreground hover:text-foreground ml-auto"
            >
              remove
            </button>
          </div>
        )}
        {pendingSticker && (
          <div className="px-3 py-1.5 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingSticker} alt="sticker" className="w-10 h-10" />
            <button
              onClick={() => setPendingSticker(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              remove
            </button>
          </div>
        )}
        <RichToolbar
          onBold={() => exec("bold")}
          onItalic={() => exec("italic")}
          onEmoji={(e) => insertText(e)}
          onSticker={(s) => setPendingSticker(s)}
          onGift={(g) => setPendingGift(g)}
          onImage={handleImageUpload}
        />
        <div className="flex justify-end p-2 border-t border-border bg-muted/30">
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Post Comment
          </Button>
        </div>
      </div>

      {/* ─── Comment list ─── */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                articleSlug={articleSlug}
                onLike={handleLike}
                onReply={handleReply}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default NewsComments;

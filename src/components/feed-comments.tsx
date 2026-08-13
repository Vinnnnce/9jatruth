"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquare, Loader2, Send, Heart, Reply, Image as ImageIcon,
  Smile, Gift, Sticker,
} from "lucide-react";
import { useUser } from "@/lib/use-user-safe";
import { useToast } from "@/components/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export type Comment = {
  id: number;
  truthId: number;
  userHash: string;
  content: string;
  imageUrl?: string | null;
  stickerId?: string | null;
  giftId?: string | null;
  parentCommentId?: number | null;
  likeCount?: number;
  replyCount?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const EMOJIS = ["😀", "😂", "❤️", "👍", "🔥", "👏", "🎉", "😍", "🤔", "😢", "😡", "💪", "🙏", "✨", "💯", "🚀"];
const STICKERS = ["sticker_like", "sticker_love", "sticker_haha", "sticker_wow", "sticker_sad", "sticker_angry"];
const GIFTS = ["gift_coffee", "gift_flower", "gift_star", "gift_trophy", "gift_heart"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function truncateHash(hash: string): string {
  return hash ? hash.slice(0, 8) : "anonymous";
}

function renderContent(content: string): React.ReactNode {
  // Render content with basic HTML sanitization for rich text
  return <span dangerouslySetInnerHTML={{ __html: content.replace(/<script[^>]*>.*?<\/script>/gi, "") }} />;
}

export function FeedComments({
  truthId,
  commentCount,
  setCommentCount,
}: {
  truthId: number;
  commentCount: number;
  setCommentCount: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [stickerId, setStickerId] = useState("");
  const [giftId, setGiftId] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery<Comment[]>({
    queryKey: [`/api/truths/${truthId}/comments`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/truths/${truthId}/comments`);
      return res.json();
    },
    enabled: open,
  });

  const comments = commentsQuery.data ?? [];
  const liveCount = comments.length || commentCount;
  const topLevelComments = comments.filter((c) => !c.parentCommentId);
  const replies = (parentId: number) => comments.filter((c) => c.parentCommentId === parentId);

  const addCommentMutation = useMutation({
    mutationFn: async (data: { content: string; imageUrl?: string; stickerId?: string; giftId?: string; parentCommentId?: number }) => {
      const res = await apiRequest("POST", `/api/truths/${truthId}/comments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/truths/${truthId}/comments`] });
      setContent("");
      setImageUrl("");
      setStickerId("");
      setGiftId("");
      setReplyTo(null);
      setReplyContent({});
      toast({ title: "Comment posted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to post comment", description: error.message, variant: "destructive" });
    },
  });

  const likeCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await apiRequest("POST", `/api/truths/${truthId}/comments/${commentId}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/truths/${truthId}/comments`] });
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast({ title: "Comment cannot be empty", variant: "destructive" });
      return;
    }
    addCommentMutation.mutate({ content: content.trim(), imageUrl: imageUrl || undefined, stickerId: stickerId || undefined, giftId: giftId || undefined });
  };

  const handleReply = (commentId: number) => {
    const replyText = replyContent[commentId];
    if (!replyText?.trim()) return;
    addCommentMutation.mutate({ content: replyText.trim(), parentCommentId: commentId });
  };

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          data-testid={`button-comment-${truthId}`}
          title="Comment"
          aria-label="Comment"
        >
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          {liveCount > 0 && (
            <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
              {liveCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments ({comments.length})</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {commentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : topLevelComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            <AnimatePresence>
              {topLevelComments.map((c, idx) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex gap-2">
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      {truncateHash(c.userHash).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium font-mono">{truncateHash(c.userHash)}</span>
                        <span className="text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="text-sm break-words bg-muted/50 rounded-lg px-3 py-2">
                        {renderContent(c.content)}
                      </div>
                      {c.imageUrl && (
                        <img src={c.imageUrl} alt="Comment image" className="max-w-[200px] rounded-lg border" />
                      )}
                      {c.stickerId && (
                        <div className="inline-flex items-center gap-1 bg-primary/10 rounded px-2 py-1 text-xs">
                          <Sticker className="h-3 w-3" /> {c.stickerId}
                        </div>
                      )}
                      {c.giftId && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="inline-flex items-center gap-1 bg-amber-500/10 rounded px-2 py-1 text-xs"
                        >
                          <Gift className="h-3 w-3 text-amber-500" /> {c.giftId}
                        </motion.div>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        <button
                          onClick={() => likeCommentMutation.mutate(c.id)}
                          className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <motion.span whileTap={{ scale: 1.3 }}>
                            <Heart className="h-3 w-3" />
                          </motion.span>
                          <span>{c.likeCount ?? 0}</span>
                        </button>
                        <button
                          onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                          className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Reply className="h-3 w-3" /> Reply
                          {c.replyCount ? ` (${c.replyCount})` : ""}
                        </button>
                      </div>

                      {/* Replies */}
                      {replies(c.id).length > 0 && (
                        <div className="ml-4 space-y-2 border-l-2 border-border pl-3">
                          {replies(c.id).map((r) => (
                            <div key={r.id} className="flex gap-2">
                              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium shrink-0">
                                {truncateHash(r.userHash).slice(0, 2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-medium font-mono text-[10px]">{truncateHash(r.userHash)}</span>
                                  <span className="text-muted-foreground text-[10px]">{timeAgo(r.createdAt)}</span>
                                </div>
                                <div className="text-sm break-words bg-muted/30 rounded-lg px-2 py-1">
                                  {renderContent(r.content)}
                                </div>
                                {r.imageUrl && (
                                  <img src={r.imageUrl} alt="Reply image" className="max-w-[150px] rounded-lg border" />
                                )}
                                <div className="flex items-center gap-2 text-xs">
                                  <button
                                    onClick={() => likeCommentMutation.mutate(r.id)}
                                    className="flex items-center gap-1 text-muted-foreground hover:text-red-500 transition-colors"
                                  >
                                    <Heart className="h-3 w-3" /> {r.likeCount ?? 0}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline reply form */}
                      {replyTo === c.id && (
                        <div className="flex gap-2 items-end">
                          <Textarea
                            value={replyContent[c.id] || ""}
                            onChange={(e) => setReplyContent({ ...replyContent, [c.id]: e.target.value })}
                            placeholder="Write a reply..."
                            className="min-h-[36px] text-sm"
                            rows={1}
                          />
                          <Button size="sm" onClick={() => handleReply(c.id)} disabled={addCommentMutation.isPending}>
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Rich comment input */}
        <div className="space-y-2 pt-2 border-t">
          {isLoaded && !isSignedIn ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              Sign in to leave a comment.
            </p>
          ) : (
            <>
              <div className="relative">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write a comment..."
                  className="min-h-[60px] text-sm pr-32"
                  rows={2}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  {/* Emoji picker */}
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Emoji">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map((e) => (
                          <button key={e} onClick={() => insertEmoji(e)} className="text-lg hover:bg-muted rounded p-1">
                            {e}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Sticker picker */}
                  <Popover open={showStickerPicker} onOpenChange={setShowStickerPicker}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Sticker">
                        <Sticker className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48">
                      <div className="grid grid-cols-3 gap-1">
                        {STICKERS.map((s) => (
                          <button
                            key={s}
                            onClick={() => { setStickerId(s); setShowStickerPicker(false); }}
                            className="text-xs hover:bg-muted rounded p-2"
                          >
                            {s.replace("sticker_", "")}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Gift picker */}
                  <Popover open={showGiftPicker} onOpenChange={setShowGiftPicker}>
                    <PopoverTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Gift">
                        <Gift className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48">
                      <div className="grid grid-cols-3 gap-1">
                        {GIFTS.map((g) => (
                          <button
                            key={g}
                            onClick={() => { setGiftId(g); setShowGiftPicker(false); }}
                            className="text-xs hover:bg-muted rounded p-2"
                          >
                            {g.replace("gift_", "")}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Image URL input */}
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="text-sm h-8"
              />

              {/* Selected attachments preview */}
              {(stickerId || giftId) && (
                <div className="flex items-center gap-2 text-xs">
                  {stickerId && (
                    <span className="bg-primary/10 rounded px-2 py-0.5 flex items-center gap-1">
                      <Sticker className="h-3 w-3" /> {stickerId}
                      <button onClick={() => setStickerId("")} className="ml-1 text-muted-foreground">×</button>
                    </span>
                  )}
                  {giftId && (
                    <span className="bg-amber-500/10 rounded px-2 py-0.5 flex items-center gap-1">
                      <Gift className="h-3 w-3 text-amber-500" /> {giftId}
                      <button onClick={() => setGiftId("")} className="ml-1 text-muted-foreground">×</button>
                    </span>
                  )}
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || addCommentMutation.isPending}
                className="w-full"
                size="sm"
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" /> Post Comment
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

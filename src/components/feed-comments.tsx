"use client";

import { useState } from "react";
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
import { MessageSquare, Loader2, Send } from "lucide-react";
import { useUser } from "@/lib/use-user-safe";
import { useToast } from "@/components/hooks/use-toast";

export type Comment = {
  id: number;
  truthId: number;
  userHash: string;
  content: string;
  parentCommentId?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

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

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/truths/${truthId}/comments`, {
        content: content.trim(),
      });
      return res.json();
    },
    onSuccess: (newComment: Comment) => {
      queryClient.setQueryData<Comment[]>(
        [`/api/truths/${truthId}/comments`],
        (old) => [...(old ?? []), newComment]
      );
      setCommentCount((comments.length || commentCount) + 1);
      setContent("");
      toast({ title: "Comment posted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to post comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          data-testid={`button-comment-${truthId}`}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Comment
          {liveCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-muted text-[10px] font-medium">
              {liveCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments ({comments.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {commentsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No comments yet. Be the first to comment.
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                  {truncateHash(c.userHash).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium font-mono">
                      {truncateHash(c.userHash)}
                    </span>
                    <span className="text-muted-foreground">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm break-words">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="space-y-2 pt-2 border-t">
          {isLoaded && !isSignedIn ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Sign in to comment on this post.
            </p>
          ) : (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write a comment..."
                className="min-h-[70px] text-sm resize-none"
                data-testid={`textarea-comment-${truthId}`}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={
                  !content.trim() || addCommentMutation.isPending
                }
                onClick={() => addCommentMutation.mutate()}
                data-testid={`button-submit-comment-${truthId}`}
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3 w-3 mr-1" />
                )}
                Post Comment
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

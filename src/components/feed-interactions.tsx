"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Heart, Share2, UserPlus, UserCheck } from "lucide-react";
import { useUser } from "@/lib/use-user-safe";
import { useToast } from "@/components/hooks/use-toast";
import { FeedComments } from "@/components/feed-comments";

type Truth = {
  id: number;
  userHash: string;
  createdAt: string;
};

function buildShareUrl(truthId: number): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/feeds?truth=${truthId}`;
  }
  return `/feeds?truth=${truthId}`;
}

export function FeedInteractions({
  truth,
  currentUserHash,
}: {
  truth: Truth;
  currentUserHash?: string | null;
}) {
  const { isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  const isOwnPost =
    currentUserHash && truth.userHash === currentUserHash;

  // Like mutation with optimistic update
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (liked) {
        const res = await apiRequest(
          "DELETE",
          `/api/truths/${truth.id}/like`
        );
        return res.json();
      }
      const res = await apiRequest("POST", `/api/truths/${truth.id}/like`);
      return res.json();
    },
    onMutate: () => {
      // Optimistic toggle
      const prev = { liked, likeCount };
      setLiked(!liked);
      setLikeCount((c) => c + (liked ? -1 : 1));
      return prev;
    },
    onSuccess: (data: { liked: boolean; likeCount: number }) => {
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    },
    onError: (_e, _v, prev) => {
      // Rollback
      if (prev) {
        setLiked(prev.liked);
        setLikeCount(prev.likeCount);
      }
      toast({
        title: "Action failed",
        description: "Could not update like. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (subscribed) {
        const res = await apiRequest(
          "DELETE",
          `/api/users/${truth.userHash}/subscribe`
        );
        return res.json();
      }
      const res = await apiRequest(
        "POST",
        `/api/users/${truth.userHash}/subscribe`
      );
      return res.json();
    },
    onMutate: () => {
      const prev = { subscribed };
      setSubscribed(!subscribed);
      return prev;
    },
    onSuccess: (data: { subscribed: boolean; subscriberCount: number }) => {
      setSubscribed(data.subscribed);
      queryClient.invalidateQueries({ queryKey: ["/api/truths"] });
      toast({
        title: data.subscribed ? "Subscribed" : "Unsubscribed",
      });
    },
    onError: (_e, _v, prev) => {
      if (prev) setSubscribed(prev.subscribed);
      toast({
        title: "Action failed",
        description: "Could not update subscription.",
        variant: "destructive",
      });
    },
  });

  const handleLike = () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      toast({ title: "Sign in to like posts" });
      return;
    }
    likeMutation.mutate();
  };

  const handleSubscribe = () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      toast({ title: "Sign in to subscribe" });
      return;
    }
    subscribeMutation.mutate();
  };

  const handleShare = async () => {
    const url = buildShareUrl(truth.id);
    let shared = false;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Soke Truth Report",
          text: truth.userHash ? `Report from ${truth.userHash.slice(0, 8)}` : "Truth report",
          url,
        });
        shared = true;
      } catch {
        // user cancelled — don't record
        return;
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        shared = true;
        toast({ title: "Link copied!" });
      } catch {
        toast({
          title: "Could not copy link",
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({ title: "Sharing not supported on this device" });
      return;
    }

    // Record the share via the POST endpoint (public)
    if (shared) {
      try {
        const res = await apiRequest(
          "POST",
          `/api/truths/${truth.id}/share`,
          { channel: "link" }
        );
        const data = await res.json();
        if (typeof data.shareCount === "number") {
          setShareCount(data.shareCount);
        }
      } catch {
        // Sharing succeeded client-side; recording is best-effort
      }
    }
  };

  return (
    <>
      {/* Like */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleLike}
        disabled={likeMutation.isPending}
        data-testid={`button-like-${truth.id}`}
        className="h-7 text-xs"
      >
        <Heart
          className={`h-3 w-3 mr-1 ${liked ? "fill-red-500 text-red-500" : ""}`}
        />
        Like
        {likeCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-muted text-[10px] font-medium">
            {likeCount}
          </span>
        )}
      </Button>

      {/* Comment */}
      <FeedComments
        truthId={truth.id}
        commentCount={0}
        setCommentCount={() => {
          /* comment count tracked inside FeedComments */
        }}
      />

      {/* Share */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleShare}
        data-testid={`button-share-${truth.id}`}
        className="h-7 text-xs"
      >
        <Share2 className="h-3 w-3 mr-1" />
        Share
        {shareCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-muted text-[10px] font-medium">
            {shareCount}
          </span>
        )}
      </Button>

      {/* Subscribe (only for other users' posts) */}
      {!isOwnPost && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSubscribe}
          disabled={subscribeMutation.isPending}
          data-testid={`button-subscribe-${truth.id}`}
          className="h-7 text-xs"
        >
          {subscribed ? (
            <>
              <UserCheck className="h-3 w-3 mr-1 text-green-500" />
              Subscribed
            </>
          ) : (
            <>
              <UserPlus className="h-3 w-3 mr-1" />
              Subscribe
            </>
          )}
        </Button>
      )}
    </>
  );
}

"use client";

// ─── FeedPostHeader — Zone 1: avatar, identity, badges, timestamp, menu ───

import { useMemo } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BadgeCheck,
  Bookmark,
  Crown,
  Flag,
  Link2,
  MoreHorizontal,
  ShieldCheck,
  Star,
  Trophy,
  UserX,
} from "lucide-react";
import type { FeedBadgeType, FeedUser } from "./types";
import { formatCount, timeAgo } from "./types";

const BADGE_META: Record<
  FeedBadgeType,
  { label: string; icon: typeof Crown; classes: string; title: string }
> = {
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    classes: "text-feed-accent",
    title: "Verified identity",
  },
  premium: {
    label: "Premium",
    icon: Crown,
    classes: "text-amber-500",
    title: "Premium member",
  },
  superfan: {
    label: "Super Fan",
    icon: Star,
    classes: "text-purple-500",
    title: "Super Fan — top community supporter",
  },
  agency: {
    label: "Official Agency",
    icon: ShieldCheck,
    classes: "text-emerald-500",
    title: "Verified government agency",
  },
  "top-contributor": {
    label: "Top Contributor",
    icon: Trophy,
    classes: "text-orange-500",
    title: "Top contributor in your area",
  },
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-lime-400",
  "from-purple-500 to-fuchsia-400",
  "from-orange-500 to-amber-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-blue-400",
];

function gradientFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

type Props = {
  user: FeedUser;
  createdAt: string;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  onHide?: () => void;
  onReport?: () => void;
  onCopyLink?: () => void;
  onOpenProfile?: (user: FeedUser) => void;
};

export function FeedPostHeader({
  user,
  createdAt,
  isBookmarked,
  onBookmark,
  onHide,
  onReport,
  onCopyLink,
  onOpenProfile,
}: Props) {
  const absoluteDate = useMemo(
    () =>
      new Date(createdAt).toLocaleString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [createdAt]
  );

  return (
    <header className="flex items-start gap-3">
      {/* Avatar + hover mini-profile */}
      <HoverCard openDelay={350} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            aria-label={`Open ${user.displayName}'s profile`}
            onClick={() => onOpenProfile?.(user)}
            className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-feed-card transition-shadow focus-visible:ring-2 ring-feed-accent"
          >
            <Avatar className="h-11 w-11 rounded-full ring-2 ring-feed-border transition-all duration-200 hover:ring-feed-accent/60">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              ) : null}
              <AvatarFallback
                className={`rounded-full bg-gradient-to-br ${gradientFor(user.id)} font-semibold text-white`}
              >
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="top"
          align="start"
          className="w-64 rounded-xl border-feed-border p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.displayName} />
              ) : null}
              <AvatarFallback
                className={`bg-gradient-to-br ${gradientFor(user.id)} font-semibold text-white`}
              >
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-feed-text">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-feed-muted">@{user.handle}</p>
            </div>
          </div>
          {user.bio ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-feed-muted">
              {user.bio}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-4 text-xs text-feed-muted">
            {user.followers != null && (
              <span>
                <strong className="text-feed-text">{formatCount(user.followers)}</strong>{" "}
                followers
              </span>
            )}
            {user.trustScore != null && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <strong className="text-feed-text">{user.trustScore}%</strong> trust
              </span>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      {/* Identity stack */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenProfile?.(user)}>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="truncate text-[15px] font-semibold leading-tight text-feed-text hover:underline decoration-feed-muted/40 underline-offset-2">
            {user.displayName}
          </span>
          {(user.badges ?? []).map((b) => {
            const meta = BADGE_META[b];
            if (!meta) return null;
            const Icon = meta.icon;
            return (
              <Tooltip key={b}>
                <TooltipTrigger asChild>
                  <span
                    role="img"
                    aria-label={meta.title}
                    className={`inline-flex ${meta.classes}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {meta.title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 text-[13px] leading-tight text-feed-muted">
          <span className="truncate hover:text-feed-accent transition-colors">
            @{user.handle}
          </span>
          <span aria-hidden className="text-feed-muted/60">
            ·
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <time
                dateTime={createdAt}
                className="shrink-0 text-xs whitespace-nowrap hover:text-feed-text transition-colors"
              >
                {timeAgo(createdAt)}
              </time>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {absoluteDate}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Overflow menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Post options"
            className="-mr-1.5 -mt-1 rounded-full p-1.5 text-feed-muted transition-colors hover:bg-feed-chip hover:text-feed-text"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={onBookmark} className="gap-2 rounded-lg">
            <Bookmark
              className={`h-4 w-4 ${isBookmarked ? "text-feed-accent" : ""}`}
              fill={isBookmarked ? "currentColor" : "none"}
            />
            {isBookmarked ? "Remove bookmark" : "Bookmark post"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyLink} className="gap-2 rounded-lg">
            <Link2 className="h-4 w-4" /> Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onHide} className="gap-2 rounded-lg">
            <UserX className="h-4 w-4" /> Hide post
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onReport}
            className="gap-2 rounded-lg text-red-500 focus:text-red-500"
          >
            <Flag className="h-4 w-4" /> Report post
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

"use client";

// ─── FeedPostMedia — Zone 4 (optional): image grid, video, link preview ───

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Play } from "lucide-react";
import type { FeedLinkPreview, FeedMediaItem } from "./types";
import { formatDuration } from "./types";
import { MediaViewer } from "./media-viewer";

function VideoTile({
  item,
  onOpen,
  className,
}: {
  item: FeedMediaItem;
  onOpen: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const duration = formatDuration(item.durationSeconds);

  return (
    <div
      className={`group relative cursor-zoom-in overflow-hidden ${className ?? ""}`}
      onClick={onOpen}
      onMouseEnter={() => {
        const v = videoRef.current;
        if (v) {
          v.play().then(() => setPlaying(true)).catch(() => {});
        }
      }}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (v && !v.paused) {
          v.pause();
          v.currentTime = 0;
          setPlaying(false);
        }
      }}
    >
      <video
        ref={videoRef}
        src={item.url}
        poster={item.thumbnailUrl}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-200 group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5 fill-feed-text text-feed-text" />
          </span>
        </span>
      )}
      {duration && (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {duration}
        </span>
      )}
    </div>
  );
}

function ImageTile({
  item,
  onOpen,
  className,
  rounded,
}: {
  item: FeedMediaItem;
  onOpen: () => void;
  className?: string;
  rounded?: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={onOpen}
      aria-label={item.alt ?? "Open media"}
      className={`group relative cursor-zoom-in overflow-hidden bg-feed-chip ${rounded ?? ""} ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={item.alt ?? "Post media"}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
      />
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/5" />
    </motion.button>
  );
}

export function FeedPostMedia({
  media,
  linkPreview,
}: {
  media?: FeedMediaItem[];
  linkPreview?: FeedLinkPreview;
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (!media?.length && !linkPreview) return null;

  const items = media ?? [];
  const count = items.length;

  return (
    <div className="feed-media">
      {count > 0 && (
        <div
          className={`overflow-hidden rounded-2xl border border-feed-border shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${
            count === 1 ? "" : "grid gap-0.5 bg-feed-border"
          }`}
        >
          {count === 1 && (
            <>
              {items[0].type === "video" ? (
                <VideoTile item={items[0]} onOpen={() => setViewerIndex(0)} className="aspect-video" />
              ) : (
                <ImageTile
                  item={items[0]}
                  onOpen={() => setViewerIndex(0)}
                  className="max-h-[520px] min-h-[220px] w-full"
                  rounded="rounded-2xl"
                />
              )}
            </>
          )}

          {count === 2 && (
            <div className="grid grid-cols-2 gap-0.5">
              {items.map((m, i) =>
                m.type === "video" ? (
                  <VideoTile key={i} item={m} onOpen={() => setViewerIndex(i)} className="aspect-square" />
                ) : (
                  <ImageTile key={i} item={m} onOpen={() => setViewerIndex(i)} className="aspect-square" />
                )
              )}
            </div>
          )}

          {count === 3 && (
            <div className="grid grid-cols-2 gap-0.5">
              {items.map((m, i) =>
                m.type === "video" ? (
                  <VideoTile
                    key={i}
                    item={m}
                    onOpen={() => setViewerIndex(i)}
                    className={i === 0 ? "col-span-2 aspect-video" : "aspect-square"}
                  />
                ) : (
                  <ImageTile
                    key={i}
                    item={m}
                    onOpen={() => setViewerIndex(i)}
                    className={i === 0 ? "col-span-2 aspect-video" : "aspect-square"}
                  />
                )
              )}
            </div>
          )}

          {count >= 4 && (
            <div className="grid grid-cols-2 gap-0.5">
              {items.slice(0, 4).map((m, i) => (
                <div key={i} className="relative">
                  {m.type === "video" ? (
                    <VideoTile item={m} onOpen={() => setViewerIndex(i)} className="aspect-square" />
                  ) : (
                    <ImageTile item={m} onOpen={() => setViewerIndex(i)} className="aspect-square" />
                  )}
                  {i === 3 && count > 4 && (
                    <button
                      type="button"
                      onClick={() => setViewerIndex(3)}
                      className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-semibold text-white backdrop-blur-[1px] transition-colors hover:bg-black/55"
                    >
                      +{count - 4}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {linkPreview && (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex gap-3 overflow-hidden rounded-xl border border-feed-border bg-feed-chip/50 transition-all duration-200 hover:border-feed-accent/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          {linkPreview.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={linkPreview.thumbnailUrl}
              alt=""
              className="h-24 w-28 shrink-0 object-cover sm:h-28 sm:w-40"
            />
          ) : (
            <span className="flex h-24 w-28 shrink-0 items-center justify-center bg-feed-chip text-2xl sm:h-28 sm:w-40">
              📰
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-3">
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-feed-muted">
              {linkPreview.domain}
            </span>
            <span className="line-clamp-2 text-sm font-semibold leading-snug text-feed-text">
              {linkPreview.title}
            </span>
            {linkPreview.description && (
              <span className="line-clamp-2 text-xs leading-relaxed text-feed-muted">
                {linkPreview.description}
              </span>
            )}
          </span>
          <span className="flex items-center pr-3 text-feed-muted">
            <ExternalLink className="h-4 w-4" />
          </span>
        </a>
      )}

      {viewerIndex != null && (
        <MediaViewer
          media={items}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}

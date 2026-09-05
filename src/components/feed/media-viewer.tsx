"use client";

// ─── MediaViewer — full-screen lightbox with fade + zoom ───

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { FeedMediaItem } from "./types";

type Props = {
  media: FeedMediaItem[];
  index: number;
  onClose: () => void;
};

export function MediaViewer({ media, index, onClose }: Props) {
  const [current, setCurrent] = useState(index);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % media.length),
    [media.length]
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + media.length) % media.length),
    [media.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [next, prev, onClose]);

  const item = media[current];
  if (!item) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Media viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 sm:p-8"
        onClick={onClose}
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close viewer"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Counter */}
        {media.length > 1 && (
          <span className="absolute left-4 top-5 z-10 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {current + 1} / {media.length}
          </span>
        )}

        {/* Content */}
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="max-h-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {item.type === "video" ? (
            <video
              src={item.url}
              poster={item.thumbnailUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt={item.alt ?? "Post media"}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}
        </motion.div>

        {/* Arrows */}
        {media.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-all hover:bg-white/20 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-all hover:bg-white/20 active:scale-95"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

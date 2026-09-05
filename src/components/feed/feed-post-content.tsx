"use client";

// ─── FeedPostContent — Zone 2: post text, hashtags, mentions, read-more ───

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const CLAMP_LINES = 4;
const LINE_HEIGHT_PX = 22.5; // 15px text × 1.5 leading
const CLAMPED_HEIGHT = CLAMP_LINES * LINE_HEIGHT_PX;

/** Renders text with highlighted #hashtags and @mentions. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+|@[\w.]+)/gu);
  return (
    <>
      {parts.map((part, i) => {
        if (/^[#@]/.test(part)) {
          return (
            <span
              key={i}
              role="link"
              tabIndex={0}
              className="cursor-pointer font-medium text-feed-accent hover:underline underline-offset-2"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Expanded rendering: each paragraph is its own block. */
function ExpandedText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .filter((p) => p.trim())
        .map((para, i, arr) => (
          <p
            key={i}
            className={`whitespace-pre-line break-words text-[15px] leading-[1.5] text-feed-text ${
              i < arr.length - 1 ? "mb-2" : ""
            }`}
          >
            <RichText text={para} />
          </p>
        ))}
    </>
  );
}

type Props = {
  text: string;
};

export function FeedPostContent({ text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);

  // A hidden, unclamped clone is used to measure the natural height of the
  // post so the grid row can smoothly animate to it.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setFullHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  const isLong = (fullHeight ?? 0) > CLAMPED_HEIGHT + 4;

  return (
    <div className="feed-content relative">
      {/* Hidden measurement clone (always unclamped) */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 invisible"
      >
        <ExpandedText text={text} />
      </div>

      {/* Animated container: grid-template-rows transitions between two
          pixel lengths, giving a smooth height reveal. */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: `${
            expanded ? (fullHeight ?? CLAMPED_HEIGHT) : CLAMPED_HEIGHT
          }px`,
          transition: "grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          {expanded ? (
            <ExpandedText text={text} />
          ) : (
            // Collapsed: a single text box so line-clamp applies across the whole post
            <p
              className="whitespace-pre-line break-words text-[15px] leading-[1.5] text-feed-text"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: CLAMP_LINES,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              <RichText text={text} />
            </p>
          )}
        </div>
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-feed-accent transition-colors hover:text-feed-accent/80"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

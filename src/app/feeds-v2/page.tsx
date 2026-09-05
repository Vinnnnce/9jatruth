import type { Metadata } from "next";
import { FeedShowcase } from "./showcase";

export const metadata: Metadata = {
  title: "Community Feed (Redesigned) — 9jatruth",
  description:
    "Preview of the redesigned 9jatruth feed post component — modern, social-media-grade, and highly interactive.",
};

export default function FeedV2Page() {
  return <FeedShowcase />;
}

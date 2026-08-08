"use client";

import { Badge } from "@/components/ui/badge";
import { BadgeCheck } from "lucide-react";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  showLabel?: boolean;
  className?: string;
}

/**
 * Green tick verification badge for verified users, organizations, and agencies.
 * Shows a green checkmark tick — similar to verified badges on social platforms.
 */
export function VerifiedBadge({
  size = "sm",
  label = "Verified",
  showLabel = false,
  className = "",
}: VerifiedBadgeProps) {
  const iconSize = size === "lg" ? "h-4 w-4" : size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  if (showLabel) {
    return (
      <Badge
        className={`gap-0.5 bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/20 border-green-500/20 ${className}`}
      >
        <BadgeCheck className={`${iconSize} text-green-500`} />
        <span className="text-[10px] font-medium">{label}</span>
      </Badge>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={label}
      aria-label={label}
    >
      <BadgeCheck className={`${iconSize} text-green-500 fill-green-500/15`} />
    </span>
  );
}

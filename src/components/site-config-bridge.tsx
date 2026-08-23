"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * SiteConfigBridge
 *
 * Reads the live site + feature config from GET /api/config and applies it to
 * the running app in real time:
 *   - Injects --primary / --secondary CSS variables (instant theme update)
 *   - Renders the announcement bar (if active)
 *   - Exposes feature flags via a global window.__9JAFEATURES__ for components
 *     that need to hide/show sections (news, rewards, politics, questionnaire,
 *     ai_compare)
 *
 * Polls every 30s for near-real-time updates; the admin's config mutation
 * endpoints also bust the server cache immediately via `*.config.updated`
 * events, so the next poll reflects the change within seconds.
 */

type Announcement = { active: boolean; text: string; type: "info" | "warning" | "success" | "danger" };
type SiteConfig = {
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  homepage_banner_text: string | null;
  announcement_bar: Announcement;
  referral_base_url: string;
};
type FeatureConfig = {
  news_enabled: boolean;
  rewards_enabled: boolean;
  politics_enabled: boolean;
  questionnaire_enabled: boolean;
  ai_compare_enabled: boolean;
};

function normalizeHex(hex: string): string | null {
  if (!hex) return null;
  const h = hex.startsWith("#") ? hex : `#${hex}`;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h) ? h : null;
}

function hexToHsl(hex: string): string | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const n = h.length === 4
    ? h.slice(1).split("").map((c) => parseInt(c + c, 16))
    : [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r, g, b] = n.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h2 = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h2 = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h2 = (b - r) / d + 2;
    else h2 = (r - g) / d + 4;
    h2 /= 6;
  }
  return `${Math.round(h2 * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function SiteConfigBridge() {
  const { data } = useQuery<{ site: SiteConfig; features: FeatureConfig }>({
    queryKey: ["/api/config"],
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Apply theme colors as CSS variables.
  useEffect(() => {
    if (!data?.site) return;
    const root = document.documentElement;
    const primary = hexToHsl(data.site.primary_color);
    const secondary = hexToHsl(data.site.secondary_color);
    if (primary) root.style.setProperty("--primary", primary);
    if (secondary) root.style.setProperty("--secondary", secondary);
    if (data.site.logo_url) {
      const fav = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (fav) fav.href = data.site.logo_url;
    }
  }, [data?.site?.primary_color, data?.site?.secondary_color, data?.site?.logo_url]);

  // Expose feature flags globally for components that gate themselves.
  useEffect(() => {
    if (data?.features) {
      (window as any).__9JAFEATURES__ = data.features;
      window.dispatchEvent(new CustomEvent("9ja:features", { detail: data.features }));
    }
  }, [data?.features]);

  const announcement = data?.site?.announcement_bar;
  if (announcement?.active && announcement.text) {
    const color =
      announcement.type === "danger" ? "bg-red-600"
      : announcement.type === "warning" ? "bg-amber-500"
      : announcement.type === "success" ? "bg-emerald-600"
      : "bg-primary";
    return (
      <div className={`${color} text-white text-sm text-center px-3 py-2 font-medium`} role="alert">
        {announcement.text}
      </div>
    );
  }
  return null;
}

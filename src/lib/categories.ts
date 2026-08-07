/**
 * Shared category configuration for all components.
 * Used in feeds, submit form, filter bar, and admin dashboard.
 */

import {
  Zap, Fuel, Car, Tag, Shield, ShieldCheck, Building2, Home,
  UtensilsCrossed, BedDouble, GraduationCap, Pill, Cross, ShoppingCart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryConfig {
  icon: LucideIcon;
  color: string;
  label: string;
  bg: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  power: { icon: Zap, color: "text-amber-500", label: "Power", bg: "bg-amber-500/10" },
  fuel: { icon: Fuel, color: "text-orange-500", label: "Fuel", bg: "bg-orange-500/10" },
  traffic: { icon: Car, color: "text-blue-500", label: "Traffic", bg: "bg-blue-500/10" },
  prices: { icon: Tag, color: "text-purple-500", label: "Prices", bg: "bg-purple-500/10" },
  safety: { icon: Shield, color: "text-green-500", label: "Safety", bg: "bg-green-500/10" },
  security: { icon: ShieldCheck, color: "text-red-500", label: "Security", bg: "bg-red-500/10" },
  "real-estate": { icon: Building2, color: "text-indigo-500", label: "Real Estate", bg: "bg-indigo-500/10" },
  housing: { icon: Home, color: "text-teal-500", label: "Housing", bg: "bg-teal-500/10" },
  "patrol-gas-station": { icon: Fuel, color: "text-orange-600", label: "Patrol/Gas Station", bg: "bg-orange-600/10" },
  restaurant: { icon: UtensilsCrossed, color: "text-yellow-500", label: "Restaurant", bg: "bg-yellow-500/10" },
  hotel: { icon: BedDouble, color: "text-pink-500", label: "Hotel", bg: "bg-pink-500/10" },
  school: { icon: GraduationCap, color: "text-cyan-500", label: "School", bg: "bg-cyan-500/10" },
  pharmacy: { icon: Pill, color: "text-emerald-500", label: "Pharmacy", bg: "bg-emerald-500/10" },
  hospital: { icon: Cross, color: "text-rose-500", label: "Hospital", bg: "bg-rose-500/10" },
  supermarket: { icon: ShoppingCart, color: "text-lime-500", label: "Supermarket", bg: "bg-lime-500/10" },
};

export const CATEGORY_LIST = Object.entries(CATEGORY_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  icon: cfg.icon,
  color: cfg.color,
  bg: cfg.bg,
}));

export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] || { icon: Shield, color: "text-muted-foreground", label: category, bg: "bg-muted/10" };
}

"use client";

/**
 * FeedFilterBar Component
 * 
 * Filter bar for truth feed: category, distance/radius, freshness,
 * trust score range, and status.
 */

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SlidersHorizontal, MapPin, X } from "lucide-react";
import { CATEGORY_LIST } from "@/lib/categories";

export interface FeedFilters {
  category: string;
  radiusKm: number;
  hoursBack: number;
  minTrust: number;
  status: string;
  search: string;
}

export const DEFAULT_FILTERS: FeedFilters = {
  category: "",
  radiusKm: 50,
  hoursBack: 168, // 1 week
  minTrust: 0,
  status: "",
  search: "",
};

const categoryConfig: Record<string, { icon: any; color: string; label: string }> = Object.fromEntries(
  CATEGORY_LIST.map(({ value, icon, color, label }) => [value, { icon, color, label }])
);

interface FeedFilterBarProps {
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
  resultCount: number;
}

export function FeedFilterBar({ filters, onFiltersChange, resultCount }: FeedFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = [
    filters.category,
    filters.status,
    filters.search,
  ].filter(Boolean).length + (filters.minTrust > 0 ? 1 : 0) + (filters.hoursBack < 168 ? 1 : 0);

  const updateFilter = (key: keyof FeedFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAll = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category filter */}
        <Select
          value={filters.category || "all"}
          onValueChange={(v) => updateFilter("category", v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[160px] h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  {cfg.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => updateFilter("status", v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          placeholder="Search posts..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full sm:w-[200px] h-9"
        />

        {/* Advanced filters */}
        <Popover open={showAdvanced} onOpenChange={setShowAdvanced}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">{activeFilterCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-4" align="start">
            <div>
              <Label className="text-xs flex items-center gap-1 mb-2">
                <MapPin className="h-3 w-3" /> Radius: {filters.radiusKm} km
              </Label>
              <Slider
                value={[filters.radiusKm]}
                onValueChange={(v) => updateFilter("radiusKm", v[0])}
                min={1}
                max={500}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Freshness: {filters.hoursBack >= 24 ? `${Math.floor(filters.hoursBack / 24)}d` : `${filters.hoursBack}h`} ago</Label>
              <Slider
                value={[filters.hoursBack]}
                onValueChange={(v) => updateFilter("hoursBack", v[0])}
                min={1}
                max={720}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block">Min Trust Score: {filters.minTrust}</Label>
              <Slider
                value={[filters.minTrust]}
                onValueChange={(v) => updateFilter("minTrust", v[0])}
                min={0}
                max={100}
                step={5}
              />
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}

        <Badge variant="outline" className="ml-auto text-[10px]">
          {resultCount} {resultCount === 1 ? "post" : "posts"}
        </Badge>
      </div>
    </div>
  );
}

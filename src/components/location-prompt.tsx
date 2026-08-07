"use client";

/**
 * LocationPrompt Component
 * 
 * Shows when user hasn't granted location access yet.
 * Prompts them to enable location for nearby posts.
 */

import { useEffect } from "react";
import { useLiveLocation } from "../hooks/use-live-location";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, LocateFixed, AlertCircle } from "lucide-react";

interface LocationPromptProps {
  onLocationObtained?: (lat: number, lng: number) => void;
}

export function LocationPrompt({ onLocationObtained }: LocationPromptProps) {
  const { lat, lng, loading, error, permission, requestLocation } = useLiveLocation();

  // Notify parent when location is obtained (in useEffect, not during render)
  useEffect(() => {
    if (lat !== null && lng !== null && onLocationObtained) {
      onLocationObtained(lat, lng);
    }
  }, [lat, lng, onLocationObtained]);

  if (lat !== null) return null; // Location obtained, hide prompt

  return (
    <Card className="border-dashed">
      <CardContent className="p-6 flex flex-col items-center text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {error ? <AlertCircle className="h-6 w-6 text-amber-500" /> : <MapPin className="h-6 w-6 text-primary" />}
        </div>
        <div>
          <h3 className="text-sm font-medium">Enable Location for Nearby Posts</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {error
              ? error
              : "We use your live location to show only posts and feeds near you. Your exact location is never stored — only approximate distance is used."}
          </p>
        </div>
        <Button onClick={requestLocation} disabled={loading} size="sm" className="gap-1">
          <LocateFixed className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Locating..." : "Share My Location"}
        </Button>
        {permission === "denied" && (
          <p className="text-[10px] text-muted-foreground">
            Location access was denied. You can enable it in your browser settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

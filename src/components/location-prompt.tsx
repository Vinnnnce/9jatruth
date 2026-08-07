"use client";

/**
 * LocationPrompt Component
 * 
 * Auto-detects user location via IP address. No manual switch needed.
 * Shows a subtle indicator of detected location.
 */

import { useEffect, useState } from "react";
import { MapPin, LocateFixed } from "lucide-react";

interface LocationPromptProps {
  onLocationObtained?: (lat: number, lng: number, region?: string, city?: string) => void;
}

export function LocationPrompt({ onLocationObtained }: LocationPromptProps) {
  const [detected, setDetected] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-detect location via IP address — no manual switch
    fetch("/api/geo/nearby")
      .then(res => res.json())
      .then(data => {
        if (data.userLocation) {
          setRegion(data.userLocation.region || null);
          setCity(data.userLocation.city || null);
          if (data.userLocation.lat && data.userLocation.lng) {
            onLocationObtained?.(data.userLocation.lat, data.userLocation.lng, data.userLocation.region, data.userLocation.city);
          }
          setDetected(true);
        }
      })
      .catch(() => {
        // Silent fail — location is optional
      })
      .finally(() => setLoading(false));
  }, [onLocationObtained]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LocateFixed className="h-3.5 w-3.5 animate-spin text-primary" />
        Detecting your location...
      </div>
    );
  }

  if (!detected) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <MapPin className="h-3.5 w-3.5 text-primary" />
      {city && region ? `${city}, ${region}` : region || "Location detected"}
    </div>
  );
}

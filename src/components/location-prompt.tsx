"use client";

/**
 * LocationPrompt Component
 * 
 * Auto-detects user location via IP address, then shows a confirmation
 * prompt asking the user to verify or change their detected location.
 * Persists the confirmation via /api/user/location.
 */

import { useEffect, useState, useCallback } from "react";
import { MapPin, LocateFixed, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@/lib/use-user-safe";

interface LocationPromptProps {
  onLocationObtained?: (lat: number, lng: number, region?: string, city?: string) => void;
}

type DetectionState = "loading" | "detected" | "confirmed" | "dismissed" | "failed";

export function LocationPrompt({ onLocationObtained }: LocationPromptProps) {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<DetectionState>("loading");
  const [showConfirm, setShowConfirm] = useState(false);
  const [region, setRegion] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<{ id: number; name: string; region: string }[]>([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [showManual, setShowManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const detectLocation = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/geo/nearby");
      const data = await res.json();
      if (data.userLocation) {
        setRegion(data.userLocation.region || null);
        setCity(data.userLocation.city || null);
        if (data.userLocation.lat && data.userLocation.lng) {
          setLat(data.userLocation.lat);
          setLng(data.userLocation.lng);
          onLocationObtained?.(
            data.userLocation.lat,
            data.userLocation.lng,
            data.userLocation.region,
            data.userLocation.city
          );
        }
        setState("detected");
        // Show confirmation prompt after a brief delay
        if (isSignedIn) {
          setTimeout(() => setShowConfirm(true), 500);
        }
      } else {
        setState("failed");
      }
    } catch {
      setState("failed");
    }
  }, [onLocationObtained, isSignedIn]);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  // Fetch available neighborhoods when manual selection opens
  useEffect(() => {
    if (showManual && neighborhoods.length === 0) {
      fetch("/api/neighborhoods")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setNeighborhoods(data);
        })
        .catch(() => {});
    }
  }, [showManual, neighborhoods.length]);

  const handleConfirm = async () => {
    if (!isSignedIn || !lat || !lng) {
      setShowConfirm(false);
      setState("confirmed");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/user/location", {
        regionName: region || undefined,
        lat,
        lng,
        stateName: region || undefined,
      });
      setState("confirmed");
      setShowConfirm(false);
    } catch {
      // Best-effort — still mark as confirmed for the UI
      setState("confirmed");
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    setShowConfirm(false);
    setState("dismissed");
  };

  const handleManualSelect = async () => {
    if (!selectedNeighborhood) return;
    const n = neighborhoods.find(n => n.id === parseInt(selectedNeighborhood));
    if (!n) return;
    setRegion(n.region);
    setCity(n.name);
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/user/location", {
        neighborhoodId: n.id,
        regionName: n.region,
        stateName: n.region,
      });
      onLocationObtained?.(0, 0, n.region, n.name);
      setState("confirmed");
      setShowManual(false);
      setShowConfirm(false);
    } catch {
      // Best-effort
      setState("confirmed");
      setShowManual(false);
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LocateFixed className="h-3.5 w-3.5 animate-spin text-primary" />
        Detecting your location...
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground/50" />
        Location unavailable
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        {city && region ? `${city}, ${region}` : region || "Location detected"}
        {state === "confirmed" && (
          <Check className="h-3 w-3 text-green-500" />
        )}
      </div>

      {/* Location Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Confirm Your Location
            </DialogTitle>
            <DialogDescription>
              We detected your location as{" "}
              <span className="font-medium text-foreground">
                {city && region ? `${city}, ${region}` : region || "Unknown"}
              </span>
              . Is this correct?
            </DialogDescription>
          </DialogHeader>

          {!showManual ? (
            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowManual(true)}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Change
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={saving}
                className="text-xs"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Confirm
              </Button>
            </DialogFooter>
          ) : (
            <div className="space-y-3">
              {neighborhoods.length > 0 && (
                <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select your neighborhood" />
                  </SelectTrigger>
                  <SelectContent>
                    {neighborhoods.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)} className="text-xs">
                        {n.name}, {n.region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManual(false)}
                  className="text-xs"
                  disabled={saving}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleManualSelect}
                  disabled={saving || !selectedNeighborhood}
                  className="text-xs"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  Save Location
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

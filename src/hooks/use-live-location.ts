/**
 * useLiveLocation Hook
 * 
 * Requests browser geolocation permission and provides
 * live coordinates with fallback handling.
 */

import { useState, useEffect, useCallback } from "react";

export interface LiveLocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  permission: "granted" | "denied" | "prompt" | "unknown";
  requestLocation: () => void;
}

export function useLiveLocation(): LiveLocationState {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setAccuracy(position.coords.accuracy);
        setPermission("granted");
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError("Location access denied. Please enable location permissions to see nearby posts.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location information is unavailable.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out.");
        } else {
          setError("An unknown error occurred while requesting location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Accept cached position up to 1 minute old
      }
    );
  }, []);

  // Check permission status on mount
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
        setPermission(result.state as any);
        result.onchange = () => setPermission(result.state as any);
      }).catch(() => {
        // Permission API not supported
      });
    }
  }, []);

  // Auto-request location if permission is already granted
  useEffect(() => {
    if (permission === "granted" && lat === null) {
      requestLocation();
    }
  }, [permission, lat, requestLocation]);

  return { lat, lng, accuracy, loading, error, permission, requestLocation };
}

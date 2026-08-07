"use client";

import { useEffect, useState, useCallback } from "react";

export interface OfflineSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  sync: () => Promise<void>;
}

/**
 * Simplified offline sync hook for Next.js.
 * In the serverless deployment, we track online/offline status
 * but don't maintain a local SQLite queue. Sync is handled via
 * the server-side /api/sync endpoints.
 */
export function useOfflineSync(): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      // Trigger server sync
      await fetch("/api/sync/pull", { credentials: "include" });
      setLastSyncAt(new Date().toISOString());
      setPendingCount(0);
    } catch (error) {
      console.error("[sync] Failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    sync,
  };
}

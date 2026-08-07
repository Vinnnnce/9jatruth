/**
 * Offline Status Indicator
 * 
 * Shows online/offline status and pending sync count.
 * Appears in the top bar when offline or when pending operations exist.
 */

import { useOfflineSync } from "../hooks/use-offline-sync";
import { Wifi, WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OfflineStatus() {
  const { isOnline, isSyncing, pendingCount, lastSyncAt, sync } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null; // Don't show anything when everything is fine
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {!isOnline && (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          Offline
        </Badge>
      )}
      {isOnline && pendingCount > 0 && (
        <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer" onClick={sync}>
          <CloudUpload className="h-3 w-3" />
          {pendingCount} pending
        </Badge>
      )}
      {isSyncing && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing...
        </Badge>
      )}
      {isOnline && pendingCount === 0 && !isSyncing && lastSyncAt && (
        <Badge variant="outline" className="flex items-center gap-1 text-green-600">
          <Wifi className="h-3 w-3" />
          Synced
        </Badge>
      )}
    </div>
  );
}

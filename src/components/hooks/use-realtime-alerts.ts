/**
 * useRealtimeAlerts Hook
 * 
 * Polls for new alerts and provides real-time alert updates.
 * Uses WebSocket if available, falls back to polling.
 */

import { useEffect, useState, useCallback } from "react";

export interface Alert {
  id: string;
  neighborhoodId: number;
  neighborhood: string;
  region: string;
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  detectedAt: string;
}

export interface RealtimeAlertsState {
  alerts: Alert[];
  unreadCount: number;
  loading: boolean;
  markRead: () => void;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL = 30000; // 30 seconds

export function useRealtimeAlerts(): RealtimeAlertsState {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/alerts");
      if (!response.ok) return;
      const data = await response.json();

      // Compare with previous alerts to find new ones
      if (lastFetch && data.length > 0) {
        const newAlerts = data.filter(
          (a: Alert) => !alerts.some(existing => existing.id === a.id)
        );
        if (newAlerts.length > 0) {
          setUnreadCount(prev => prev + newAlerts.length);

          // Show browser notification if permission granted
          if (Notification.permission === "granted") {
            for (const alert of newAlerts.slice(0, 3)) {
              new Notification(alert.title, {
                body: alert.description,
                tag: alert.id,
              });
            }
          }
        }
      }

      setAlerts(data);
      setLastFetch(new Date().toISOString());
    } catch (e) {
      console.error("[alerts] Failed to fetch alerts:", e);
    } finally {
      setLoading(false);
    }
  }, [alerts, lastFetch]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL);

    // Try WebSocket connection for real-time updates
    let ws: WebSocket | null = null;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "alert") {
          refresh();
        }
      };
      ws.onerror = () => {
        // WebSocket failed, polling will continue
      };
    } catch {
      // WebSocket not available, polling continues
    }

    return () => {
      clearInterval(interval);
      ws?.close();
    };
  }, [refresh]);

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { alerts, unreadCount, loading, markRead, refresh };
}

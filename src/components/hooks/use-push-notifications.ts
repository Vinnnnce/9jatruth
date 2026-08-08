/**
 * usePushNotifications Hook
 * 
 * Manages push notification subscription state and provides
 * subscribe/unsubscribe functions.
 */

import { useState, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface PushNotificationState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  configured: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications(): PushNotificationState {
  const [supported] = useState(
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [configured, setConfigured] = useState(false);

  const checkSubscription = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    } catch {
      // Service worker not ready yet
    }
  }, [supported]);

  useEffect(() => {
    checkSubscription();

    // Check if push is configured on server
    fetch("/api/push/vapid-key")
      .then(r => r.json())
      .then(data => setConfigured(data.configured || false))
      .catch(() => setConfigured(false));
  }, [checkSubscription]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    // Request permission
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;

    try {
      // Get VAPID public key
      const response = await fetch("/api/push/vapid-key");
      const { publicKey } = await response.json();

      if (!publicKey) {
        console.warn("[push] VAPID key not configured on server");
        return false;
      }

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subscribe to push
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Send subscription to server
      const subJson = subscription.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error("[push] Subscription failed:", e);
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await apiRequest("POST", "/api/push/unsubscribe", {
          endpoint: subscription.endpoint,
        });
      }
      setSubscribed(false);
      return true;
    } catch (e) {
      console.error("[push] Unsubscribe failed:", e);
      return false;
    }
  }, [supported]);

  return {
    supported,
    permission,
    subscribed,
    configured,
    subscribe,
    unsubscribe,
  };
}

/**
 * Convert base64url to Uint8Array for VAPID key.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

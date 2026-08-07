"use client";

/**
 * Push Notification Toggle
 * 
 * Allows users to subscribe/unsubscribe from push notifications.
 */

import { usePushNotifications } from "../hooks/use-push-notifications";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff } from "lucide-react";
import { useState } from "react";

export function PushNotificationToggle() {
  const { supported, permission, subscribed, configured, subscribe, unsubscribe } = usePushNotifications();
  const [loading, setLoading] = useState(false);

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-4 w-4" />
        <span>Push notifications not supported on this device</span>
      </div>
    );
  }

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribe();
      } else {
        await subscribe();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {subscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        <div>
          <div className="text-sm font-medium">Push Notifications</div>
          <div className="text-xs text-muted-foreground">
            {!configured && "Server not configured — "}
            {permission === "denied"
              ? "Blocked by browser settings"
              : subscribed
              ? "Receiving alerts for your areas"
              : "Get instant alerts for outages and incidents"}
          </div>
        </div>
      </div>
      <Switch
        checked={subscribed}
        onCheckedChange={handleToggle}
        disabled={loading || permission === "denied"}
      />
    </div>
  );
}

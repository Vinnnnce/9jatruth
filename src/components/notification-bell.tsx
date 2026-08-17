"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check, X, BellRing, Settings, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string | null;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dropdownRef, setDropdownRef] = useState<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const push = usePushNotifications();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  return (
    <div className="relative" ref={setDropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border border-border bg-popover shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-muted-foreground hover:text-foreground"
                title="Notification settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {showSettings && (
            <div className="px-4 py-3 border-b border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">Push Notifications</p>
                    <p className="text-[10px] text-muted-foreground">
                      {!push.supported ? "Not supported on this device" : push.subscribed ? "Enabled" : push.configured ? "Click to enable" : "Not configured"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={push.subscribed}
                  disabled={!push.supported || !push.configured || push.permission === "denied"}
                  onCheckedChange={async (checked) => {
                    if (checked) {
                      const success = await push.subscribe();
                      if (success) {
                        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
                      }
                    } else {
                      await push.unsubscribe();
                    }
                  }}
                />
              </div>
              {push.supported && push.configured && !push.subscribed && push.permission !== "denied" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1"
                  onClick={async () => {
                    const success = await push.subscribe();
                    if (success) {
                      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
                    }
                  }}
                >
                  <Zap className="h-3 w-3" />
                  Enable Push Alerts
                </Button>
              )}
              {push.permission === "denied" && (
                <p className="text-[10px] text-amber-500">
                  Push notifications blocked. Please enable in browser settings.
                </p>
              )}
            </div>
          )}
          <div className="overflow-y-auto flex-1 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  You'll see updates here when there's activity in your area.
                </p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    if (!n.read) markAsRead.mutate(n.id);
                    if (n.actionUrl) window.location.href = n.actionUrl;
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(n.createdAt).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/hooks/use-toast";
import { Settings, Save, Bell, Shield, Globe, Loader2 } from "lucide-react";

export default function AdvancedSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    pushNotifications: true,
    locationTracking: true,
    autoRefreshFeeds: true,
    refreshInterval: 5,
    dataSaver: false,
    darkMode: true,
    language: "en",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // Save to localStorage for now
      if (typeof window !== "undefined") {
        localStorage.setItem("soke_advanced_settings", JSON.stringify(data));
      }
      return new Promise(resolve => setTimeout(() => resolve({ success: true }), 300));
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-display font-700 flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Advanced Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure your app preferences, privacy, and behavior
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive alerts about new truths and predictions</p>
            </div>
            <Switch
              checked={settings.pushNotifications}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, pushNotifications: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">In-App Notifications</Label>
              <p className="text-xs text-muted-foreground">Show notifications within the app</p>
            </div>
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, notificationsEnabled: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Feed & Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-Refresh Feeds</Label>
              <p className="text-xs text-muted-foreground">Automatically refresh the feeds page</p>
            </div>
            <Switch
              checked={settings.autoRefreshFeeds}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, autoRefreshFeeds: v }))}
            />
          </div>
          {settings.autoRefreshFeeds && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Refresh Interval (seconds)</Label>
              <Input
                type="number"
                min={3}
                max={60}
                value={settings.refreshInterval}
                onChange={(e) => setSettings((s) => ({ ...s, refreshInterval: parseInt(e.target.value) || 5 }))}
                className="h-9 w-24"
              />
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Data Saver</Label>
              <p className="text-xs text-muted-foreground">Reduce data usage by loading fewer images</p>
            </div>
            <Switch
              checked={settings.dataSaver}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, dataSaver: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Location Tracking</Label>
              <p className="text-xs text-muted-foreground">Allow Soke to use your location for nearby feeds</p>
            </div>
            <Switch
              checked={settings.locationTracking}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, locationTracking: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="w-full gap-2"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save Settings
      </Button>
    </div>
  );
}

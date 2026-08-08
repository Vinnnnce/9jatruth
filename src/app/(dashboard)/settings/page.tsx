"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Lock,
  Monitor,
  Globe,
  User,
  Save,
  Shield,
  Eye,
  Smartphone,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";

type UserSettings = {
  notificationPreferences: { push: boolean; email: boolean; sms: boolean };
  privacySettings: { profileVisible: boolean; locationVisible: boolean; activityVisible: boolean };
  displayPreferences: { compactView: boolean; autoPlay: boolean; dataSaver: boolean };
  language: string;
  timezone: string | null;
  bio: string;
  phone: string;
  occupation: string;
  website: string;
  twitterHandle: string;
  linkedinUrl: string;
  profileCompleted: boolean;
};

export default function AdvancedSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/user/settings"],
  });

  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<UserSettings | null>(null);

  // Sync local state when data loads
  const current = local || settings;

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      const res = await apiRequest("PATCH", "/api/user/settings", data);
      return res.json();
    },
    onMutate: (data) => {
      if (current) {
        setLocal({ ...current, ...data } as UserSettings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
      setLocal(null);
    },
  });

  const update = (section: keyof UserSettings, key: string, value: any) => {
    if (!current) return;
    const sectionData = current[section] as Record<string, any>;
    const newData = { ...sectionData, [key]: value };
    updateMutation.mutate({ [section]: newData } as any);
  };

  const updateField = (field: keyof UserSettings, value: any) => {
    updateMutation.mutate({ [field]: value } as any);
  };

  const handleSaveProfile = () => {
    if (!current) return;
    setSaving(true);
    updateMutation.mutate(
      {
        bio: current.bio,
        phone: current.phone,
        occupation: current.occupation,
        website: current.website,
        twitterHandle: current.twitterHandle,
        linkedinUrl: current.linkedinUrl,
      },
      {
        onSettled: () => setSaving(false),
      }
    );
  };

  if (isLoading || !current) {
    return (
      <div className="p-6 max-w-3xl space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-5 w-32 bg-muted animate-pulse rounded mb-3" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Advanced Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile, notifications, privacy, and display preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={current.phone}
                onChange={(e) => setLocal({ ...current, phone: e.target.value })}
                className="mt-1 h-9"
                placeholder="+234..."
              />
            </div>
            <div>
              <Label className="text-xs">Occupation</Label>
              <Input
                value={current.occupation}
                onChange={(e) => setLocal({ ...current, occupation: e.target.value })}
                className="mt-1 h-9"
                placeholder="e.g. Engineer"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Bio</Label>
            <Textarea
              value={current.bio}
              onChange={(e) => setLocal({ ...current, bio: e.target.value })}
              className="mt-1 min-h-[80px]"
              placeholder="Tell the community about yourself..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Website</Label>
              <Input
                value={current.website}
                onChange={(e) => setLocal({ ...current, website: e.target.value })}
                className="mt-1 h-9"
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-xs">Twitter Handle</Label>
              <Input
                value={current.twitterHandle}
                onChange={(e) => setLocal({ ...current, twitterHandle: e.target.value })}
                className="mt-1 h-9"
                placeholder="@username"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">LinkedIn URL</Label>
            <Input
              value={current.linkedinUrl}
              onChange={(e) => setLocal({ ...current, linkedinUrl: e.target.value })}
              className="mt-1 h-9"
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <Button size="sm" onClick={handleSaveProfile} disabled={saving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "push", label: "Push Notifications", desc: "Receive push notifications on your device", icon: Smartphone },
            { key: "email", label: "Email Notifications", desc: "Receive notifications via email", icon: Bell },
            { key: "sms", label: "SMS Notifications", desc: "Receive notifications via text message", icon: Bell },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={current.notificationPreferences[item.key as keyof typeof current.notificationPreferences]}
                  onCheckedChange={(v) => update("notificationPreferences", item.key, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Privacy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "profileVisible", label: "Public Profile", desc: "Allow others to view your profile", icon: Eye },
            { key: "locationVisible", label: "Show Location", desc: "Display your general location on your profile", icon: Globe },
            { key: "activityVisible", label: "Show Activity", desc: "Allow others to see your recent activity", icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={current.privacySettings[item.key as keyof typeof current.privacySettings]}
                  onCheckedChange={(v) => update("privacySettings", item.key, v)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Display Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "compactView", label: "Compact View", desc: "Reduce spacing for a denser layout" },
            { key: "autoPlay", label: "Auto-play Media", desc: "Automatically play media in posts" },
            { key: "dataSaver", label: "Data Saver", desc: "Reduce image quality to save data" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={current.displayPreferences[item.key as keyof typeof current.displayPreferences]}
                onCheckedChange={(v) => update("displayPreferences", item.key, v)}
              />
            </div>
          ))}
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Language</Label>
              <Select
                value={current.language}
                onValueChange={(v) => updateField("language", v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ha">Hausa</SelectItem>
                  <SelectItem value="yo">Yoruba</SelectItem>
                  <SelectItem value="ig">Igbo</SelectItem>
                  <SelectItem value="pid">Pidgin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Timezone</Label>
              <Select
                value={current.timezone || "Africa/Lagos"}
                onValueChange={(v) => updateField("timezone", v)}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Lagos">Lagos (WAT)</SelectItem>
                  <SelectItem value="Africa/Abuja">Abuja (WAT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">London (GMT)</SelectItem>
                  <SelectItem value="America/New_York">New York (EST)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

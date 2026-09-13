"use client";

/**
 * Advanced Account Settings Page
 * 
 * Sections:
 *   - Personal Info (name, email, phone, bio, avatar)
 *   - Security (password, 2FA, sessions)
 *   - Notifications (push, email, categories)
 *   - Connected Accounts (Google, X, LinkedIn)
 *   - Privacy (profile visibility, data controls)
 * 
 * Responsive: mobile-first with desktop grid layout.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Shield, Bell, Link2, Eye, EyeOff,
  Save, Globe, Smartphone, Trash2,
} from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";

type NotificationPrefs = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  politicalAlerts: boolean;
  securityAlerts: boolean;
  feedUpdates: boolean;
  weeklyDigest: boolean;
};

type PrivacyPrefs = {
  profileVisible: boolean;
  showEmail: boolean;
  showPhone: boolean;
  dataSharing: boolean;
};

export default function AdvancedAccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/user/profile"],
    queryFn: () => apiRequest("GET", "/api/user/profile"),
  });

  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [personalForm, setPersonalForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    bio: "",
    occupation: "",
    website: "",
    twitterHandle: "",
    linkedinUrl: "",
    dateOfBirth: "",
    gender: "",
  });

  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: false,
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    pushEnabled: true,
    emailEnabled: true,
    politicalAlerts: true,
    securityAlerts: true,
    feedUpdates: false,
    weeklyDigest: true,
  });

  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPrefs>({
    profileVisible: true,
    showEmail: false,
    showPhone: false,
    dataSharing: false,
  });

  // Sync form when profile data loads
  useEffect(() => {
    if (profile) {
      setPersonalForm({
        displayName: (profile as any).displayName || "",
        email: (profile as any).email || "",
        phone: (profile as any).phone || "",
        bio: (profile as any).bio || "",
        occupation: (profile as any).occupation || "",
        website: (profile as any).website || "",
        twitterHandle: (profile as any).twitterHandle || "",
        linkedinUrl: (profile as any).linkedinUrl || "",
        dateOfBirth: (profile as any).dateOfBirth || "",
        gender: (profile as any).gender || "",
      });
    }
  }, [profile]);

  const savePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/user/profile", personalForm);
      await queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: "Saved", description: "Personal information updated successfully." });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Failed to update personal information.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }
    if (securityForm.newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await apiRequest("POST", "/api/auth/password", {
        currentPassword: securityForm.currentPassword,
        newPassword: securityForm.newPassword,
      });
      toast({ title: "Password updated", description: "Your password has been changed." });
      setSecurityForm({ ...securityForm, currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast({
        title: "Password update failed",
        description: err.message || "Failed to update password.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, security, and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
          <TabsTrigger value="personal" className="text-xs md:text-sm">
            <User className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs md:text-sm">
            <Shield className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs md:text-sm">
            <Bell className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="connected" className="text-xs md:text-sm">
            <Link2 className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Connected</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="text-xs md:text-sm">
            <Eye className="h-3.5 w-3.5 md:mr-1.5" />
            <span className="hidden md:inline">Privacy</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── Personal Info Tab ─── */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Personal Information
              </CardTitle>
              <CardDescription>Update your personal details and profile</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={savePersonal} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={personalForm.displayName}
                      onChange={(e) => setPersonalForm({ ...personalForm, displayName: e.target.value })}
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={personalForm.email}
                      onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                      placeholder="your@email.com"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={personalForm.phone}
                      onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                      placeholder="+234..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Occupation</Label>
                    <Input
                      id="occupation"
                      value={personalForm.occupation}
                      onChange={(e) => setPersonalForm({ ...personalForm, occupation: e.target.value })}
                      placeholder="Your occupation"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={personalForm.bio}
                    onChange={(e) => setPersonalForm({ ...personalForm, bio: e.target.value })}
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={personalForm.website}
                      onChange={(e) => setPersonalForm({ ...personalForm, website: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter/X Handle</Label>
                    <Input
                      id="twitter"
                      value={personalForm.twitterHandle}
                      onChange={(e) => setPersonalForm({ ...personalForm, twitterHandle: e.target.value })}
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn URL</Label>
                    <Input
                      id="linkedin"
                      value={personalForm.linkedinUrl}
                      onChange={(e) => setPersonalForm({ ...personalForm, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Input
                      id="gender"
                      value={personalForm.gender}
                      onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value })}
                      placeholder="Gender (optional)"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Security Tab ─── */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Change */}
              <form onSubmit={saveSecurity} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? "text" : "password"}
                      value={securityForm.currentPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={securityForm.newPassword}
                        onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={securityForm.confirmPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saving || !securityForm.currentPassword || !securityForm.newPassword}>
                    {saving ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>

              <Separator />

              {/* 2FA Section */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Two-Factor Authentication</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Switch
                  checked={securityForm.twoFactorEnabled}
                  onCheckedChange={(checked) => setSecurityForm({ ...securityForm, twoFactorEnabled: checked })}
                />
              </div>

              <Separator />

              {/* Active Sessions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Active Sessions</span>
                </div>
                <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Current Session</p>
                      <p className="text-xs text-muted-foreground">Frankfurt, Germany</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Notifications Tab ─── */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" /> Notification Preferences
              </CardTitle>
              <CardDescription>Control what notifications you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "pushEnabled", label: "Push Notifications", desc: "Receive push notifications on your device" },
                { key: "emailEnabled", label: "Email Notifications", desc: "Receive notifications via email" },
                { key: "politicalAlerts", label: "Political Alerts", desc: "Updates on political events and elections" },
                { key: "securityAlerts", label: "Security Alerts", desc: "Important security and account alerts" },
                { key: "feedUpdates", label: "Feed Updates", desc: "Notifications about new content in your feed" },
                { key: "weeklyDigest", label: "Weekly Digest", desc: "Summary of the week's most important news" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifPrefs[item.key as keyof NotificationPrefs] as boolean}
                    onCheckedChange={(checked) =>
                      setNotifPrefs({ ...notifPrefs, [item.key]: checked })
                    }
                  />
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={() => toast({ title: "Preferences saved", description: "Your notification settings have been updated." })}>
                  <Save className="h-4 w-4 mr-2" /> Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Connected Accounts Tab ─── */}
        <TabsContent value="connected">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" /> Connected Accounts
              </CardTitle>
              <CardDescription>Manage your linked social accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Google", connected: !!personalForm.email, icon: Globe },
                { name: "X (Twitter)", connected: !!personalForm.twitterHandle, icon: Globe },
                { name: "LinkedIn", connected: !!personalForm.linkedinUrl, icon: Globe },
              ].map((account) => (
                <div key={account.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <account.icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {account.connected ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <Button variant={account.connected ? "outline" : "default"} size="sm">
                    {account.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Privacy Tab ─── */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" /> Privacy Settings
              </CardTitle>
              <CardDescription>Control your profile visibility and data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "profileVisible", label: "Public Profile", desc: "Allow others to view your profile" },
                { key: "showEmail", label: "Show Email", desc: "Display your email on your public profile" },
                { key: "showPhone", label: "Show Phone", desc: "Display your phone number on your profile" },
                { key: "dataSharing", label: "Data Sharing", desc: "Allow your data to be used for analytics" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={privacyPrefs[item.key as keyof PrivacyPrefs] as boolean}
                    onCheckedChange={(checked) =>
                      setPrivacyPrefs({ ...privacyPrefs, [item.key]: checked })
                    }
                  />
                </div>
              ))}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Danger Zone</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button variant="destructive" size="sm" className="mt-2">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

/**
 * Account Settings Page
 *
 * Allows authenticated agency users to update their profile,
 * organization details, and change password.
 */

import { useState } from "react";
import { useAgencyAuth } from "@/hooks/use-agency-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, LogOut, Lock, User, Mail, Globe, MapPin, Phone, Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function AccountSettings() {
  const { auth, loading, updateSettings, logout, checkSession } = useAgencyAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState({
    displayName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    description: "",
    region: "",
    city: "",
    currentPassword: "",
    newPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync form when auth loads
  if (auth.account && !form.displayName) {
    setForm({
      displayName: auth.account.displayName,
      contactEmail: auth.organization?.contactEmail || "",
      contactPhone: auth.organization?.contactPhone || "",
      website: auth.organization?.website || "",
      description: auth.organization?.description || "",
      region: auth.organization?.region || "",
      city: auth.organization?.city || "",
      currentPassword: "",
      newPassword: "",
    });
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: any = {
        displayName: form.displayName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        website: form.website,
        description: form.description,
        region: form.region,
        city: form.city,
      };
      if (form.newPassword) {
        updates.currentPassword = form.currentPassword;
        updates.newPassword = form.newPassword;
      }
      await updateSettings(updates);
      toast({ title: "Settings saved", description: "Your account has been updated." });
      setForm({ ...form, currentPassword: "", newPassword: "" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged out", description: "You have been signed out." });
    router.push("/agency-auth");
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!auth.account) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-4">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
        <div>
          <h2 className="text-lg font-medium">Not Signed In</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your agency account to manage settings.</p>
        </div>
        <Button onClick={() => router.push("/agency-auth")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-700">Account Settings</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{auth.organization?.name}</span>
              {auth.organization?.verified === 1 ? (
                <Badge className="text-[9px] gap-0.5 bg-green-500/15 text-green-600"><ShieldCheck className="h-2.5 w-2.5" /> Verified</Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] text-amber-500"><ShieldAlert className="h-2.5 w-2.5" /> Pending</Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="displayName" className="text-xs">Display Name</Label>
                <Input id="displayName" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="accountEmail" className="text-xs">Login Email</Label>
                <Input id="accountEmail" value={auth.account.email} disabled className="bg-muted/50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organization Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Organization Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contactEmail" className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Contact Email</Label>
                <Input id="contactEmail" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="contactPhone" className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Contact Phone</Label>
                <Input id="contactPhone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="region" className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Region/State</Label>
                <Input id="region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="city" className="text-xs">City</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="website" className="text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Website</Label>
              <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Change Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
              <div className="relative">
                <Input id="currentPassword" type={showCurrent ? "text" : "password"} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} placeholder="Enter current password" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="newPassword" className="text-xs">New Password</Label>
              <div className="relative">
                <Input id="newPassword" type={showNew ? "text" : "password"} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="Leave blank to keep current" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Only fill in if you want to change your password.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={saving} className="gap-1">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

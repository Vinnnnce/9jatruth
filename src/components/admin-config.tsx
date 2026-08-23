"use client";

/**
 * AdminConfig — super-admin panel for SiteConfig, FeatureConfig, and
 * RewardsConfig. Every save hits the live config endpoints, which emit
 * `*.config.updated` events, bust the server cache, and propagate to the
 * SiteConfigBridge + rewards UI within seconds (instant reflection).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/components/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type SiteConfig = {
  primary_color: string; secondary_color: string; logo_url: string | null;
  homepage_banner_text: string | null;
  announcement_bar: { active: boolean; text: string; type: string };
  referral_base_url: string; default_rewards_config_id: number | null;
};
type FeatureConfig = {
  news_enabled: boolean; rewards_enabled: boolean; politics_enabled: boolean;
  questionnaire_enabled: boolean; ai_compare_enabled: boolean;
};
type RewardsConfig = { id: number; name: string; is_active: boolean; config: Record<string, number | string | boolean> };

const FEATURE_LABELS: [keyof FeatureConfig, string, string][] = [
  ["news_enabled", "News", "Show the news feature across the platform"],
  ["rewards_enabled", "Rewards", "Enable the rewards/referral program"],
  ["politics_enabled", "Politics", "Show the politics section"],
  ["questionnaire_enabled", "Questionnaire", "Enable questionnaires"],
  ["ai_compare_enabled", "AI Compare", "Enable AI-powered comparisons"],
];

export function AdminConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const siteQ = useQuery<{ config: SiteConfig }>({ queryKey: ["/api/admin/site-config"], staleTime: 0 });
  const featureQ = useQuery<{ config: FeatureConfig }>({ queryKey: ["/api/admin/feature-config"], staleTime: 0 });
  const rewardsQ = useQuery<{ active: RewardsConfig | null; configs: RewardsConfig[] }>({ queryKey: ["/api/admin/rewards/config"], staleTime: 0 });

  const [site, setSite] = useState<Partial<SiteConfig>>({});
  const [features, setFeatures] = useState<Partial<FeatureConfig>>({});
  const [rewardsName, setRewardsName] = useState("Default rewards");
  const [rewardsJson, setRewardsJson] = useState(
    JSON.stringify({ truthSubmission: 20, corroboration: 10, aiVerified: 15, dailyStreak: 5, disputedPenalty: -10, referralSignup: 50, referralCompletion: 100 }, null, 2)
  );

  const activeSite = { ...(siteQ.data?.config ?? {}), ...site } as SiteConfig;
  const activeFeatures = { ...(featureQ.data?.config ?? {}), ...features } as FeatureConfig;

  const siteMut = useMutation({
    mutationFn: (payload: Partial<SiteConfig>) => apiRequest("POST", "/api/admin/site-config/update", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/site-config"] });
      qc.invalidateQueries({ queryKey: ["/api/config"] });
      setSite({});
      toast({ title: "Site config updated", description: "Changes are live across the platform." });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const featureMut = useMutation({
    mutationFn: (payload: Partial<FeatureConfig>) => apiRequest("POST", "/api/admin/feature-config/update", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-config"] });
      qc.invalidateQueries({ queryKey: ["/api/config"] });
      toast({ title: "Feature flags updated", description: "Visibility changes are live." });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const rewardsMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/rewards/config/update", {
      name: rewardsName,
      config: JSON.parse(rewardsJson),
      activate: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/rewards/config"] });
      qc.invalidateQueries({ queryKey: ["/api/rewards/config"] });
      toast({ title: "Rewards config updated", description: "rewards.config.updated emitted — rewards UI is live." });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (siteQ.isLoading || featureQ.isLoading || rewardsQ.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* SiteConfig */}
      <Card>
        <CardHeader><CardTitle>Site configuration</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="primary">Primary color</Label>
            <Input id="primary" type="color" value={activeSite.primary_color || "#0f766e"}
              onChange={(e) => setSite((s) => ({ ...s, primary_color: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary">Secondary color</Label>
            <Input id="secondary" type="color" value={activeSite.secondary_color || "#f59e0b"}
              onChange={(e) => setSite((s) => ({ ...s, secondary_color: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" value={activeSite.logo_url ?? ""} placeholder="https://9jatruth.com/logo.png"
              onChange={(e) => setSite((s) => ({ ...s, logo_url: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="banner">Homepage banner text</Label>
            <Input id="banner" value={activeSite.homepage_banner_text ?? ""}
              onChange={(e) => setSite((s) => ({ ...s, homepage_banner_text: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ref">Referral base URL</Label>
            <Input id="ref" value={activeSite.referral_base_url || "https://9jatruth.com"}
              onChange={(e) => setSite((s) => ({ ...s, referral_base_url: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="ann-active" checked={!!activeSite.announcement_bar?.active}
              onCheckedChange={(v) => setSite((s) => ({ ...s, announcement_bar: { ...(activeSite.announcement_bar ?? { text: "", type: "info" }), active: v } }))} />
            <Label htmlFor="ann-active">Announcement bar active</Label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ann-text">Announcement text</Label>
            <Input id="ann-text" value={activeSite.announcement_bar?.text ?? ""}
              onChange={(e) => setSite((s) => ({ ...s, announcement_bar: { ...(activeSite.announcement_bar ?? { active: false, type: "info" }), text: e.target.value } }))} />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => siteMut.mutate(site)} disabled={siteMut.isPending || Object.keys(site).length === 0}>
              {siteMut.isPending ? "Saving…" : "Save site config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* FeatureConfig */}
      <Card>
        <CardHeader><CardTitle>Feature flags</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {FEATURE_LABELS.map(([key, label, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={!!activeFeatures[key]}
                onCheckedChange={(v) => {
                  setFeatures((f) => ({ ...f, [key]: v }));
                  featureMut.mutate({ [key]: v });
                }} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RewardsConfig */}
      <Card>
        <CardHeader><CardTitle>Rewards configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Active config: <span className="font-medium text-foreground">{rewardsQ.data?.active?.name ?? "none"}</span>
            {rewardsQ.data?.active?.is_active ? " (live)" : ""}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rwd-name">Config name</Label>
            <Input id="rwd-name" value={rewardsName} onChange={(e) => setRewardsName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rwd-json">Reward rules (JSON)</Label>
            <Textarea id="rwd-json" rows={8} value={rewardsJson} onChange={(e) => setRewardsJson(e.target.value)} className="font-mono text-xs" />
          </div>
          <Button onClick={() => rewardsMut.mutate()} disabled={rewardsMut.isPending}>
            {rewardsMut.isPending ? "Saving…" : "Save & activate rewards config"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

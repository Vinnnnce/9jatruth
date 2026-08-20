"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Palette, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/hooks/use-toast";

type Profile = {
  id: number | string;
  description?: string | null;
  tagline?: string | null;
  accentColor?: string | null;
  subdomain?: string | null;
  website?: string | null;
  contactPhone?: string | null;
};

const PRESETS = ["#1d4ed8", "#b45309", "#7c3aed", "#15803d", "#c2410c", "#0e7490", "#be123c", "#4338ca"];

export function OrgCustomizeForm({ orgId, profile }: { orgId: number | string; profile: Profile }) {
  const { toast } = useToast();
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [description, setDescription] = useState(profile.description ?? "");
  const [accentColor, setAccentColor] = useState(profile.accentColor ?? "#1d4ed8");
  const [subdomain, setSubdomain] = useState(profile.subdomain ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? "");

  const mutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/organizations/${orgId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mini-site updated", description: "Your changes are live." });
    },
    onError: (e: Error) => {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    },
  });

  const save = () => {
    mutation.mutate({
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      accentColor,
      subdomain: subdomain.trim() ? subdomain.trim().toLowerCase() : null,
      website: website.trim() || null,
      contactPhone: contactPhone.trim() || null,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Customize mini-site</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        These appear on your public page at <code className="font-mono">/org/{orgId}</code>.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs">Tagline</Label>
        <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short one-line summary" maxLength={120} className="h-8 text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">About</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell visitors about your organization" maxLength={500} rows={3} className="text-xs" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Accent color</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccentColor(c)}
              className="h-6 w-6 rounded-full border-2 border-background ring-1 ring-border flex items-center justify-center"
              style={{ background: c }}
              aria-label={`Pick color ${c}`}
            >
              {accentColor.toLowerCase() === c && <Check className="h-3 w-3 text-white" />}
            </button>
          ))}
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-6 w-6 rounded border border-border bg-transparent cursor-pointer" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Subdomain</Label>
          <div className="flex items-center">
            <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="yourname" className="h-8 text-xs rounded-r-none" />
            <span className="h-8 px-2 inline-flex items-center text-[10px] text-muted-foreground border border-l-0 border-input rounded-r-md bg-muted">.9jatruth.com</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Public phone" className="h-8 text-xs" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Website</Label>
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="h-8 text-xs" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">Subdomains map to custom URLs once a wildcard domain is added in Vercel.</p>
        <Button size="sm" onClick={save} disabled={mutation.isPending}>
          {mutation.isPending ? <Save className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

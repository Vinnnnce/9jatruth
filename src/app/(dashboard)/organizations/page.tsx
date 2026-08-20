"use client";

/**
 * Partner Businesses page
 * 
 * Lists all partner agencies/businesses and provides
 * a form to register a new business.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Globe, Mail, Phone, MapPin, CheckCircle2, Plus, Shield, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/hooks/use-toast";
import { VerifiedBadge } from "@/components/verified-badge";

type Organization = {
  id: number;
  name: string;
  type: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string | null;
  website: string | null;
  logoUrl: string | null;
  region: string | null;
  city: string | null;
  verified: number;
  active: number;
  createdAt: string;
};

const ORG_TYPES: Record<string, { label: string; color: string }> = {
  government: { label: "Government", color: "text-blue-500 bg-blue-500/10" },
  utility: { label: "Utility Company", color: "text-amber-500 bg-amber-500/10" },
  media: { label: "Media", color: "text-purple-500 bg-purple-500/10" },
  ngo: { label: "NGO", color: "text-green-500 bg-green-500/10" },
  community: { label: "Community Group", color: "text-orange-500 bg-orange-500/10" },
  corporate: { label: "Corporate", color: "text-cyan-500 bg-cyan-500/10" },
};

export default function Organizations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "", description: "", contactEmail: "", contactPhone: "",
    website: "", region: "", city: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orgs, isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizations");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Business Registered", description: "Your business is pending verification." });
      setDialogOpen(false);
      setForm({ name: "", type: "", description: "", contactEmail: "", contactPhone: "", website: "", region: "", city: "" });
    },
    onError: () => {
      toast({ title: "Registration Failed", description: "Please check your details and try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-700">Partner Businesses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verified agencies and businesses contributing to community truth
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Register Business
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> Register Your Business
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Business Name</Label>
                <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Eko Electricity Distribution" />
              </div>
              <div>
                <Label htmlFor="type">Business Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ORG_TYPES).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of your business..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">Contact Email</Label>
                  <Input id="email" type="email" required value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="admin@org.gov.ng" />
                </div>
                <div>
                  <Label htmlFor="phone">Contact Phone</Label>
                  <Input id="phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+234..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="region">Region/State</Label>
                  <Input id="region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Lagos" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Ikeja" />
                </div>
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Registering..." : "Register Business"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      ) : orgs && orgs.length > 0 ? (
        <div className="space-y-3">
          {orgs.map((org) => {
            const typeCfg = ORG_TYPES[org.type] || { label: org.type, color: "text-gray-500 bg-gray-500/10" };
            return (
              <Card key={org.id} className="hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{org.name}</span>
                        {org.verified === 1 && (
                          <VerifiedBadge showLabel />
                        )}
                        <Badge variant="secondary" className={`text-[9px] ${typeCfg.color}`}>
                          {typeCfg.label}
                        </Badge>
                        {org.verified === 0 && (
                          <Badge variant="outline" className="text-[9px] text-amber-500">
                            <Shield className="h-2.5 w-2.5" /> Pending
                          </Badge>
                        )}
                      </div>
                      {org.description && <p className="text-xs text-muted-foreground line-clamp-2">{org.description}</p>}
                      <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                        {org.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{org.city}, {org.region}</span>}
                        {org.contactEmail && <span className="flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{org.contactEmail}</span>}
                        {org.contactPhone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{org.contactPhone}</span>}
                        <Link href={`/org/${org.id}`} className="flex items-center gap-0.5 hover:underline text-primary"><ExternalLink className="h-2.5 w-2.5" />Mini-site</Link>
                        {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 hover:underline text-primary"><Globe className="h-2.5 w-2.5" />Website</a>}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No partner businesses registered yet.</p>
            <p className="text-xs mt-1">Be the first to register your business.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

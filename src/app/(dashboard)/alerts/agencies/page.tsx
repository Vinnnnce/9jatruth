"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AgencyLogo } from "@/components/agency-logo";
import {
  EMERGENCY_AGENCIES, NIGERIAN_STATES, EmergencyAgency,
} from "@/lib/emergency-agencies";
import {
  Search, Phone, Mail, MapPin, ChevronRight, ArrowLeft, Building2, ExternalLink, ShieldCheck,
  LocateFixed,
} from "lucide-react";

type Contact = {
  id: number; agencyType: string; agencyName: string;
  phonePrimary: string | null; phoneSecondary: string | null;
  email: string | null; address: string | null;
  state: string | null; lga: string | null; verified: boolean;
};

const CATEGORIES = [
  "All", "Security & Law Enforcement", "Emergency Response",
  "Medical & Rescue", "Regulatory & Anti-Crime", "Armed Forces",
] as const;

export default function AgenciesDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [state, setState] = useState<string>("all");
  // "detecting" | "detected" | "failed" — tracks the IP auto-location lookup
  const [locationStatus, setLocationStatus] = useState<
    "detecting" | "detected" | "failed"
  >("detecting");
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  // If the user manually picks a state, don't let a late IP lookup override it.
  const manualOverrideRef = useRef(false);

  // Auto-detect the caller's nearest Nigerian state from their IP address so
  // the directory surfaces nearby agency contacts by default instead of
  // always falling back to FCT/Abuja.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/alerts/my-location", { cache: "no-store" });
        if (!res.ok) throw new Error("lookup failed");
        const data = (await res.json()) as {
          state: string | null; city: string | null; source: string;
        };
        if (cancelled) return;
        if (data.state) {
          setDetectedState(data.state);
          setDetectedLabel(
            data.city ? `${data.city}, ${data.state}` : data.state
          );
          setLocationStatus("detected");
          if (!manualOverrideRef.current) setState(data.state);
        } else {
          setLocationStatus("failed");
        }
      } catch {
        if (!cancelled) setLocationStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data, isLoading } = useQuery<{ contacts: Contact[] }>({
    queryKey: ["agency-contacts", state],
    queryFn: async () => {
      if (state === "all") return { contacts: [] };
      const res = await fetch(`/api/alerts/emergency-contacts?state=${encodeURIComponent(state)}`);
      if (!res.ok) return { contacts: [] };
      return res.json();
    },
    enabled: state !== "all",
    staleTime: 5 * 60 * 1000, // cache agency contacts for 5 minutes
  });

  // Map of agency_type -> state-specific contact (if any)
  const stateContactMap = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of data?.contacts ?? []) m.set(c.agencyType, c);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    return EMERGENCY_AGENCIES.filter((a) => {
      const matchesQuery =
        !query ||
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.shortName.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase()) ||
        a.services.join(" ").toLowerCase().includes(query.toLowerCase());
      const matchesCat = category === "All" || a.category === category;
      return matchesQuery && matchesCat;
    });
  }, [query, category]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/alerts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Alert
        </Link>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Emergency Agencies Directory</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Verified contact details for every Nigerian law enforcement and emergency agency —
          filter by state, LGA, or community to find the office nearest to you. Tap any agency for
          full details, AI-powered safety guidance, and direct call links.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agencies, services, or category..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-60"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={(v) => { manualOverrideRef.current = true; setState(v); }}>
          <SelectTrigger className="sm:w-48">
            <MapPin className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Location banner: nearest agencies from IP */}
      {locationStatus === "detected" && detectedLabel && state === detectedState && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          <LocateFixed className="h-4 w-4 shrink-0" />
          <span>
            Showing agency contacts nearest to you in{" "}
            <strong>{detectedLabel}</strong>. Wrong location? Pick your state above.
          </span>
        </div>
      )}
      {locationStatus === "failed" && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>
            We couldn&apos;t detect your location automatically. Select your state above to see
            nearby agency contacts.
          </span>
        </div>
      )}

      {state !== "all" && (
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? `Loading ${state} contacts…`
            : `Showing ${data?.contacts?.length ?? 0} state-specific contact${(data?.contacts?.length ?? 0) === 1 ? "" : "s"} for ${state}. National HQ details are listed on each agency's page.`}
        </p>
      )}

      {/* Agency grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((a) => (
          <AgencyCard
            key={a.slug}
            agency={a}
            stateContact={stateContactMap.get(a.type)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No agencies match your search.
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">Important:</strong> 112 is Nigeria's official national
        emergency number and routes to the nearest emergency response centre. Agency office lines and
        emails are publicly listed on the agencies' official websites; always confirm local numbers
        before relying on them in an emergency.
      </div>
    </div>
  );
}

function AgencyCard({ agency, stateContact }: { agency: EmergencyAgency; stateContact?: Contact }) {
  const phone = stateContact?.phonePrimary ?? agency.phonePrimary;
  const secondary = stateContact?.phoneSecondary ?? agency.phoneSecondary;
  const address = stateContact?.address ?? agency.address;
  const email = stateContact?.email ?? agency.email;
  const stateLabel = stateContact?.state ? `${stateContact.state} office` : "National HQ";

  return (
    <Link href={`/alerts/agencies/${agency.slug}`} className="block group">
      <Card className="h-full hover:border-emerald-500/40 hover:bg-muted/30 transition-colors">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AgencyLogo agency={agency} size={48} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight">{agency.name}</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-emerald-500 transition-colors" />
              </div>
              <Badge variant="secondary" className="mt-1 text-[9px] h-4">{agency.category}</Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">{agency.description}</p>

          <div className="space-y-1.5 pt-1 border-t border-border">
            <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 text-xs font-medium text-emerald-600 hover:underline">
              <Phone className="h-3.5 w-3.5" /> {phone}
              {secondary && <span className="text-muted-foreground font-normal">· {secondary}</span>}
            </a>
            {email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {email}
              </div>
            )}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{address}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Badge variant="outline" className="text-[9px] h-4 px-1 gap-1">
              <Building2 className="h-2.5 w-2.5" /> {stateLabel}
            </Badge>
            {agency.website && (
              <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
                <ExternalLink className="h-2.5 w-2.5" /> Official site
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

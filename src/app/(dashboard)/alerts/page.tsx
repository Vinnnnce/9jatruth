"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { AgencyLogo } from "@/components/agency-logo";
import { getAgencyByType } from "@/lib/emergency-agencies";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useToast } from "@/components/hooks/use-toast";
import {
  Zap, Fuel, Car, Tag, Shield, MapPin, AlertTriangle, AlertCircle, Info, Clock, Bell, BellRing,
  Phone, Siren, Activity, Brain, Navigation, ChevronDown, Search, Loader2, Stethoscope,
  Cross, Truck, Flame, Building2, Gavel, Pill, ShieldCheck, Users, FileWarning,
} from "lucide-react";

// === Types ===
type Alert = {
  id: string;
  neighborhoodId: number;
  neighborhood: string;
  region: string;
  category: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  detectedAt: string;
};

type EmergencyContact = {
  id: number;
  agencyType: string;
  agencyName: string;
  phonePrimary: string | null;
  phoneSecondary: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  community: string | null;
  verified: boolean;
};

type TriageResult = {
  severity: string;
  severityLabel: string;
  recommendedAgency: { type: string; name: string } | null;
  safetySteps: string[];
  contacts: EmergencyContact[];
  generalContacts: EmergencyContact[];
  aiAnalysis: string;
  timestamp: string;
};

// === Config ===
const categoryIcons: Record<string, typeof Zap> = {
  power: Zap, fuel: Fuel, traffic: Car, prices: Tag, safety: Shield,
};

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", label: "Critical" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", label: "Warning" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
};

const agencyIcons: Record<string, typeof Shield> = {
  police: Shield,
  civil_defence: ShieldCheck,
  road_safety: Car,
  army: Users,
  customs: Building2,
  fire_service: Flame,
  hospital_emergency: Stethoscope,
  ambulance: Truck,
  efcc: Gavel,
  ndlea: Pill,
  nafdac: FileWarning,
  mopol: Siren,
  dss: Brain,
};

const agencyLabels: Record<string, string> = {
  police: "Police",
  civil_defence: "Civil Defence",
  road_safety: "Road Safety",
  army: "Army",
  customs: "Customs",
  fire_service: "Fire Service",
  hospital_emergency: "Hospital Emergency",
  ambulance: "Ambulance",
  efcc: "EFCC",
  ndlea: "NDLEA",
  nafdac: "NAFDAC",
  mopol: "Mopol",
  dss: "DSS",
};

const agencyColors: Record<string, string> = {
  police: "text-blue-400 bg-blue-500/10",
  civil_defence: "text-cyan-400 bg-cyan-500/10",
  road_safety: "text-green-400 bg-green-500/10",
  army: "text-stone-400 bg-stone-500/10",
  customs: "text-indigo-400 bg-indigo-500/10",
  fire_service: "text-red-400 bg-red-500/10",
  hospital_emergency: "text-pink-400 bg-pink-500/10",
  ambulance: "text-orange-400 bg-orange-500/10",
  efcc: "text-yellow-400 bg-yellow-500/10",
  ndlea: "text-purple-400 bg-purple-500/10",
  nafdac: "text-teal-400 bg-teal-500/10",
  mopol: "text-slate-400 bg-slate-500/10",
  dss: "text-gray-400 bg-gray-500/10",
};

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

const AGENCY_TYPES = Object.keys(agencyLabels);

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// === Emergency Contacts Section ===
function EmergencyContactsSection() {
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [community, setCommunity] = useState("");
  const [agencyType, setAgencyType] = useState("");
  const [searchKey, setSearchKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["emergency-contacts", searchKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (lga) params.set("lga", lga);
      if (community) params.set("community", community);
      if (agencyType) params.set("agencyType", agencyType);
      const res = await apiRequest("GET", `/api/alerts/emergency-contacts?${params.toString()}`);
      return res.json();
    },
    retry: 1,
  });

  const contacts: EmergencyContact[] = data?.contacts || [];
  const grouped: Record<string, EmergencyContact[]> = data?.grouped || {};

  const handleSearch = () => {
    setSearchKey(`${state}-${lga}-${community}-${agencyType}-${Date.now()}`);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Siren className="h-4 w-4 text-red-500" />
          Emergency Contacts Directory
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nigerian law enforcement and emergency agency contacts near you
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">State</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">All States</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">L.G.A</Label>
            <Input
              className="h-9 text-xs"
              placeholder="e.g. Ikeja"
              value={lga}
              onChange={(e) => setLga(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Community</Label>
            <Input
              className="h-9 text-xs"
              placeholder="e.g. Garki"
              value={community}
              onChange={(e) => setCommunity(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Agency Type</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={agencyType}
              onChange={(e) => setAgencyType(e.target.value)}
            >
              <option value="">All Agencies</option>
              {AGENCY_TYPES.map((a) => (
                <option key={a} value={a}>{agencyLabels[a]}</option>
              ))}
            </select>
          </div>
        </div>
        <Button size="sm" className="w-full gap-1" onClick={handleSearch}>
          <Search className="h-3.5 w-3.5" /> Search Contacts
        </Button>
        <Link
          href="/alerts/agencies"
          className="inline-flex items-center justify-center gap-1.5 text-xs text-emerald-600 hover:underline pt-1"
        >
          Browse all agencies &amp; their details →
        </Link>

        {/* Results */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        )}

        {!isLoading && contacts.length === 0 && (
          <div className="text-center py-6">
            <Shield className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">
              No contacts found. Try adjusting filters or use national contacts.
            </p>
          </div>
        )}

        {!isLoading && contacts.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] text-muted-foreground">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""} found
              {state && ` in ${state}`}
              {lga && `, ${lga}`}
            </p>
            {Object.entries(grouped).map(([type, items]) => {
              const Icon = agencyIcons[type] || Shield;
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const meta = getAgencyByType(type);
                      return meta ? (
                        <AgencyLogo agency={meta} size={24} />
                      ) : (
                        <div className={`rounded p-1 ${agencyColors[type] || "bg-muted"}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                      );
                    })()}
                    <span className="text-xs font-medium">{agencyLabels[type] || type}</span>
                  </div>
                  {items.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/30"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.agencyName}</p>
                        {c.address && (
                          <p className="text-[10px] text-muted-foreground truncate">{c.address}</p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          {c.state && (
                            <span className="text-[9px] text-muted-foreground">{c.state}{c.lga ? `, ${c.lga}` : ""}</span>
                          )}
                          {c.verified && (
                            <Badge variant="outline" className="text-[8px] py-0 px-1 h-3.5 text-green-500 border-green-500/30">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.phonePrimary && (
                          <a href={`tel:${c.phonePrimary}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-0.5 text-[10px]">
                              <Phone className="h-3 w-3" /> {c.phonePrimary}
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === AI Triage Section ===
function AITriageSection() {
  const [description, setDescription] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);

  const handleAssess = async () => {
    if (description.trim().length < 3) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/alerts/assess", {
        description,
        state: state || undefined,
        lga: lga || undefined,
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        severity: "info",
        severityLabel: "Information",
        recommendedAgency: null,
        safetySteps: ["Call 112 for general emergencies"],
        contacts: [],
        generalContacts: [],
        aiAnalysis: "Unable to analyze. Please call 112 for assistance.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const sevConf = result ? severityConfig[result.severity as keyof typeof severityConfig] || severityConfig.info : null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          AI Emergency Triage
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Describe an incident and get AI-recommended agency, severity, and safety steps
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Describe the emergency/incident</Label>
          <textarea
            className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-xs resize-none"
            placeholder="e.g. There's a fire in my building on Allen Avenue, Ikeja. Smoke is everywhere and people are trapped."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">State (optional)</Label>
            <select
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Select State</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">L.G.A (optional)</Label>
            <Input
              className="h-9 text-xs"
              placeholder="e.g. Ikeja"
              value={lga}
              onChange={(e) => setLga(e.target.value)}
            />
          </div>
        </div>
        <Button
          size="sm"
          className="w-full gap-1"
          onClick={handleAssess}
          disabled={loading || description.trim().length < 3}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          {loading ? "Analyzing..." : "Assess with AI"}
        </Button>

        {/* Results */}
        {result && sevConf && (
          <div className="space-y-3 pt-2 border-t border-border">
            {/* Severity badge */}
            <div className={`rounded-md ${sevConf.bg} ${sevConf.border} border p-3`}>
              <div className="flex items-center gap-2 mb-1">
                <sevConf.icon className={`h-4 w-4 ${sevConf.color}`} />
                <span className={`text-xs font-medium ${sevConf.color}`}>{result.severityLabel}</span>
              </div>
              {result.recommendedAgency && (
                <p className="text-xs">
                  Recommended: <span className="font-medium">{result.recommendedAgency.name}</span>
                </p>
              )}
            </div>

            {/* AI Analysis */}
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-center gap-1 mb-1">
                <Brain className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-medium text-primary">AI Analysis</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{result.aiAnalysis}</p>
            </div>

            {/* Safety Steps */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Safety Steps</p>
              <ol className="space-y-1">
                {result.safetySteps.map((step, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <span className="text-primary font-medium">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Recommended Contacts */}
            {result.contacts.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Recommended Contacts
                </p>
                <div className="space-y-1.5">
                  {result.contacts.map((c) => {
                    const Icon = agencyIcons[c.agencyType] || Shield;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className={`rounded p-1 ${agencyColors[c.agencyType] || "bg-muted"}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{c.agencyName}</p>
                            {c.address && <p className="text-[9px] text-muted-foreground truncate">{c.address}</p>}
                          </div>
                        </div>
                        {c.phonePrimary && (
                          <a href={`tel:${c.phonePrimary}`}>
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-0.5 text-[10px]">
                              <Phone className="h-3 w-3" /> Call
                            </Button>
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Emergency Contacts */}
            {result.generalContacts.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  General Emergency
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {result.generalContacts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-red-500/5 border border-red-500/20">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-red-500" />
                        <span className="text-[10px] font-medium">{c.agencyName}</span>
                      </div>
                      {c.phonePrimary && (
                        <a href={`tel:${c.phonePrimary}`} className="text-[10px] font-medium text-red-500 hover:underline">
                          {c.phonePrimary}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// === Main Alerts Page ===
export default function Alerts() {
  const { supported, permission, subscribed, configured, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();
  const [pushLoading, setPushLoading] = useState(false);
  const { data, isLoading, isError } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts");
      return res.json();
    },
    retry: 1,
  });

  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Failed to load alerts. Will retry...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const critical = (data || []).filter(a => a.severity === "critical");
  const warning = (data || []).filter(a => a.severity === "warning");
  const byCategory: Record<string, number> = {};
  (data || []).forEach(a => { byCategory[a.category] = (byCategory[a.category] || 0) + 1; });

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-display font-700">Alerts & Emergency Center</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time alerts, emergency contacts, and AI-powered incident triage
        </p>
      </div>

      {/* Push Notification Section */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {subscribed ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Push Notifications</p>
                <p className="text-xs text-muted-foreground truncate">
                  {!supported
                    ? "Push not supported on this device"
                    : permission === "denied"
                    ? "Blocked — enable in browser settings"
                    : !configured
                    ? "Server not configured yet"
                    : subscribed
                    ? "Enabled — receiving real-time alerts"
                    : "Get alerts delivered to your device in real time"}
                </p>
              </div>
            </div>
            {!supported ? (
              <Badge variant="outline" className="text-[10px] self-start sm:self-auto">Unsupported</Badge>
            ) : (
              <Button
                size="sm"
                variant={subscribed ? "outline" : "default"}
                className="gap-1.5 w-full sm:w-auto"
                disabled={pushLoading || permission === "denied"}
                onClick={async () => {
                  setPushLoading(true);
                  try {
                    if (subscribed) {
                      const ok = await unsubscribe();
                      toast({
                        title: ok ? "Push disabled" : "Could not disable",
                        description: ok ? "You will stop receiving alerts." : "Please try again.",
                        variant: ok ? "default" : "destructive",
                      });
                    } else {
                      const ok = await subscribe();
                      if (ok) {
                        toast({
                          title: "Push enabled",
                          description: "You will now receive real-time alerts for your areas.",
                        });
                      } else {
                        toast({
                          title: "Could not enable push",
                          description: permission === "denied"
                            ? "Notifications are blocked. Enable in browser settings."
                            : "Check your browser permissions and try again.",
                          variant: "destructive",
                        });
                      }
                    }
                  } catch {
                    toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
                  } finally {
                    setPushLoading(false);
                  }
                }}
              >
                {pushLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {subscribed ? "Disabling..." : "Enabling..."}</>
                ) : subscribed ? (
                  <><Bell className="h-3.5 w-3.5" /> Disable Push</>
                ) : (
                  <><BellRing className="h-3.5 w-3.5" /> Enable Push</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Critical</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums text-red-500">{critical.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Warnings</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums text-amber-500">{warning.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">{(data || []).length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Areas Affected</span>
            </div>
            <p className="text-lg font-display font-700 tabular-nums">
              {new Set((data || []).map(a => a.neighborhoodId)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Triage + Emergency Contacts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AITriageSection />
        <EmergencyContactsSection />
      </div>

      {/* Active Alerts List */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium flex items-center gap-1.5">
          <Siren className="h-4 w-4 text-red-500" /> Active Alerts
        </h2>
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        )}
        {!isLoading && (data || []).length === 0 && (
          <Card className="border-border">
            <CardContent className="p-8 text-center">
              <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active alerts. All neighborhoods are stable.</p>
            </CardContent>
          </Card>
        )}
        {(data || []).map((alert) => {
          const config = severityConfig[alert.severity];
          const SevIcon = config.icon;
          const CatIcon = categoryIcons[alert.category] || Info;
          return (
            <Card key={alert.id} className={`border-border ${config.border} animate-fade-in`}>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-md ${config.bg} p-2 shrink-0`}>
                    <SevIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{alert.title}</span>
                      <Badge variant="outline" className={`text-[9px] ${config.color} border-current`}>
                        {config.label}
                      </Badge>
                      <CatIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground capitalize">{alert.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Link href={`/map`}>
                        <span className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {alert.neighborhood}, {alert.region}
                        </span>
                      </Link>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {timeAgo(alert.detectedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

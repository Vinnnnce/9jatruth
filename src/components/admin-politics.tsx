"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2, XCircle, Trash2, Plus, Users, Vote, ShieldAlert, Flag,
  Trophy, Sparkles, Search, GitCompare, AlertTriangle, Edit, FileText, Heart,
} from "lucide-react";

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const OFFICES = [
  { value: "presidential", label: "Presidential", level: "federal" },
  { value: "governor", label: "State Governor", level: "state" },
  { value: "senate", label: "Senate", level: "federal" },
  { value: "house", label: "House of Reps", level: "federal" },
  { value: "lga_chairman", label: "LGA Chairman", level: "lga" },
  { value: "councillor", label: "Councillor", level: "lga" },
];

const RECORD_TYPES = ["incumbent", "candidate", "aspirant", "nominee", "unverified"];
const VERIFY_STATUS = ["unverified", "pending", "verified", "disputed"];

const EMPTY_CAND = {
  id: undefined as number | undefined, name: "", party_acronym: "", office: "governor",
  office_level: "state", geo_id: "", state: "", lga: "", ward: "", senatorial_district: "",
  federal_constituency: "", state_constituency: "", election_year: "2027", record_type: "candidate",
  gender: "", date_of_birth: "", place_of_birth: "", hometown: "", state_of_origin: "",
  local_govt_of_origin: "", bio: "", autobiography: "", education_background: "", previous_political_positions: "",
  political_background: "", businesses: "", business_interests: "", net_worth: "", health_status: "",
  manifesto: "", campaign_slogan: "", key_policies: "", phone: "", email: "", website: "",
  facebook: "", twitter: "", instagram: "", linkedin: "", running_mate: "", incumbent_since: "",
  term_start: "", term_end: "", previous_party: "", achievements: "", controversies: "",
  corruption_allegations: "", court_cases: "", criminal_record: "", photo_url: "", verification_status: "unverified",
  data_confidence: "0", source_urls: "",
};

const CRITICAL_FIELDS = [
  "photo_url", "date_of_birth", "education_background", "political_background",
  "businesses", "health_status", "manifesto", "source_urls", "previous_political_positions",
];

function missingCount(c: any): number {
  return CRITICAL_FIELDS.filter((f) => {
    const v = c[f];
    if (v == null) return true;
    if (typeof v === "string") return v.trim() === "" || v === "[]" || v === "{}";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }).length;
}

export function AdminPolitics() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filters, setFilters] = useState({ office: "", state: "", type: "", verified: "", search: "" });
  const [cand, setCand] = useState<any>({ ...EMPTY_CAND });
  const [editingId, setEditingId] = useState<number | undefined>(undefined);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.office) p.set("office", filters.office);
    if (filters.state) p.set("state", filters.state);
    if (filters.type) p.set("type", filters.type);
    if (filters.verified) p.set("verified", filters.verified);
    if (filters.search) p.set("search", filters.search);
    return p.toString();
  }, [filters]);

  const parties = useQuery({ queryKey: ["/api/politics/parties"], queryFn: () => apiRequest("GET", "/api/politics/parties").then((r) => r.json()) });
  const candidates = useQuery({
    queryKey: [`/api/politics/candidates?${queryString}`],
    queryFn: () => apiRequest("GET", `/api/politics/candidates?${queryString}`).then((r) => r.json()),
  });
  const events = useQuery({ queryKey: ["/api/admin/politics/events"], queryFn: () => apiRequest("GET", "/api/admin/politics/events?status=all").then((r) => r.json()) });

  const candMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/candidates", { ...data, election_year: data.election_year ? Number(data.election_year) : null, data_confidence: data.data_confidence ? Number(data.data_confidence) : null }),
    onSuccess: (r) => r.json().then((res) => { qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] }); toast({ title: `Candidate ${res.action}` }); resetForm(); }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/politics/candidates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] }); toast({ title: "Candidate deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status, confidence }: { id: number; status: string; confidence?: number }) =>
      apiRequest("PATCH", `/api/politics/candidates/${id}`, { verification_status: status, data_confidence: confidence }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] }); toast({ title: "Verification updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const modMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/admin/politics/events/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/events"] }); qc.invalidateQueries({ queryKey: ["/api/politics/events?status=all"] }); toast({ title: "Event updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const aiMutation = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/politics/candidates/ai-insights", payload),
    onSuccess: (r) => r.json().then((res) => {
      qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] });
      if (res.gaps) toast({ title: `Data gaps: ${res.totalGaps} missing fields across ${res.gaps.length} candidates` });
      else toast({ title: "AI analysis complete", description: `Source: ${res.source || "fallback"}` });
    }),
    onError: (e: any) => toast({ title: "AI failed", description: e.message, variant: "destructive" }),
  });

  const partiesData = parties.data?.parties ?? [];
  const candidatesData = candidates.data?.candidates ?? [];
  const eventsData = events.data?.events ?? [];
  const pendingCount = eventsData.filter((e: any) => e.status === "pending" || e.status === "flagged").length;
  const totalGaps = candidatesData.reduce((s: number, c: any) => s + missingCount(c), 0);

  function resetForm() { setCand({ ...EMPTY_CAND }); setEditingId(undefined); }
  function startEdit(c: any) {
    const e: any = { ...EMPTY_CAND };
    for (const k of Object.keys(e)) e[k] = c[k] != null ? String(c[k]) : "";
    setCand(e); setEditingId(c.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const set = (k: string, v: string) => setCand((f: any) => ({ ...f, [k]: v }));

  function toggleCompare(id: number) {
    setSelectedForCompare((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 6 ? [...prev, id] : prev);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Parties</div><div className="text-2xl font-bold font-mono">{partiesData.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Candidates</div><div className="text-2xl font-bold font-mono">{candidatesData.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Data gaps</div><div className={`text-2xl font-bold font-mono ${totalGaps > 0 ? "text-amber-500" : "text-emerald-500"}`}>{totalGaps}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending events</div><div className="text-2xl font-bold font-mono text-amber-500">{pendingCount}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="candidates">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="candidates"><Users className="h-3.5 w-3.5 mr-1" /> Candidates</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" /> AI Tools</TabsTrigger>
          <TabsTrigger value="parties"><Vote className="h-3.5 w-3.5 mr-1" /> Parties</TabsTrigger>
          <TabsTrigger value="events"><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Reports</TabsTrigger>
        </TabsList>

        {/* ── Candidates tab ── */}
        <TabsContent value="candidates" className="space-y-4 mt-4">
          {/* Filters */}
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Search className="h-4 w-4" /> Filter Candidates</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Input placeholder="Search name" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
              <Select value={filters.office} onValueChange={(v) => setFilters({ ...filters, office: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Office" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All offices</SelectItem>{OFFICES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent className="max-h-60"><SelectItem value="all">All states</SelectItem>{NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All types</SelectItem>{RECORD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filters.verified} onValueChange={(v) => setFilters({ ...filters, verified: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Verified" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All status</SelectItem>{VERIFY_STATUS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Candidate form */}
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Plus className="h-4 w-4" /> {editingId ? "Edit Candidate" : "Add Candidate / Officeholder"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <Input placeholder="Full name" value={cand.name} onChange={(e) => set("name", e.target.value)} />
                <Input placeholder="Party (APC)" value={cand.party_acronym} onChange={(e) => set("party_acronym", e.target.value.toUpperCase())} />
                <Select value={cand.office} onValueChange={(v) => { const o = OFFICES.find((x) => x.value === v); set("office", v); set("office_level", o?.level || ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OFFICES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={cand.state} onValueChange={(v) => set("state", v)}>
                  <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent className="max-h-60">{NIGERIA_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="LGA" value={cand.lga} onChange={(e) => set("lga", e.target.value)} />
                <Input placeholder="Ward" value={cand.ward} onChange={(e) => set("ward", e.target.value)} />
                <Select value={cand.record_type} onValueChange={(v) => set("record_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Record type" /></SelectTrigger>
                  <SelectContent>{RECORD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Election year (2027)" value={cand.election_year} onChange={(e) => set("election_year", e.target.value)} />
                <Select value={cand.verification_status} onValueChange={(v) => set("verification_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Verification" /></SelectTrigger>
                  <SelectContent>{VERIFY_STATUS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <details className="rounded-md border border-border p-2" open>
                <summary className="text-xs font-medium cursor-pointer">Personal & Background</summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  <Select value={cand.gender} onValueChange={(v) => set("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                    <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
                  </Select>
                  <Input placeholder="Date of birth" value={cand.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                  <Input placeholder="Place of birth" value={cand.place_of_birth} onChange={(e) => set("place_of_birth", e.target.value)} />
                  <Input placeholder="Hometown" value={cand.hometown} onChange={(e) => set("hometown", e.target.value)} />
                  <Input placeholder="State of origin" value={cand.state_of_origin} onChange={(e) => set("state_of_origin", e.target.value)} />
                  <Input placeholder="LGA of origin" value={cand.local_govt_of_origin} onChange={(e) => set("local_govt_of_origin", e.target.value)} />
                </div>
                <div className="space-y-2 mt-2">
                  <Textarea placeholder="Autobiography" value={cand.autobiography} onChange={(e) => set("autobiography", e.target.value)} rows={2} />
                  <Textarea placeholder="Education background (one per line)" value={cand.education_background} onChange={(e) => set("education_background", e.target.value)} rows={2} />
                  <Textarea placeholder="Previous political positions (one per line)" value={cand.previous_political_positions} onChange={(e) => set("previous_political_positions", e.target.value)} rows={2} />
                  <Textarea placeholder="Political background" value={cand.political_background} onChange={(e) => set("political_background", e.target.value)} rows={2} />
                </div>
              </details>

              <details className="rounded-md border border-border p-2">
                <summary className="text-xs font-medium cursor-pointer">Businesses, Wealth & Health</summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <Textarea placeholder="Businesses (one per line)" value={cand.businesses} onChange={(e) => set("businesses", e.target.value)} rows={2} />
                  <Input placeholder="Business interests" value={cand.business_interests} onChange={(e) => set("business_interests", e.target.value)} />
                  <Input placeholder="Net worth" value={cand.net_worth} onChange={(e) => set("net_worth", e.target.value)} />
                  <Input placeholder="Health status" value={cand.health_status} onChange={(e) => set("health_status", e.target.value)} />
                </div>
              </details>

              <details className="rounded-md border border-border p-2">
                <summary className="text-xs font-medium cursor-pointer">Manifesto & Campaign</summary>
                <div className="space-y-2 mt-2">
                  <Textarea placeholder="Manifesto" value={cand.manifesto} onChange={(e) => set("manifesto", e.target.value)} rows={3} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Campaign slogan" value={cand.campaign_slogan} onChange={(e) => set("campaign_slogan", e.target.value)} />
                    <Input placeholder="Key policies (comma-separated)" value={cand.key_policies} onChange={(e) => set("key_policies", e.target.value)} />
                  </div>
                </div>
              </details>

              <details className="rounded-md border border-border p-2">
                <summary className="text-xs font-medium cursor-pointer">Contact, Social & Term</summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                  <Input placeholder="Phone" value={cand.phone} onChange={(e) => set("phone", e.target.value)} />
                  <Input placeholder="Email" value={cand.email} onChange={(e) => set("email", e.target.value)} />
                  <Input placeholder="Website" value={cand.website} onChange={(e) => set("website", e.target.value)} />
                  <Input placeholder="Facebook" value={cand.facebook} onChange={(e) => set("facebook", e.target.value)} />
                  <Input placeholder="Twitter/X" value={cand.twitter} onChange={(e) => set("twitter", e.target.value)} />
                  <Input placeholder="Instagram" value={cand.instagram} onChange={(e) => set("instagram", e.target.value)} />
                  <Input placeholder="Running mate" value={cand.running_mate} onChange={(e) => set("running_mate", e.target.value)} />
                  <Input placeholder="Incumbent since" value={cand.incumbent_since} onChange={(e) => set("incumbent_since", e.target.value)} />
                  <Input placeholder="Term start" value={cand.term_start} onChange={(e) => set("term_start", e.target.value)} />
                </div>
              </details>

              <details className="rounded-md border border-border p-2">
                <summary className="text-xs font-medium cursor-pointer">Integrity, Achievements & Sources</summary>
                <div className="space-y-2 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Textarea placeholder="Corruption allegations (one per line)" value={cand.corruption_allegations} onChange={(e) => set("corruption_allegations", e.target.value)} rows={2} />
                    <Textarea placeholder="Court cases (one per line)" value={cand.court_cases} onChange={(e) => set("court_cases", e.target.value)} rows={2} />
                    <Textarea placeholder="Achievements (one per line)" value={cand.achievements} onChange={(e) => set("achievements", e.target.value)} rows={2} />
                    <Textarea placeholder="Controversies (one per line)" value={cand.controversies} onChange={(e) => set("controversies", e.target.value)} rows={2} />
                  </div>
                  <Textarea placeholder="Source URLs (one per line — for verification)" value={cand.source_urls} onChange={(e) => set("source_urls", e.target.value)} rows={2} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Photo URL" value={cand.photo_url} onChange={(e) => set("photo_url", e.target.value)} />
                    <Input type="number" min={0} max={100} placeholder="Data confidence %" value={cand.data_confidence} onChange={(e) => set("data_confidence", e.target.value)} />
                  </div>
                </div>
              </details>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" disabled={candMutation.isPending || !cand.name} onClick={() => candMutation.mutate(cand)}>
                  <Plus className="h-4 w-4 mr-1" /> {editingId ? "Update" : "Save"} Candidate
                </Button>
                {editingId && <Button size="sm" variant="outline" onClick={resetForm}>Cancel edit</Button>}
              </div>
            </CardContent>
          </Card>

          {/* Candidates list */}
          <Card className="border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-display">Candidates ({candidatesData.length})</CardTitle>
              {selectedForCompare.length >= 2 && (
                <Button size="sm" variant="default" disabled={aiMutation.isPending} onClick={() => aiMutation.mutate({ action: "compare", candidateIds: selectedForCompare })}>
                  <GitCompare className="h-3.5 w-3.5 mr-1" /> Compare {selectedForCompare.length}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {candidates.isLoading && <Skeleton className="h-16 w-full" />}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {candidatesData.map((c: any) => {
                  const gaps = missingCount(c);
                  const selected = selectedForCompare.includes(c.id);
                  return (
                    <div key={c.id} className={`rounded-md border p-2 text-xs transition ${selected ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center gap-2">
                        {c.photo_url && <img src={c.photo_url} alt={c.name} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />}
                        <span className="font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        <Badge variant="outline" className="text-[9px] capitalize">{c.office}</Badge>
                        {c.party_acronym && <Badge variant="outline" className="text-[9px]">{c.party_acronym}</Badge>}
                        <Badge variant="outline" className={`text-[9px] capitalize ${c.record_type === "incumbent" ? "text-emerald-500" : "text-blue-500"}`}>{c.record_type}</Badge>
                        {gaps > 0 && <Badge variant="outline" className="text-[9px] text-amber-500"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{gaps}</Badge>}
                      </div>
                      <p className="text-muted-foreground mt-1 truncate">{c.state || "—"}{c.lga ? ` · ${c.lga}` : ""}{c.election_year ? ` · ${c.election_year}` : ""}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => startEdit(c)}><Edit className="h-3 w-3 mr-0.5" />Edit</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-emerald-500" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate({ id: c.id, status: "verified", confidence: 100 })}><CheckCircle2 className="h-3 w-3 mr-0.5" />Verify</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" onClick={() => toggleCompare(c.id)}><GitCompare className="h-3 w-3 mr-0.5" />{selected ? "Selected" : "Compare"}</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5 text-red-500" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="h-3 w-3 mr-0.5" />Delete</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI Tools tab ── */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" disabled={aiMutation.isPending} onClick={() => aiMutation.mutate({ action: "gaps" })}>
              <AlertTriangle className="h-6 w-6 text-amber-500" /><span className="text-xs">Find Data Gaps</span><span className="text-[10px] text-muted-foreground">Across all candidates</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" disabled={aiMutation.isPending || !selectedForCompare[0]} onClick={() => aiMutation.mutate({ action: "summarize", candidateId: selectedForCompare[0] })}>
              <FileText className="h-6 w-6 text-blue-500" /><span className="text-xs">Summarize Manifesto</span><span className="text-[10px] text-muted-foreground">Select 1 candidate</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" disabled={aiMutation.isPending || selectedForCompare.length < 2} onClick={() => aiMutation.mutate({ action: "compare", candidateIds: selectedForCompare })}>
              <GitCompare className="h-6 w-6 text-violet-500" /><span className="text-xs">Compare Candidates</span><span className="text-[10px] text-muted-foreground">Select 2-6</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" disabled={aiMutation.isPending || !selectedForCompare[0]} onClick={() => aiMutation.mutate({ action: "risk", candidateIds: selectedForCompare })}>
              <ShieldAlert className="h-6 w-6 text-red-500" /><span className="text-xs">Risk Assessment</span><span className="text-[10px] text-muted-foreground">Integrity red flags</span>
            </Button>
          </div>
          <Card className="border-border bg-muted/30">
            <CardContent className="p-3 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 inline mr-1" /> AI tools use Deepseek (primary) + Kimi (fallback) and analyze <strong>only stored candidate data</strong> — never inventing facts. Select candidates above with the "Compare" button. Gaps scan works without AI configured.
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Parties tab ── */}
        <TabsContent value="parties" className="space-y-4 mt-4">
          <PartyForm />
        </TabsContent>

        {/* ── Events tab ── */}
        <TabsContent value="events" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Moderate Political Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {events.isLoading && <Skeleton className="h-20 w-full" />}
              {eventsData.length === 0 && !events.isLoading && <p className="text-xs text-muted-foreground">No political reports submitted yet.</p>}
              {eventsData.map((e: any) => (
                <div key={e.id} className="rounded-md border border-border p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] capitalize">{e.event_type?.replace(/_/g, " ")}</Badge>
                    {e.state && <span className="text-muted-foreground">{e.state}</span>}
                    <Badge variant="outline" className={`text-[9px] ${e.status === "approved" ? "text-green-500" : e.status === "flagged" ? "text-red-500" : e.status === "rejected" ? "text-muted-foreground" : "text-amber-500"}`}>{e.status}</Badge>
                    {e.ai_verdict && <Badge variant="outline" className="text-[9px]">AI: {e.ai_verdict} ({e.ai_confidence}%)</Badge>}
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-green-500" disabled={modMutation.isPending} onClick={() => modMutation.mutate({ id: e.id, status: "approved" })}><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-red-500" disabled={modMutation.isPending} onClick={() => modMutation.mutate({ id: e.id, status: "rejected" })}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
                    </div>
                  </div>
                  <p className="text-foreground">{e.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Trophy className="h-4 w-4" /> Candidate Scorecards</CardTitle></CardHeader>
            <CardContent className="space-y-2"><ScorecardForm candidates={candidatesData} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PartyForm() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [party, setParty] = useState({ acronym: "", name: "", color: "" });
  const partyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/parties", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/parties"] }); toast({ title: "Party saved" }); setParty({ acronym: "", name: "", color: "" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const parties = useQuery({ queryKey: ["/api/politics/parties"], queryFn: () => apiRequest("GET", "/api/politics/parties").then((r) => r.json()) });
  const partiesData = parties.data?.parties ?? [];
  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Vote className="h-4 w-4" /> Add / Update Party</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Acronym (APC)" value={party.acronym} onChange={(e) => setParty({ ...party, acronym: e.target.value.toUpperCase() })} />
          <Input className="col-span-2" placeholder="Full name" value={party.name} onChange={(e) => setParty({ ...party, name: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Color (#...)" value={party.color} onChange={(e) => setParty({ ...party, color: e.target.value })} />
          <Button size="sm" disabled={partyMutation.isPending || !party.acronym || !party.name} onClick={() => partyMutation.mutate(party)}><Plus className="h-4 w-4 mr-1" /> Save</Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {partiesData.slice(0, 24).map((p: any) => <Badge key={p.acronym} variant="outline" className="text-[9px]"><span className="h-2 w-2 rounded-full mr-1" style={{ background: p.color || "hsl(var(--primary))" }} />{p.acronym}</Badge>)}
        </div>
      </CardContent>
    </Card>
  );
}

function ScorecardForm({ candidates }: { candidates: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sc, setSc] = useState({ candidate_id: "", category: "Governance", metric: "", score: "80", notes: "" });
  const set = (k: string, v: string) => setSc((f) => ({ ...f, [k]: v }));
  const scorecards = useQuery({ queryKey: ["/api/politics/scorecards"], queryFn: () => apiRequest("GET", "/api/politics/scorecards").then((r) => r.json()) });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/scorecards", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/scorecards"] }); toast({ title: "Scorecard saved" }); setSc({ ...sc, metric: "" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const all = scorecards.data?.scorecards ?? [];
  return (
    <div className="space-y-2">
      {candidates.length === 0 && <p className="text-xs text-muted-foreground">Add a candidate first.</p>}
      {candidates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Select value={sc.candidate_id} onValueChange={(v) => set("candidate_id", v)}>
            <SelectTrigger><SelectValue placeholder="Candidate" /></SelectTrigger>
            <SelectContent className="max-h-60">{candidates.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sc.category} onValueChange={(v) => set("category", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Governance", "Transparency", "Performance", "Integrity", "Development"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Metric" value={sc.metric} onChange={(e) => set("metric", e.target.value)} />
          <Input type="number" min={0} max={100} placeholder="Score" value={sc.score} onChange={(e) => set("score", e.target.value)} />
          <Input placeholder="Notes" value={sc.notes} onChange={(e) => set("notes", e.target.value)} />
          <Button size="sm" disabled={mutation.isPending || !sc.candidate_id || !sc.metric} onClick={() => mutation.mutate({ candidate_id: Number(sc.candidate_id), category: sc.category, metric: sc.metric, score: Number(sc.score), notes: sc.notes || undefined })}><Plus className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      )}
      {all.length > 0 && (
        <ScrollArea className="h-32">
          <div className="space-y-1">
            {all.slice(0, 20).map((s: any) => (
              <div key={s.id} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{s.candidate_name || `#${s.candidate_id}`} · {s.category} · {s.metric}</span>
                <span className="font-mono">{s.score}/100</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Landmark, Users, Vote, ShieldCheck, AlertTriangle, CheckCircle2, Send, ExternalLink } from "lucide-react";

const EVENT_TYPES = [
  { value: "campaign_rally", label: "Campaign Rally" },
  { value: "candidate_visit", label: "Candidate Visit" },
  { value: "infrastructure_promise", label: "Infrastructure Promise" },
  { value: "vote_buying_report", label: "Vote Buying Report" },
  { value: "violence_report", label: "Violence Report" },
  { value: "result_anomaly", label: "Result Anomaly" },
  { value: "other", label: "Other" },
];

export default function PoliticsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [year, setYear] = useState("2023");
  const [selectedState, setSelectedState] = useState("");
  const [factClaim, setFactClaim] = useState("");

  const parties = useQuery({
    queryKey: ["/api/politics/parties"],
    queryFn: () => apiRequest("GET", "/api/politics/parties").then((r) => r.json()),
  });
  const states = useQuery({
    queryKey: ["/api/politics/nigeria2?resource=states"],
    queryFn: () => apiRequest("GET", "/api/politics/nigeria2?resource=states").then((r) => r.json()),
  });
  const results = useQuery({
    queryKey: ["/api/politics/nigeria2?resource=state-results", year, selectedState],
    queryFn: () => apiRequest("GET", `/api/politics/nigeria2?resource=state-results&year=${year}&geo_id=${encodeURIComponent(selectedState)}`).then((r) => r.json()),
    enabled: !!selectedState,
  });
  const events = useQuery({
    queryKey: ["/api/politics/events"],
    queryFn: () => apiRequest("GET", "/api/politics/events?limit=30").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/politics/events", data)).json(),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/politics/events"] });
      toast({ title: "Report submitted", description: "Your political report was submitted for review." });
    },
    onError: (err: any) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const factCheckMutation = useMutation({
    mutationFn: async (claim: string) => (await apiRequest("POST", "/api/politics/fact-check", { claim })).json(),
    onSuccess: (data: any) => {
      const r = data?.result;
      toast({
        title: `Verdict: ${r?.verdict ?? "unknown"} (${r?.confidence ?? 0}% confidence)`,
        description: r?.reasoning ?? "Analysis complete.",
      });
    },
    onError: (err: any) => toast({ title: "Fact-check failed", description: err.message, variant: "destructive" }),
  });

  const partiesData = parties.data?.parties ?? [];
  const statesData = states.data?.states ?? [];
  const eventsData = events.data?.events ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-display">Politics</h1>
        <Badge variant="outline" className="text-[10px]">Nigeria 2.0 Election Data</Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Track candidates, parties, and election integrity. Submit on-the-ground political reports — AI fact-checks every submission. Election figures are transcribed evidence, not official INEC counts.
      </p>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Parties & Candidates</TabsTrigger>
          <TabsTrigger value="election">Election Data</TabsTrigger>
          <TabsTrigger value="submit">Submit Report</TabsTrigger>
          <TabsTrigger value="factcheck">Fact-Check</TabsTrigger>
          <TabsTrigger value="feed">Reports</TabsTrigger>
        </TabsList>

        {/* Parties & Candidates */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Vote className="h-4 w-4" /> Political Parties</CardTitle></CardHeader>
            <CardContent>
              {parties.isLoading && <Skeleton className="h-16 w-full" />}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {partiesData.map((p: any) => (
                  <div key={p.acronym} className="rounded-md border border-border p-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color || "hsl(var(--primary))" }} />
                      <span className="text-xs font-bold">{p.acronym}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <CandidatesSection />
        </TabsContent>

        {/* Election Data (Nigeria2) */}
        <TabsContent value="election" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><ExternalLink className="h-4 w-4" /> Browse Election Results</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Year</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="2023">2023</SelectItem><SelectItem value="2019">2019</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">State</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {statesData.map((s: any) => (
                        <SelectItem key={s.geo_id} value={s.geo_id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {results.isLoading && <Skeleton className="h-40 w-full" />}
              {results.data && <ResultsDisplay data={results.data} />}
            </CardContent>
          </Card>
          <OutliersSection year={year} />
        </TabsContent>

        {/* Submit Report */}
        <TabsContent value="submit" className="space-y-4">
          <SubmitReportForm states={statesData} onSubmit={(data) => submitMutation.mutate(data)} loading={submitMutation.isPending} />
          {submitMutation.data && (
            <Card className="border-amber-500/30">
              <CardContent className="p-3 text-xs space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  AI Assessment: {submitMutation.data.aiVerdict} ({submitMutation.data.aiConfidence}% confidence)
                </div>
                <p className="text-muted-foreground">Status: {submitMutation.data.event?.status}. Your report is pending admin review.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Fact-Check */}
        <TabsContent value="factcheck" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-purple-500" /> AI Fake News Detection</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-xs">Paste a political claim, headline, or rumor to fact-check</Label>
              <Textarea value={factClaim} onChange={(e) => setFactClaim(e.target.value)} placeholder="e.g. 'INEC declared Candidate X winner of Lagos before votes were counted'" rows={4} />
              <Button disabled={factCheckMutation.isPending || factClaim.trim().length < 5} onClick={() => factCheckMutation.mutate(factClaim)}>
                <ShieldCheck className="h-4 w-4 mr-1" /> {factCheckMutation.isPending ? "Analyzing..." : "Fact-Check with AI"}
              </Button>
              <FactCheckResult data={factCheckMutation.data} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports feed */}
        <TabsContent value="feed" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Send className="h-4 w-4" /> Community Political Reports</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {events.isLoading && <Skeleton className="h-20 w-full" />}
              {eventsData.length === 0 && !events.isLoading && <p className="text-xs text-muted-foreground">No approved reports yet. Submit the first one.</p>}
              {eventsData.map((e: any) => (
                <div key={e.id} className="rounded-md border border-border p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] capitalize">{e.event_type.replace(/_/g, " ")}</Badge>
                    {e.candidate_name && <span className="text-muted-foreground">{e.candidate_name}</span>}
                    {e.party_acronym && <Badge variant="outline" className="text-[9px]">{e.party_acronym}</Badge>}
                    {e.state && <span className="text-muted-foreground">· {e.state}</span>}
                    {e.status === "approved" && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
                    {e.status === "flagged" && <AlertTriangle className="h-3 w-3 text-red-500 ml-auto" />}
                  </div>
                  <p className="text-foreground">{e.description}</p>
                  {e.evidence_url && <a href={e.evidence_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-[10px]">View evidence</a>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CandidatesSection() {
  const [filters, setFilters] = useState({ office: "", state: "", type: "", search: "" });
  const qs = new URLSearchParams();
  if (filters.office) qs.set("office", filters.office);
  if (filters.state) qs.set("state", filters.state);
  if (filters.type) qs.set("type", filters.type);
  if (filters.search) qs.set("search", filters.search);
  const { data, isLoading } = useQuery({
    queryKey: [`/api/politics/candidates?${qs.toString()}`],
    queryFn: () => apiRequest("GET", `/api/politics/candidates?${qs.toString()}`).then((r) => r.json()),
    refetchInterval: 45000,
  });
  const candidates = data?.candidates ?? [];
  const NIGERIA_STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT (Abuja)","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"];
  const OFFICES = [{ v: "", l: "All offices" }, { v: "presidential", l: "Presidential" }, { v: "governor", l: "Governor" }, { v: "senate", l: "Senate" }, { v: "house", l: "House of Reps" }, { v: "lga_chairman", l: "LGA Chairman" }, { v: "councillor", l: "Councillor" }];
  const TYPES = [{ v: "", l: "All" }, { v: "incumbent", l: "Incumbents" }, { v: "candidate", l: "Candidates" }, { v: "aspirant", l: "Aspirants" }, { v: "nominee", l: "Nominees" }];
  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Users className="h-4 w-4" /> Candidates & Officeholders</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input placeholder="Search name" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="text-xs" />
          <Select value={filters.office} onValueChange={(v) => setFilters({ ...filters, office: v })}><SelectTrigger className="text-xs"><SelectValue placeholder="Office" /></SelectTrigger><SelectContent>{OFFICES.map((o) => <SelectItem key={o.l} value={o.v}>{o.l}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.state} onValueChange={(v) => setFilters({ ...filters, state: v })}><SelectTrigger className="text-xs"><SelectValue placeholder="State" /></SelectTrigger><SelectContent className="max-h-60">{[{ v: "", l: "All states" }, ...NIGERIA_STATES.map((s) => ({ v: s, l: s }))].map((o) => <SelectItem key={o.l} value={o.v}>{o.l}</SelectItem>)}</SelectContent></Select>
          <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}><SelectTrigger className="text-xs"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{TYPES.map((o) => <SelectItem key={o.l} value={o.v}>{o.l}</SelectItem>)}</SelectContent></Select>
        </div>
        {isLoading && <Skeleton className="h-20 w-full" />}
        {candidates.length === 0 && !isLoading && <p className="text-xs text-muted-foreground">No candidates match. Super admins manage candidate metadata from the Politics admin tab.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {candidates.map((c: any) => <CandidateCard key={c.id} candidate={c} />)}
        </div>
        {candidates.length > 0 && <p className="text-[10px] text-muted-foreground">{candidates.length} result(s) · live data refreshed every 45s.</p>}
      </CardContent>
    </Card>
  );
}

function parseArr(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  try { const p = JSON.parse(v as string); return Array.isArray(p) ? p.map(String) : []; } catch { return v ? String(v).split("\n") : []; }
}

function CandidateCard({ candidate: c }: { candidate: any }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["/api/politics/scorecards", c.id],
    queryFn: () => apiRequest("GET", `/api/politics/scorecards?candidate_id=${c.id}`).then((r) => r.json()),
    enabled: open,
  });
  const scorecards = data?.scorecards ?? [];
  const avg = scorecards.length > 0 ? Math.round(scorecards.reduce((s: number, x: any) => s + (Number(x.score) || 0), 0) / scorecards.length) : null;
  const education = parseArr(c.education_background);
  const businesses = parseArr(c.businesses);
  const sources = parseArr(c.source_urls);
  const manifestoSummary = c.manifesto_summary || c.manifesto;
  return (
    <div className="rounded-md border border-border p-3 text-xs space-y-2 hover:border-primary/40 transition">
      <div className="flex items-start gap-2">
        {c.photo_url ? <img src={c.photo_url} alt={c.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" /> : <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">{c.name?.slice(0, 2).toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium truncate">{c.name}</span>
            {c.record_type && <Badge variant="outline" className={`text-[8px] capitalize ${c.record_type === "incumbent" ? "text-emerald-500" : "text-blue-500"}`}>{c.record_type}</Badge>}
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <Badge variant="outline" className="text-[8px] capitalize">{c.office?.replace("_", " ")}</Badge>
            {c.party_acronym && <Badge variant="outline" className="text-[8px]"><span className="h-1.5 w-1.5 rounded-full mr-0.5" style={{ background: c.party_color || "hsl(var(--primary))" }} />{c.party_acronym}</Badge>}
            {avg !== null && <Badge variant="outline" className="text-[8px] ml-auto">Score {avg}/100</Badge>}
          </div>
          <p className="text-muted-foreground text-[10px] mt-0.5 truncate">{c.state || "—"}{c.lga ? ` · ${c.lga}` : ""}{c.ward ? ` · ${c.ward}` : ""}{c.election_year ? ` · ${c.election_year}` : ""}</p>
        </div>
      </div>
      {c.autobiography || c.bio ? <p className="text-muted-foreground line-clamp-2">{c.autobiography || c.bio}</p> : null}
      {manifestoSummary && <p className="text-muted-foreground line-clamp-2 italic">“{manifestoSummary.slice(0, 160)}…”</p>}
      <button className="text-[10px] text-primary underline" onClick={() => setOpen((v) => !v)}>{open ? "Hide details" : "View profile & scorecard"}</button>
      {open && (
        <div className="space-y-2 border-t border-border pt-2">
          {c.political_background && <div><span className="font-medium">Political background:</span> <span className="text-muted-foreground">{c.political_background}</span></div>}
          {education.length > 0 && <div><span className="font-medium">Education:</span> <ul className="text-muted-foreground list-disc list-inside">{education.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {businesses.length > 0 && <div><span className="font-medium">Businesses:</span> <ul className="text-muted-foreground list-disc list-inside">{businesses.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {c.health_status && <div><span className="font-medium">Health:</span> <span className="text-muted-foreground">{c.health_status}</span></div>}
          {c.manifesto && <div><span className="font-medium">Manifesto:</span> <p className="text-muted-foreground line-clamp-4">{c.manifesto}</p></div>}
          {c.achievements && parseArr(c.achievements).length > 0 && <div><span className="font-medium">Achievements:</span> <ul className="text-muted-foreground list-disc list-inside">{parseArr(c.achievements).slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {sources.length > 0 && <div><span className="font-medium">Sources:</span> <ul className="text-muted-foreground list-disc list-inside break-all">{sources.slice(0, 4).map((e, i) => <li key={i}><a href={e} target="_blank" rel="noopener noreferrer" className="text-primary underline">{e.slice(0, 60)}</a></li>)}</ul></div>}
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> {c.verification_status || "unverified"}{c.data_confidence ? ` · ${c.data_confidence}% confidence` : ""}</div>
          {scorecards.length === 0 && <p className="text-[10px] text-muted-foreground">No scorecard metrics yet.</p>}
          {scorecards.map((s: any) => (<div key={s.id} className="flex justify-between text-[10px]"><span className="text-muted-foreground">{s.category} · {s.metric}</span><span className="font-mono">{s.score}/100</span></div>))}
        </div>
      )}
    </div>
  );
}

function ResultsDisplay({ data }: { data: any }) {
  // Nigeria2 state-results shape: { year, geo_id, state, presidential: {parties, winner, results}, governor: {...}, senate: {...}, evidence }
  const offices = ["presidential", "governor", "senate", "house"] as const;
  const partyResults = (office: string) => {
    const o = data?.[office];
    if (!o) return null;
    const parties = o.parties || o.results || [];
    if (Array.isArray(parties) && parties.length > 0) return parties;
    // Some shapes nest party vote counts as an object keyed by acronym.
    if (parties && typeof parties === "object") return Object.entries(parties).map(([k, v]) => ({ party: k, votes: v }));
    return null;
  };
  const hasAnyOffice = offices.some((o) => data?.[o]);
  return (
    <div className="space-y-3 text-xs">
      {!hasAnyOffice && (
        <div className="rounded-md bg-muted/30 p-2">
          <p className="text-muted-foreground">No detailed results available for this state/year. Try 2023.</p>
          <pre className="text-[10px] overflow-auto max-h-32 whitespace-pre-wrap mt-1">{JSON.stringify(data, null, 2).slice(0, 600)}</pre>
        </div>
      )}
      {offices.map((office) => {
        const parties = partyResults(office);
        if (!parties) return null;
        return (
          <div key={office} className="rounded-md border border-border p-2">
            <p className="font-medium mb-1 capitalize">{office} Results</p>
            <div className="space-y-0.5 max-h-48 overflow-auto">
              {parties.map((p: any, i: number) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="font-mono">{p.party || p.acronym || p.name || "—"}</span>
                  <span className="text-muted-foreground font-mono">{p.votes ?? p.votes_count ?? p.count ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground italic">Figures are transcribed evidence from INEC result sheets, not official counts. Source: api.nigeria2.com</p>
    </div>
  );
}

function OutliersSection({ year }: { year: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/politics/nigeria2?resource=outliers", year],
    queryFn: () => apiRequest("GET", `/api/politics/nigeria2?resource=outliers&year=${year}&limit=20`).then((r) => r.json()),
  });
  const outliers = data?.outliers ?? [];
  return (
    <Card className="border-amber-500/20">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Result Anomalies ({year})</CardTitle></CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-16 w-full" />}
        {outliers.length === 0 && !isLoading && <p className="text-xs text-muted-foreground">No anomalies detected for {year}.</p>}
        <div className="space-y-1 max-h-60 overflow-auto">
          {outliers.map((o: any, i: number) => (
            <div key={i} className="rounded-md border border-border p-1.5 text-[10px]">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] text-amber-500 capitalize">{o.rule || "anomaly"}</Badge>
                <span>{o.pu_code || o.state || "Unknown unit"}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitReportForm({ states, onSubmit, loading }: { states: any[]; onSubmit: (data: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    event_type: "candidate_visit",
    party_acronym: "",
    geo_id: "",
    state: "",
    lga: "",
    ward: "",
    description: "",
    evidence_url: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onStateChange = (geo_id: string) => {
    const s = states.find((x: any) => x.geo_id === geo_id);
    setForm((f) => ({ ...f, geo_id, state: s?.name ?? "" }));
  };
  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Send className="h-4 w-4" /> Submit a Political Micro-Truth</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Report on-the-ground political activity. AI reviews every submission for plausibility and disinformation patterns before admin review.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Event type</Label>
            <Select value={form.event_type} onValueChange={(v) => set("event_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Party (optional)</Label><Input value={form.party_acronym} onChange={(e) => set("party_acronym", e.target.value.toUpperCase())} placeholder="e.g. APC" /></div>
          <div><Label className="text-xs">State</Label>
            <Select value={form.geo_id} onValueChange={onStateChange}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {states.map((s: any) => <SelectItem key={s.geo_id} value={s.geo_id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">LGA (optional)</Label><Input value={form.lga} onChange={(e) => set("lga", e.target.value)} placeholder="e.g. Ikeja" /></div>
        </div>
        <div><Label className="text-xs">Ward (optional)</Label><Input value={form.ward} onChange={(e) => set("ward", e.target.value)} placeholder="e.g. 03-01-01" /></div>
        <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Candidate X held a rally at Ward Y, distributed items..." rows={3} /></div>
        <div><Label className="text-xs">Evidence URL (optional)</Label><Input value={form.evidence_url} onChange={(e) => set("evidence_url", e.target.value)} placeholder="https://..." /></div>
        <Button disabled={loading || form.description.trim().length < 5 || !form.state} onClick={() => onSubmit(form)}>
          <Send className="h-4 w-4 mr-1" /> {loading ? "Submitting..." : "Submit Report"}
        </Button>
      </CardContent>
    </Card>
  );
}

function FactCheckResult({ data }: { data: any }) {
  if (!data) return null;
  const r = data.result;
  if (!r) return null;
  const verdictColor: Record<string, string> = {
    true: "text-green-500", mostly_true: "text-green-500", mixed: "text-amber-500",
    mostly_false: "text-orange-500", false: "text-red-500", unverified: "text-muted-foreground",
  };
  return (
    <div className="rounded-md border border-border p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Verdict:</span>
        <Badge variant="outline" className={`capitalize ${verdictColor[r.verdict] || ""}`}>{r.verdict?.replace(/_/g, " ")}</Badge>
        <span className="text-muted-foreground">· {r.confidence}% confidence</span>
        {data.suspicious && <Badge variant="outline" className="text-red-500 text-[9px]">Flagged</Badge>}
      </div>
      <p>{r.reasoning}</p>
      {Array.isArray(r.evidence_points) && r.evidence_points.length > 0 && (
        <ul className="space-y-0.5 text-muted-foreground">
          {r.evidence_points.map((p: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-purple-500">•</span>{p}</li>)}
        </ul>
      )}
      {r.recommendation && <p className="text-muted-foreground italic">{r.recommendation}</p>}
      <p className="text-[9px] text-muted-foreground">AI assessment via Deepseek + Kimi ensemble. Not a substitute for professional verification.</p>
    </div>
  );
}

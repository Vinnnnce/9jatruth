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
  const [selectedState, setSelectedState] = useState("abia");
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
    queryFn: () => apiRequest("GET", `/api/politics/nigeria2?resource=state-results&year=${year}&state=${selectedState}`).then((r) => r.json()),
    enabled: !!selectedState,
  });
  const events = useQuery({
    queryKey: ["/api/politics/events"],
    queryFn: () => apiRequest("GET", "/api/politics/events?limit=30").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/events", data),
    onSuccess: (res: any) => {
      const r = res.json ? null : res;
      qc.invalidateQueries({ queryKey: ["/api/politics/events"] });
      toast({ title: "Report submitted", description: "Your political report was submitted for review." });
    },
    onError: (err: any) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  const factCheckMutation = useMutation({
    mutationFn: (claim: string) => apiRequest("POST", "/api/politics/fact-check", { claim }),
    onSuccess: async (res) => {
      const data = await res.json();
      const r = data.result;
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {statesData.map((s: any) => (
                        <SelectItem key={s.geo_id} value={s.name.toLowerCase().replace(/\s+/g, "-")}>{s.name}</SelectItem>
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
          <SubmitReportForm onSubmit={(data) => submitMutation.mutate(data)} loading={submitMutation.isPending} />
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
  const { data, isLoading } = useQuery({
    queryKey: ["/api/politics/candidates"],
    queryFn: () => apiRequest("GET", "/api/politics/candidates").then((r) => r.json()),
  });
  const candidates = data?.candidates ?? [];
  return (
    <Card className="border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Users className="h-4 w-4" /> Candidates</CardTitle></CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-20 w-full" />}
        {candidates.length === 0 && !isLoading && <p className="text-xs text-muted-foreground">No candidates added yet. Super admins can add candidates from the Politics admin tab.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {candidates.map((c: any) => (
            <div key={c.id} className="rounded-md border border-border p-2 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge variant="outline" className="text-[9px] capitalize">{c.office}</Badge>
                {c.party_acronym && <span className="h-2 w-2 rounded-full" style={{ background: c.party_color || "hsl(var(--primary))" }} title={c.party_name} />}
              </div>
              <p className="text-muted-foreground">{c.party_name || c.party_acronym} {c.state ? `· ${c.state}` : ""} {c.election_year ? `· ${c.election_year}` : ""}</p>
              {c.bio && <p className="text-muted-foreground line-clamp-2">{c.bio}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsDisplay({ data }: { data: any }) {
  // data is the Nigeria2 state-results payload (LGAs, senate/house, evidence).
  const lgas = data?.lgas || data?.results || [];
  const summary = data?.summary || data?.national_summary;
  return (
    <div className="space-y-3 text-xs">
      {summary && (
        <div className="rounded-md bg-muted/30 p-2">
          <p className="font-medium mb-1">Summary</p>
          <pre className="text-[10px] overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(summary, null, 2)}</pre>
        </div>
      )}
      {Array.isArray(lgas) && lgas.length > 0 && (
        <div className="rounded-md border border-border p-2">
          <p className="font-medium mb-1">LGA Results ({lgas.length})</p>
          <div className="space-y-1 max-h-60 overflow-auto">
            {lgas.slice(0, 20).map((lga: any, i: number) => (
              <div key={i} className="text-[10px] text-muted-foreground">{lga.name || lga.lga || lga.geo_id || `Row ${i + 1}`}</div>
            ))}
          </div>
        </div>
      )}
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

function SubmitReportForm({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    event_type: "candidate_visit",
    party_acronym: "",
    state: "",
    lga: "",
    ward: "",
    description: "",
    evidence_url: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
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
          <div><Label className="text-xs">State</Label><Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="e.g. Lagos" /></div>
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

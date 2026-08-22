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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Trash2, Plus, Users, Vote, ShieldAlert, Flag, Trophy } from "lucide-react";

export function AdminPolitics() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const parties = useQuery({ queryKey: ["/api/politics/parties"], queryFn: () => apiRequest("GET", "/api/politics/parties").then((r) => r.json()) });
  const candidates = useQuery({ queryKey: ["/api/politics/candidates"], queryFn: () => apiRequest("GET", "/api/politics/candidates").then((r) => r.json()) });
  const ngStates = useQuery({ queryKey: ["/api/politics/nigeria2?resource=states"], queryFn: () => apiRequest("GET", "/api/politics/nigeria2?resource=states").then((r) => r.json()) });
  const events = useQuery({ queryKey: ["/api/admin/politics/events"], queryFn: () => apiRequest("GET", "/api/admin/politics/events?status=all").then((r) => r.json()) });

  const modMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/admin/politics/events/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/politics/events"] });
      qc.invalidateQueries({ queryKey: ["/api/politics/events?status=all"] });
      toast({ title: "Event updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [cand, setCand] = useState({ name: "", party_acronym: "", office: "governor", geo_id: "", state: "", election_year: "", bio: "" });
  const candMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/candidates", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] }); toast({ title: "Candidate added" }); setCand({ name: "", party_acronym: "", office: "governor", geo_id: "", state: "", election_year: "", bio: "" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [party, setParty] = useState({ acronym: "", name: "", color: "" });
  const partyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/parties", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/parties"] }); toast({ title: "Party saved" }); setParty({ acronym: "", name: "", color: "" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const partiesData = parties.data?.parties ?? [];
  const candidatesData = candidates.data?.candidates ?? [];
  const eventsData = events.data?.events ?? [];
  const pendingCount = eventsData.filter((e: any) => e.status === "pending" || e.status === "flagged").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Parties</div><div className="text-2xl font-bold font-mono">{partiesData.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Candidates</div><div className="text-2xl font-bold font-mono">{candidatesData.length}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending events</div><div className="text-2xl font-bold font-mono text-amber-500">{pendingCount}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total events</div><div className="text-2xl font-bold font-mono">{eventsData.length}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Add party */}
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
              {partiesData.slice(0, 12).map((p: any) => <Badge key={p.acronym} variant="outline" className="text-[9px]"><span className="h-2 w-2 rounded-full mr-1" style={{ background: p.color || "hsl(var(--primary))" }} />{p.acronym}</Badge>)}
            </div>
          </CardContent>
        </Card>

        {/* Add candidate */}
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Users className="h-4 w-4" /> Add Candidate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Full name" value={cand.name} onChange={(e) => setCand({ ...cand, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Party (APC)" value={cand.party_acronym} onChange={(e) => setCand({ ...cand, party_acronym: e.target.value.toUpperCase() })} />
              <Select value={cand.office} onValueChange={(v) => setCand({ ...cand, office: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="presidential">Presidential</SelectItem><SelectItem value="governor">Governor</SelectItem><SelectItem value="senate">Senate</SelectItem><SelectItem value="house">House</SelectItem></SelectContent>
              </Select>
              <Input placeholder="State" value={cand.state} onChange={(e) => setCand({ ...cand, state: e.target.value })} />
              <Select value={cand.geo_id} onValueChange={(v) => { const s = (ngStates.data?.states || []).find((x: any) => x.geo_id === v); setCand({ ...cand, geo_id: v, state: s?.name ?? cand.state }); }}>
                <SelectTrigger><SelectValue placeholder="Geo (Nigeria2)" /></SelectTrigger>
                <SelectContent className="max-h-60">{(ngStates.data?.states || []).map((s: any) => <SelectItem key={s.geo_id} value={s.geo_id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Election year (2023)" value={cand.election_year} onChange={(e) => setCand({ ...cand, election_year: e.target.value })} />
            <Textarea placeholder="Bio (optional)" value={cand.bio} onChange={(e) => setCand({ ...cand, bio: e.target.value })} rows={2} />
            <Button size="sm" disabled={candMutation.isPending || !cand.name} onClick={() => candMutation.mutate({ ...cand, election_year: cand.election_year ? Number(cand.election_year) : null })}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </CardContent>
        </Card>
      </div>

      {/* Candidates list */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Candidates ({candidatesData.length})</CardTitle></CardHeader>
        <CardContent>
          {candidates.isLoading && <Skeleton className="h-16 w-full" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {candidatesData.map((c: any) => (
              <div key={c.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span><Badge variant="outline" className="text-[9px] capitalize">{c.office}</Badge></div>
                <p className="text-muted-foreground">{c.party_acronym || "—"} {c.state ? `· ${c.state}` : ""} {c.election_year ? `· ${c.election_year}` : ""}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scorecards */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><Trophy className="h-4 w-4" /> Candidate Scorecards</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <ScorecardForm candidates={candidatesData} />
        </CardContent>
      </Card>

      {/* Event moderation */}
      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-display flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-500" /> Moderate Political Reports</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {events.isLoading && <Skeleton className="h-20 w-full" />}
          {eventsData.length === 0 && !events.isLoading && <p className="text-xs text-muted-foreground">No political reports submitted yet.</p>}
          {eventsData.map((e: any) => (
            <div key={e.id} className="rounded-md border border-border p-2 text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[9px] capitalize">{e.event_type.replace(/_/g, " ")}</Badge>
                {e.state && <span className="text-muted-foreground">{e.state}</span>}
                <Badge variant="outline" className={`text-[9px] ${e.status === "approved" ? "text-green-500" : e.status === "flagged" ? "text-red-500" : e.status === "rejected" ? "text-muted-foreground" : "text-amber-500"}`}>{e.status}</Badge>
                {e.ai_verdict && <Badge variant="outline" className="text-[9px]">AI: {e.ai_verdict} ({e.ai_confidence}%)</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-green-500" disabled={modMutation.isPending} onClick={() => modMutation.mutate({ id: e.id, status: "approved" })}><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-red-500" disabled={modMutation.isPending} onClick={() => modMutation.mutate({ id: e.id, status: "rejected" })}><XCircle className="h-3 w-3 mr-1" /> Reject</Button>
                </div>
              </div>
              <p className="text-foreground">{e.description}</p>
              {e.candidate_name && <p className="text-muted-foreground">Candidate: {e.candidate_name}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ScorecardForm({ candidates }: { candidates: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sc, setSc] = useState({ candidate_id: "", category: "Governance", metric: "", score: "80", notes: "" });
  const set = (k: string, v: string) => setSc((f) => ({ ...f, [k]: v }));
  const scorecards = useQuery({
    queryKey: ["/api/politics/scorecards"],
    queryFn: () => apiRequest("GET", "/api/politics/scorecards").then((r) => r.json()),
  });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/politics/scorecards", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/politics/scorecards"] }); qc.invalidateQueries({ queryKey: ["/api/politics/candidates"] }); toast({ title: "Scorecard saved" }); setSc({ ...sc, metric: "" }); },
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
          <Input placeholder="Metric (e.g. Project delivery)" value={sc.metric} onChange={(e) => set("metric", e.target.value)} />
          <Input type="number" min={0} max={100} placeholder="Score" value={sc.score} onChange={(e) => set("score", e.target.value)} />
          <Input className="col-span-2 sm:col-span-1" placeholder="Notes (optional)" value={sc.notes} onChange={(e) => set("notes", e.target.value)} />
          <Button size="sm" disabled={mutation.isPending || !sc.candidate_id || !sc.metric} onClick={() => mutation.mutate({ candidate_id: Number(sc.candidate_id), category: sc.category, metric: sc.metric, score: Number(sc.score), notes: sc.notes || undefined })}><Plus className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      )}
      {all.length > 0 && (
        <div className="space-y-1 mt-1">
          {all.slice(0, 12).map((s: any) => (
            <div key={s.id} className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{s.candidate_name || `#${s.candidate_id}`} · {s.category} · {s.metric}</span>
              <span className="font-mono">{s.score}/100</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

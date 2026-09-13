"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, FileBarChart, Users, CheckCircle2, XCircle, ExternalLink, AlertCircle } from "lucide-react";

interface Election {
  id: number;
  year: number;
  name: string;
  status: string;
}

interface Position {
  id: number;
  code: string;
  name: string;
}

interface Result {
  id: number;
  party_acronym: string;
  party_name: string;
  party_color: string;
  candidate_name: string;
  votes: number;
  geo_level: string;
  state_name: string | null;
  lga_name: string | null;
  ward_name: string | null;
  polling_unit_name: string | null;
  total_valid_votes: number | null;
  total_rejected_votes: number | null;
  total_votes_cast: number | null;
  total_accredited_voters: number | null;
  status: string;
  source_url: string | null;
}

interface Summary {
  total_valid_votes: number;
  total_rejected_votes: number;
  total_votes_cast: number;
  total_accredited_voters: number;
  total_registered_voters: number;
  parties: Array<{ acronym: string; name: string; votes: number; percentage: number }>;
}

const GEO_LEVELS = [
  { value: "national", label: "National" },
  { value: "state", label: "State" },
  { value: "lga", label: "LGA" },
  { value: "ward", label: "Ward" },
  { value: "polling_unit", label: "Polling Unit" },
];

export default function ResultsPortalPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [states, setStates] = useState<Array<{ id: number; name: string }>>([]);
  const [lgas, setLgas] = useState<Array<{ id: number; name: string }>>([]);
  const [wards, setWards] = useState<Array<{ id: number; name: string }>>([]);

  const [selectedElection, setSelectedElection] = useState<string>("");
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [geoLevel, setGeoLevel] = useState<string>("national");
  const [stateId, setStateId] = useState<string>("all");
  const [lgaId, setLgaId] = useState<string>("all");
  const [wardId, setWardId] = useState<string>("all");

  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/politics/elections").then((r) => r.json()),
      fetch("/api/geo/states").then((r) => r.json()),
    ]).then(([eData, sData]) => {
      setElections(eData.elections || []);
      setStates(sData.states || []);
      if (eData.elections?.length > 0) setSelectedElection(String(eData.elections[0].id));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Load positions for election
  useEffect(() => {
    if (selectedElection) {
      fetch("/api/politics/office-holders")
        .then((r) => r.json())
        .then(() => {
          // Positions are embedded in office holders response; use a static list for now
          setPositions([
            { id: 1, code: "president", name: "President" },
            { id: 2, code: "vice_president", name: "Vice President" },
            { id: 3, code: "senator", name: "Senator" },
            { id: 4, code: "house_of_rep", name: "House of Representatives" },
            { id: 5, code: "governor", name: "Governor" },
            { id: 6, code: "deputy_governor", name: "Deputy Governor" },
            { id: 7, code: "state_assembly", name: "State Assembly" },
            { id: 8, code: "lga_chairman", name: "LGA Chairman" },
            { id: 9, code: "councillor", name: "Councillor" },
          ]);
        });
    }
  }, [selectedElection]);

  // Cascading geo loaders
  useEffect(() => {
    if (stateId !== "all") {
      fetch(`/api/geo/states/${stateId}/lgas`).then((r) => r.json()).then((d) => setLgas(d.lgas || []));
      setLgaId("all"); setWards([]); setWardId("all");
    } else {
      setLgas([]); setWards([]); setLgaId("all"); setWardId("all");
    }
  }, [stateId]);

  useEffect(() => {
    if (lgaId !== "all") {
      fetch(`/api/geo/lgas/${lgaId}/wards`).then((r) => r.json()).then((d) => setWards(d.wards || []));
      setWardId("all");
    } else {
      setWards([]);
    }
  }, [lgaId]);

  // Load results
  const loadResults = useCallback(async () => {
    if (!selectedElection) return;
    setLoading(true);
    const params = new URLSearchParams({
      election_id: selectedElection,
      ...(selectedPosition !== "all" && { office_id: selectedPosition }),
      ...(stateId !== "all" && { state_id: stateId }),
      ...(lgaId !== "all" && { lga_id: lgaId }),
      ...(wardId !== "all" && { ward_id: wardId }),
      ...(geoLevel !== "national" && { geo_level: geoLevel }),
    });
    try {
      const res = await fetch(`/api/politics/results?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch {
      setResults([]); setSummary(null);
    }
    setLoading(false);
  }, [selectedElection, selectedPosition, stateId, lgaId, wardId, geoLevel]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const formatNumber = (n: number) => n?.toLocaleString("en-NG") ?? "0";

  if (loading && !selectedElection) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-3/4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Election Results Portal</h1>
        <p className="text-muted-foreground mt-1">
          Official election results as declared by INEC. Results are presented factually without projections or predictions.
        </p>
      </div>

      {/* Neutrality Banner */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Results displayed here are officially declared by INEC. This portal makes no predictions, projections, or endorsements.</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Election</label>
              <Select value={selectedElection} onValueChange={setSelectedElection}>
                <SelectTrigger><SelectValue placeholder="Select election" /></SelectTrigger>
                <SelectContent>
                  {elections.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Office</label>
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger><SelectValue placeholder="All offices" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Offices</SelectItem>
                  {positions.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Geo Level</label>
              <Select value={geoLevel} onValueChange={setGeoLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GEO_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {geoLevel !== "national" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">State</label>
                <Select value={stateId} onValueChange={setStateId}>
                  <SelectTrigger><SelectValue placeholder="All states" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {stateId !== "all" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">LGA</label>
                  <Select value={lgaId} onValueChange={setLgaId}>
                    <SelectTrigger><SelectValue placeholder="All LGAs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All LGAs</SelectItem>
                      {lgas.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {lgaId !== "all" && geoLevel === "ward" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Ward</label>
                  <Select value={wardId} onValueChange={setWardId}>
                    <SelectTrigger><SelectValue placeholder="All wards" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wards</SelectItem>
                      {wards.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><CheckCircle2 className="h-4 w-4" /><span className="text-xs">Valid Votes</span></div>
              <p className="text-xl font-bold">{formatNumber(summary.total_valid_votes)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><XCircle className="h-4 w-4" /><span className="text-xs">Rejected Votes</span></div>
              <p className="text-xl font-bold">{formatNumber(summary.total_rejected_votes)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileBarChart className="h-4 w-4" /><span className="text-xs">Votes Cast</span></div>
              <p className="text-xl font-bold">{formatNumber(summary.total_votes_cast)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="h-4 w-4" /><span className="text-xs">Accredited</span></div>
              <p className="text-xl font-bold">{formatNumber(summary.total_accredited_voters)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Party Results Table */}
      {summary?.parties && summary.parties.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Party Results</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Votes</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="hidden md:table-cell">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.parties.map((p) => (
                  <TableRow key={p.acronym}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: "#888" }} />
                        <span className="font-medium">{p.acronym}</span>
                        <span className="text-muted-foreground text-sm hidden md:inline">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(p.votes)}</TableCell>
                    <TableCell className="text-right">{p.percentage.toFixed(2)}%</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${p.percentage}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results Table */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Detailed Results</CardTitle></CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileBarChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No results have been declared for this selection yet.</p>
              <p className="text-sm mt-1">Results will appear here once officially published by INEC.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-right">Votes</TableHead>
                  <TableHead>Geo Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: r.party_color || "#888" }} />
                        <span className="font-medium">{r.party_acronym || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{r.candidate_name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(r.votes)}</TableCell>
                    <TableCell className="text-sm">
                      {r.state_name || r.lga_name || r.ward_name || r.polling_unit_name || r.geo_level}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.source_url && (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Source: INEC iREV Portal — Results are displayed as officially declared.
      </p>
    </div>
  );
}

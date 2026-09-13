"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Database, Vote, FileBarChart, Landmark, RefreshCw, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * AdminPoliticsModules — Extended admin modules for the Politics feature.
 * Renders as sub-tabs: Geo Data, Parties, Elections, Results.
 */
export function AdminPoliticsModules() {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Vote className="h-4 w-4" /> Politics Feature Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geo">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="geo">Geo Data</TabsTrigger>
            <TabsTrigger value="parties">Parties</TabsTrigger>
            <TabsTrigger value="elections">Elections & Timetable</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          <TabsContent value="geo" className="mt-4"><GeoDataModule /></TabsContent>
          <TabsContent value="parties" className="mt-4"><PartiesModule /></TabsContent>
          <TabsContent value="elections" className="mt-4"><ElectionsModule /></TabsContent>
          <TabsContent value="results" className="mt-4"><ResultsModule /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function GeoDataModule() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/politics/geo-stats"],
    queryFn: () => apiRequest("GET", "/api/admin/politics/geo-stats").then((r) => r.json()),
  });

  const geo = data?.geo;
  const expected = geo?.expected;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="States" value={geo?.states} expected={expected?.states} />
        <StatCard label="LGAs" value={geo?.lgas} expected={expected?.lgas} />
        <StatCard label="Wards" value={geo?.wards} expected={expected?.wards} />
        <StatCard label="Polling Units" value={geo?.polling_units} expected={expected?.polling_units} />
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">INEC Geo Data Source</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sourced from nigeria-inec-geo (GitHub). Last sync: {geo?.last_pu_sync || geo?.last_geo_sync || "N/A"}
              </p>
              <a href="https://github.com/saidiadegoke/nigeria-inec-geo" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                <ExternalLink className="h-3 w-3" /> View Source Repository
              </a>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Polling Units Import</p>
              <Button size="sm" variant="outline" className="mt-1" disabled>
                <RefreshCw className="h-3 w-3 mr-1" /> Run via script
              </Button>
              <p className="text-xs text-muted-foreground mt-1">Use: node scripts/import-polling-units.mjs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, expected }: { label: string; value?: number; expected?: number }) {
  const complete = expected && value && value >= expected;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Database className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-xl font-bold">{value?.toLocaleString("en-NG") ?? "—"}</p>
        {expected && (
          <p className={`text-xs ${complete ? "text-green-600" : "text-amber-600"}`}>
            {complete ? "Complete" : `Expected: ${expected.toLocaleString("en-NG")}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PartiesModule() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/politics/parties"],
    queryFn: () => apiRequest("GET", "/api/politics/parties").then((r) => r.json()),
  });

  const parties = data?.parties || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{parties.length} registered parties</p>
        <Button size="sm" variant="outline">
          <Landmark className="h-4 w-4 mr-1" /> Add Party
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acronym</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.slice(0, 50).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.acronym}</TableCell>
                <TableCell className="text-sm">{p.name}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "active" ? "default" : "secondary"}>
                    {p.status || "active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{p.date_registered || "—"}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ElectionsModule() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/politics/elections"],
    queryFn: () => apiRequest("GET", "/api/admin/politics/elections").then((r) => r.json()),
  });

  const elections = data?.elections || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{elections.length} election cycles</p>
        <Button size="sm" variant="outline">
          <Vote className="h-4 w-4 mr-1" /> Add Election
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timetable</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Results</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elections.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.year}</TableCell>
                <TableCell className="text-sm">{e.name}</TableCell>
                <TableCell className="text-sm">{e.election_date || "TBD"}</TableCell>
                <TableCell><Badge>{e.status}</Badge></TableCell>
                <TableCell>
                  {e.has_timetable ? <Badge variant="default">Published</Badge> : <Badge variant="secondary">None</Badge>}
                </TableCell>
                <TableCell className="text-sm">{e.event_count ?? 0}</TableCell>
                <TableCell className="text-sm">{e.result_count ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p>Timetable Editor: Create and manage election phases (voter registration, primaries, campaign, election day, collation, result announcement).</p>
          <p className="mt-1">Use the admin API at <code>/api/admin/politics/events</code> to manage events.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsModule() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/politics/results"],
    queryFn: () => apiRequest("GET", "/api/admin/politics/results?limit=50").then((r) => r.json()),
  });

  const results = data?.results || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{results.length} results (latest 50)</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <FileBarChart className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button size="sm" variant="outline">Add Result</Button>
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileBarChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No results have been imported yet.</p>
            <p className="text-sm mt-1">Results can be imported from INEC iREV CSV exports.</p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead className="text-right">Votes</TableHead>
              <TableHead>Geo Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.party_acronym || "—"}</TableCell>
                <TableCell className="text-sm">{r.candidate_name || "—"}</TableCell>
                <TableCell className="text-right font-mono">{r.votes?.toLocaleString("en-NG") || "0"}</TableCell>
                <TableCell className="text-sm capitalize">{r.geo_level}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "published" ? "default" : "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">Verify</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

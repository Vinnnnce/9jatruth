"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Users, Vote } from "lucide-react";

export interface Party {
  acronym: string;
  name?: string | null;
  color?: string | null;
  logo_url?: string | null;
}

/**
 * Party → Candidates detail view.
 *
 * Lists ALL registered + aspiring candidates for a single political party,
 * filtered server-side by party acronym via the existing candidates API.
 * Reuses the same Card/Badge/Button primitives and apiRequest helper as the
 * rest of the Politics dashboard.
 */
export function PartyCandidatesView({ party, onBack }: { party: Party; onBack: () => void }) {
  const qs = new URLSearchParams({ party: party.acronym });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [`/api/politics/candidates?${qs.toString()}`],
    queryFn: () => apiRequest("GET", `/api/politics/candidates?${qs.toString()}`).then((r) => r.json()),
    refetchInterval: 45000,
  });

  const candidates = data?.candidates ?? [];
  const total = data?.total ?? candidates.length;
  const partyColor = party.color || "hsl(var(--primary))";

  // Breakdown by record_type for a quick summary badge row.
  const counts = (candidates as any[]).reduce<Record<string, number>>((acc, c) => {
    const t = (c.record_type as string) || "candidate";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card className="border-border">
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="h-7 text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to parties
          </Button>
        </div>
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Vote className="h-4 w-4 text-primary" />
          {party.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={party.logo_url} alt={party.acronym} className="h-5 w-5 rounded-sm object-contain" />
          ) : (
            <span className="h-3 w-3 rounded-full" style={{ background: partyColor }} />
          )}
          <span className="font-bold">{party.acronym}</span>
          <span className="text-muted-foreground font-normal truncate">— {party.name || "Political Party"}</span>
          <Badge variant="outline" className="text-[9px] ml-auto">
            {total} {total === 1 ? "candidate" : "candidates"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quick breakdown by type */}
        {candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Breakdown:</span>
            {Object.entries(counts).map(([type, n]) => (
              <Badge key={type} variant="outline" className="text-[9px] capitalize">
                {type} · {n}
              </Badge>
            ))}
          </div>
        )}

        {isLoading && <Skeleton className="h-24 w-full" />}

        {isError && (
          <p className="text-xs text-destructive">
            Could not load candidates for {party.acronym}. {(error as Error)?.message}
          </p>
        )}

        {!isLoading && !isError && candidates.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-6 text-center space-y-1">
            <Users className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-xs font-medium">No candidates yet for {party.acronym}</p>
            <p className="text-[10px] text-muted-foreground">
              There are no registered or aspiring candidates linked to this party. Super admins can add candidate
              metadata from the Politics admin tab.
            </p>
          </div>
        )}

        {!isLoading && !isError && candidates.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {candidates.map((c: any) => (
              <PartyCandidateCard key={c.id} candidate={c} partyColor={partyColor} />
            ))}
          </div>
        )}

        {candidates.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {candidates.length} of {total} result(s) shown · live data refreshed every 45s.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PartyCandidateCard({ candidate: c, partyColor }: { candidate: any; partyColor: string }) {
  const manifesto = c.manifesto_summary || c.manifesto;
  const bio = c.autobiography || c.bio;
  return (
    <div className="rounded-md border border-border p-3 text-xs space-y-2 hover:border-primary/40 transition">
      <div className="flex items-start gap-2">
        {c.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo_url} alt={c.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
            {c.name?.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium truncate">{c.name}</span>
            {c.record_type && (
              <Badge
                variant="outline"
                className={`text-[8px] capitalize ${
                  c.record_type === "incumbent" ? "text-emerald-500" : "text-blue-500"
                }`}
              >
                {c.record_type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            <Badge variant="outline" className="text-[8px] capitalize">
              {(c.office || "—")?.replace(/_/g, " ")}
            </Badge>
            {c.party_acronym && (
              <Badge variant="outline" className="text-[8px]">
                <span className="h-1.5 w-1.5 rounded-full mr-0.5" style={{ background: partyColor }} />
                {c.party_acronym}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-[10px] mt-0.5 truncate">
            {c.state || "—"}
            {c.lga ? ` · ${c.lga}` : ""}
            {c.ward ? ` · ${c.ward}` : ""}
            {c.election_year ? ` · ${c.election_year}` : ""}
          </p>
        </div>
      </div>
      {bio && <p className="text-muted-foreground line-clamp-2">{bio}</p>}
      {manifesto && <p className="text-muted-foreground line-clamp-2 italic">“{String(manifesto).slice(0, 160)}…”</p>}
    </div>
  );
}

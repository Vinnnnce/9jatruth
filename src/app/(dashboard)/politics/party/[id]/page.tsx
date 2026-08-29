"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { Landmark, Users, Search, MapPin, ArrowLeft, Briefcase } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PartyDetailPage() {
  const params = useParams();
  const partyId = params.id as string;
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/politics/party", partyId, "members"],
    queryFn: () => apiRequest("GET", `/api/politics/party/${partyId}/members`).then((r) => r.json()),
    enabled: !!partyId,
  });

  const party = data?.party;
  const members = data?.members || [];
  const byOffice = data?.byOffice || {};

  const filteredMembers = search
    ? members.filter((m: any) =>
        (m.fullName || m.full_name || "").toLowerCase().includes(search.toLowerCase())
      )
    : members;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/politics">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Politics
        </Link>
      </Button>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : party ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {party.logo_url && (
                <img src={party.logo_url} alt={party.name} className="h-16 w-16 rounded-lg object-contain" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark className="h-5 w-5 text-primary" />
                  <h1 className="text-2xl font-bold">{party.name}</h1>
                  {party.acronym && (
                    <Badge variant="secondary">{party.acronym}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {members.length} Members
                  </span>
                  {party.color && (
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: party.color }} />
                      {party.color}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Party not found.
          </CardContent>
        </Card>
      )}

      {/* Search Members */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search party members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Members grouped by office */}
      {Object.keys(byOffice).length > 0 ? (
        Object.entries(byOffice).map(([office, officeMembers]: [string, any[]]) => (
          <div key={office}>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {office.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              <Badge variant="outline">{officeMembers.length}</Badge>
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(search ? officeMembers.filter((m: any) =>
                (m.fullName || m.full_name || "").toLowerCase().includes(search.toLowerCase())
              ) : officeMembers).map((member: any) => (
                <MemberCard key={member.id || member.personId} member={member} />
              ))}
            </div>
          </div>
        ))
      ) : filteredMembers.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">All Members</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member: any) => (
              <MemberCard key={member.id || member.personId} member={member} />
            ))}
          </div>
        </div>
      ) : (
        !isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No members found for this party.
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  const name = member.fullName || member.full_name || "Unknown";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const photo = member.photoUrl || member.photo_url;
  const position = member.position || member.office || member.positionName;
  const state = member.stateName || member.state_name || member.state;
  const lga = member.lgaName || member.lga_name || member.lga;
  const ward = member.wardName || member.ward_name || member.ward;
  const slug = member.slug;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            {photo ? <AvatarImage src={photo} alt={name} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {slug ? (
              <Link href={`/politics/politician/${slug}`} className="font-semibold hover:text-primary truncate block">
                {name}
              </Link>
            ) : (
              <p className="font-semibold truncate">{name}</p>
            )}
            {position && (
              <p className="text-sm text-muted-foreground truncate">{position}</p>
            )}
            {(state || lga || ward) && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[state, lga, ward].filter(Boolean).join(", ")}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

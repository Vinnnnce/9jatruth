"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, Briefcase, Landmark, GraduationCap, DollarSign, Heart, Mail, Globe,
  Facebook, Twitter, Instagram, Linkedin, ExternalLink, ArrowLeft, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PoliticianProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/politicians", slug],
    queryFn: () => apiRequest("GET", `/api/politicians/${encodeURIComponent(slug)}`).then((r) => r.json()),
    enabled: !!slug,
  });

  const politician = data?.politician;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!politician) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <p className="text-muted-foreground">Politician not found.</p>
        <Button asChild className="mt-4">
          <Link href="/politics">Back to Politics</Link>
        </Button>
      </div>
    );
  }

  const name = politician.fullName || politician.full_name || "Unknown";
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const photo = politician.photoUrl || politician.photo_url;
  const party = politician.partyAcronym || politician.party_acronym || politician.party;
  const position = politician.position || politician.office || politician.positionName;
  const state = politician.stateName || politician.state_name || politician.stateOfOrigin || politician.state_of_origin;
  const lga = politician.lgaName || politician.lga_name || politician.localGovtOfOrigin || politician.local_govt_of_origin;
  const ward = politician.wardName || politician.ward_name || politician.ward;

  const socials = [
    { icon: Facebook, url: politician.facebook, label: "Facebook" },
    { icon: Twitter, url: politician.twitter, label: "Twitter" },
    { icon: Instagram, url: politician.instagram, label: "Instagram" },
    { icon: Linkedin, url: politician.linkedin, label: "LinkedIn" },
  ].filter((s) => s.url);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/politics">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Politics
        </Link>
      </Button>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <Avatar className="h-32 w-32 rounded-lg">
              {photo ? <AvatarImage src={photo} alt={name} /> : null}
              <AvatarFallback className="text-2xl rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold">{name}</h1>
                {position && (
                  <p className="text-lg text-muted-foreground">{position}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {party && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Landmark className="h-3 w-3" />
                    {party}
                  </Badge>
                )}
                {(state || lga || ward) && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {[state, lga, ward].filter(Boolean).join(", ")}
                  </Badge>
                )}
                {politician.verificationStatus && politician.verificationStatus !== "unverified" && (
                  <Badge className="flex items-center gap-1 bg-green-600">
                    <ShieldCheck className="h-3 w-3" />
                    {politician.verificationStatus}
                  </Badge>
                )}
              </div>
              {socials.length > 0 && (
                <div className="flex gap-2">
                  {socials.map((s) => (
                    <Button key={s.label} size="icon" variant="outline" asChild>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        <s.icon className="h-4 w-4" />
                      </a>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {politician.dateOfBirth && (
          <DetailCard icon={Heart} title="Date of Birth" value={politician.dateOfBirth} />
        )}
        {politician.placeOfBirth && (
          <DetailCard icon={MapPin} title="Place of Birth" value={politician.placeOfBirth} />
        )}
        {politician.hometown && (
          <DetailCard icon={MapPin} title="Hometown" value={politician.hometown} />
        )}
        {politician.stateOfOrigin && (
          <DetailCard icon={MapPin} title="State of Origin" value={politician.stateOfOrigin} />
        )}
        {politician.localGovtOfOrigin && (
          <DetailCard icon={MapPin} title="LGA of Origin" value={politician.localGovtOfOrigin} />
        )}
        {politician.nationality && (
          <DetailCard icon={Globe} title="Nationality" value={politician.nationality} />
        )}
      </div>

      {/* Biography */}
      {politician.autobiography && (
        <Card>
          <CardHeader>
            <CardTitle>Biography</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.autobiography}</p>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {politician.educationBackground && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Education
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.educationBackground}</p>
          </CardContent>
        </Card>
      )}

      {/* Political Background */}
      {politician.politicalBackground && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Political Background
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.politicalBackground}</p>
          </CardContent>
        </Card>
      )}

      {/* Previous Political Positions */}
      {politician.previousPoliticalPositions && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Political Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.previousPoliticalPositions}</p>
          </CardContent>
        </Card>
      )}

      {/* Business Interests */}
      {(politician.businesses || politician.businessInterests) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Business Interests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.businesses || politician.businessInterests}</p>
          </CardContent>
        </Card>
      )}

      {/* Net Worth */}
      {politician.netWorth && (
        <Card>
          <CardHeader>
            <CardTitle>Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{politician.netWorth}</p>
          </CardContent>
        </Card>
      )}

      {/* Assets Declared */}
      {politician.assetsDeclared && (
        <Card>
          <CardHeader>
            <CardTitle>Assets Declared</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{politician.assetsDeclared}</p>
          </CardContent>
        </Card>
      )}

      {/* Contact */}
      {(politician.email || politician.phone || politician.website) && (
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {politician.email && (
              <a href={`mailto:${politician.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="h-4 w-4" />
                {politician.email}
              </a>
            )}
            {politician.phone && (
              <p className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4" />
                {politician.phone}
              </p>
            )}
            {politician.website && (
              <a href={politician.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
                <Globe className="h-4 w-4" />
                {politician.website}
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetailCard({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">{title}</span>
        </div>
        <p className="text-sm font-medium">{value}</p>
      </CardContent>
    </Card>
  );
}

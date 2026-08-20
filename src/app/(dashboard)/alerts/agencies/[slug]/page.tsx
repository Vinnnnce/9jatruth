import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Globe, ShieldCheck, CheckCircle2, Building2, Users, AlertTriangle } from "lucide-react";
import { AgencyLogo } from "@/components/agency-logo";
import { EMERGENCY_AGENCIES, NIGERIAN_STATES, getAgencyBySlug } from "@/lib/emergency-agencies";
import { ensureDbInitialized, getDb } from "@/lib/db";
import { AgencyAIBriefing } from "./agency-ai-briefing";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Contact = {
  id: number; state: string | null; lga: string | null; community: string | null;
  phonePrimary: string | null; phoneSecondary: string | null; email: string | null; address: string | null;
  verified: boolean;
};

async function getContacts(agencyType: string): Promise<Contact[]> {
  try {
    await ensureDbInitialized();
    const sql = getDb();
    const rows = (await sql`
      SELECT id, state, lga, community, phone_primary, phone_secondary, email, address, verified
      FROM emergency_contacts
      WHERE agency_type = ${agencyType}
      ORDER BY CASE WHEN state IS NULL THEN 0 ELSE 1 END, state, lga NULLS LAST
    `) as unknown as Contact[];
    return rows ?? [];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  return EMERGENCY_AGENCIES.map((a) => ({ slug: a.slug }));
}

export default async function AgencyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agency = getAgencyBySlug(slug);
  if (!agency) notFound();

  const contacts = await getContacts(agency.type);
  const national = contacts.filter((c) => !c.state);
  const stateContacts = contacts.filter((c) => !!c.state);
  const statesCovered = [...new Set(stateContacts.map((c) => c.state))].sort() as string[];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/alerts/agencies" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All agencies
      </Link>

      {/* Hero */}
      <div className="flex items-start gap-4">
        <AgencyLogo agency={agency} size={72} className="shrink-0" />
        <div className="flex-1">
          <Badge variant="secondary" className="mb-2 text-[9px] h-4">{agency.category}</Badge>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{agency.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">{agency.shortName} · {agency.jurisdiction}</p>
        </div>
      </div>

      {/* Primary contact — always visible */}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Emergency line</div>
          <a href={`tel:${agency.phonePrimary}`} className="text-2xl font-bold tracking-tight text-emerald-600 hover:underline">
            {agency.phonePrimary}
          </a>
          <p className="text-xs text-muted-foreground mt-0.5">Tap to call · 112 routes to the nearest response centre</p>
        </div>
        {agency.phoneSecondary && (
          <div className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Office line</div>
            <a href={`tel:${agency.phoneSecondary}`} className="hover:underline">{agency.phoneSecondary}</a>
          </div>
        )}
      </div>

      {/* Quick facts grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FactRow icon={Building2} label="National HQ">{agency.address}</FactRow>
        <FactRow icon={Mail} label="Email">{agency.email ?? "Not published"}</FactRow>
        <FactRow icon={Globe} label="Website">
          {agency.website ? <a href={agency.website} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{agency.website.replace(/^https?:\/\//, "")}</a> : "Not published"}
        </FactRow>
        <FactRow icon={Users} label="Coverage">{agency.jurisdiction}</FactRow>
      </div>

      {/* Description + services */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{agency.description}</p>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Core services</h2>
          <div className="flex flex-wrap gap-2">
            {agency.services.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" /> {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* AI-powered safety briefing */}
      <AgencyAIBriefing agency={agency} />

      {/* State / LGA contacts table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold">State &amp; Local Contacts</h2>
        </div>

        {statesCovered.length > 0 && (
          <p className="text-xs text-muted-foreground">
            State-specific contacts available for: {statesCovered.join(", ")}.
            Select your state to see the nearest office.
          </p>
        )}

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">State</th>
                <th className="text-left font-medium px-3 py-2">LGA / Community</th>
                <th className="text-left font-medium px-3 py-2">Phone</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {c.state ?? "National"}
                      {c.verified && <ShieldCheck className="h-3 w-3 text-emerald-500" />}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.lga ?? c.community ?? "—"}</td>
                  <td className="px-3 py-2">
                    {c.phonePrimary && <a href={`tel:${c.phonePrimary}`} className="text-emerald-600 hover:underline font-medium">{c.phonePrimary}</a>}
                    {c.phoneSecondary && <div className="text-[10px] text-muted-foreground">{c.phoneSecondary}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{c.address ?? "—"}</td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No contacts loaded yet. Use the national emergency line above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {contacts.length > 0 && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Contact details are community-sourced. Always verify locally before relying on them in an emergency.
          </p>
        )}
      </div>

      {/* Full state list (SEO + navigation) */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h2 className="text-xs font-semibold mb-2">Find this agency across Nigeria</h2>
        <div className="flex flex-wrap gap-1.5">
          {NIGERIAN_STATES.map((s) => (
            <Badge key={s} variant="secondary" className="text-[9px] cursor-default">{s}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function FactRow({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-0.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-xs text-foreground break-words">{children}</div>
    </div>
  );
}

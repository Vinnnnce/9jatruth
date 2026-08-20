import { notFound } from "next/navigation";
import Link from "next/link";
import { Building2, MapPin, Mail, Phone, Globe, ShieldCheck, Users, Briefcase, BadgeCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { ensureDbInitialized, getDb } from "@/lib/db";
import { getOrganization, getOrganizationPublicStats } from "@/lib/neon-storage";
import { OrgInsights } from "./org-insights";

export const dynamic = "force-dynamic";

const TYPE_ACCENTS: Record<string, string> = {
  government: "#1d4ed8",
  utility: "#b45309",
  media: "#7c3aed",
  ngo: "#15803d",
  community: "#c2410c",
  corporate: "#0e7490",
};

const TYPE_LABELS: Record<string, string> = {
  government: "Government", utility: "Utility Company", media: "Media",
  ngo: "NGO", community: "Community Group", corporate: "Corporate",
};

type Member = { display_name: string; role: string; joined_at: string | null };
type Vacancy = { id: number; title: string; description: string; location: string | null; employment_type: string | null; salary_range: string | null; application_deadline: string | null };

async function getMembers(orgId: number): Promise<Member[]> {
  try {
    const sql = getDb();
    const rows = (await sql`SELECT display_name, role, joined_at FROM org_members
      WHERE organization_id = ${orgId} AND active = 1 ORDER BY
        CASE role WHEN 'admin' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, joined_at ASC NULLS LAST`) as unknown as Member[];
    return rows ?? [];
  } catch { return []; }
}

async function getVacancies(orgId: number): Promise<Vacancy[]> {
  try {
    const sql = getDb();
    const rows = (await sql`SELECT id, title, description, location, employment_type, salary_range, application_deadline
      FROM vacancies WHERE organization_id = ${orgId} AND status = 'open'
      ORDER BY created_at DESC`) as unknown as Vacancy[];
    return rows ?? [];
  } catch { return []; }
}

export default async function OrgMiniSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) notFound();

  await ensureDbInitialized();
  const org = await getOrganization(id);
  if (!org) notFound();
  const stats = await getOrganizationPublicStats(id);
  const members = await getMembers(id);
  const vacancies = await getVacancies(id);

  const accent = org.accentColor || TYPE_ACCENTS[org.type] || "#0e7490";
  const verificationRate = stats.truthsPublished ? Math.round((stats.verifiedTruths / stats.truthsPublished) * 100) : 0;
  const miniSiteUrl = org.subdomain
    ? `https://${org.subdomain}.9jatruth.com`
    : `https://9jatruth.com/org/${org.id}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/organizations" className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4" style={{ color: accent }} />
            <span>9jatruth</span>
            <span className="text-muted-foreground font-normal">/ Organizations</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            Open dashboard →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border" style={{ background: `linear-gradient(135deg, ${accent}14, transparent 60%)` }}>
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${accent}1f`, color: accent }}>
              {TYPE_LABELS[org.type] || org.type}
            </span>
            {org.verified === 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold">
                <BadgeCheck className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-[10px] font-semibold">
                Pending verification
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{org.name}</h1>
          {org.tagline && <p className="mt-2 text-base text-muted-foreground">{org.tagline}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(org.city || org.region) && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[org.city, org.region].filter(Boolean).join(", ")}</span>
            )}
            {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: accent }}><Globe className="h-3 w-3" />Website</a>}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* About */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">About</h2>
          <p className="text-sm leading-relaxed">{org.description || `${org.name} is a ${TYPE_LABELS[org.type]?.toLowerCase() || "organization"} contributing verified community truths on 9jatruth.`}</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Truths published" value={stats.truthsPublished} icon={CheckCircle2} accent={accent} />
          <StatCard label="Verification rate" value={`${verificationRate}%`} icon={ShieldCheck} accent={accent} />
          <StatCard label="Members" value={stats.members} icon={Users} accent={accent} />
          <StatCard label="Open roles" value={stats.openVacancies} icon={Briefcase} accent={accent} />
        </section>

        {/* AI insights */}
        <OrgInsights orgId={org.id} orgName={org.name} accent={accent} />

        {/* Team */}
        {members.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Team</h2>
              <span className="text-xs text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {members.map((m, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-3 text-center">
                  <div className="mx-auto mb-2 h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: accent }}>
                    {m.display_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="text-xs font-medium truncate">{m.display_name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{m.role}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Vacancies */}
        {vacancies.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open Vacancies</h2>
              <span className="text-xs text-muted-foreground">{vacancies.length} role{vacancies.length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-2">
              {vacancies.map((v) => (
                <div key={v.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{v.title}</h3>
                    {v.employment_type && <span className="text-[9px] rounded-full px-2 py-0.5 shrink-0" style={{ background: `${accent}1f`, color: accent }}>{v.employment_type}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{v.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    {v.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{v.location}</span>}
                    {v.salary_range && <span>💰 {v.salary_range}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact + subdomain */}
        <section className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h3>
            {org.contactEmail && <a href={`mailto:${org.contactEmail}`} className="flex items-center gap-2 text-xs hover:underline"><Mail className="h-3 w-3" />{org.contactEmail}</a>}
            {org.contactPhone && <a href={`tel:${org.contactPhone}`} className="flex items-center gap-2 text-xs hover:underline"><Phone className="h-3 w-3" />{org.contactPhone}</a>}
            {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs hover:underline"><Globe className="h-3 w-3" />{org.website.replace(/^https?:\/\//, "")}</a>}
          </div>
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mini-site link</h3>
            <p className="text-xs text-foreground font-mono break-all">{miniSiteUrl.replace(/^https?:\/\//, "")}</p>
            <p className="text-[10px] text-muted-foreground">
              Org admins can attach a custom subdomain (e.g. <code className="font-mono">{org.subdomain || "yourname"}.9jatruth.com</code>) from the organization dashboard.
            </p>
          </div>
        </section>

        <div className="pt-4 border-t border-border text-center">
          <Link href="/organizations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-3 w-3 rotate-180" /> Back to all organizations
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: typeof Users; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Icon className="h-4 w-4 mb-1" style={{ color: accent }} />
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

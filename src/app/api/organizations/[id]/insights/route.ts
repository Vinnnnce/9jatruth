import { ensureDbInitialized } from "@/lib/db";
import { getOrganization, getOrganizationPublicStats } from "@/lib/neon-storage";
import { generateKimiText, isKimiConfigured } from "@/lib/kimi";
import { z } from "zod";

const idParamSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = idParamSchema.safeParse({ id });
  if (!parsed.success) return Response.json({ error: "Invalid id" }, { status: 400 });

  const org = await getOrganization(parsed.data.id);
  if (!org) return Response.json({ error: "Organization not found" }, { status: 404 });
  const stats = await getOrganizationPublicStats(parsed.data.id);
  const verificationRate = stats.truthsPublished
    ? Math.round((stats.verifiedTruths / stats.truthsPublished) * 100)
    : 0;

  // AI-driven insights via Kimi when configured; deterministic fallback otherwise.
  if (isKimiConfigured()) {
    try {
      const system =
        "You are an analyst for the 9jatruth platform. Given an organization's profile and " +
        "activity stats, produce 3 concise, actionable insights (one sentence each) about its " +
        "engagement, trust, and growth. No markdown, no phone numbers.";
      const user = `Organization: ${org.name} (${org.type})\n` +
        `Verified: ${org.verified ? "yes" : "pending"}\n` +
        `Truths published: ${stats.truthsPublished}\n` +
        `Verified truths: ${stats.verifiedTruths} (${verificationRate}% verification rate)\n` +
        `Members: ${stats.members}\n` +
        `Open vacancies: ${stats.openVacancies}\n` +
        `Region: ${org.region ?? "n/a"}, ${org.city ?? ""}\n` +
        `Description: ${org.description ?? "n/a"}`;
      const ai = await generateKimiText(system, user, { temperature: 0.4, maxOutputTokens: 400 });
      if (ai && ai.trim()) {
        return Response.json({
          source: "ai",
          verificationRate,
          stats,
          insights: splitInsights(ai.trim()),
        });
      }
    } catch (err) {
      console.error("[org-insights] AI error:", err);
    }
  }

  return Response.json({
    source: "static",
    verificationRate,
    stats,
    insights: staticInsights(org.name, stats, verificationRate),
  });
}

function splitInsights(text: string): string[] {
  const lines = text.split("\n").map((l) => l.replace(/^[-•*\d]+[.)]?\s*/, "").trim()).filter(Boolean);
  return lines.slice(0, 3);
}

function staticInsights(name: string, stats: { truthsPublished: number; verifiedTruths: number; members: number; openVacancies: number }, rate: number): string[] {
  const out: string[] = [];
  out.push(
    stats.truthsPublished > 0
      ? `${name} has published ${stats.truthsPublished} truths with a ${rate}% community verification rate.`
      : `${name} has not published any truths yet — encourage members to post community updates.`
  );
  out.push(
    stats.members > 1
      ? `The organization has ${stats.members} members; consider assigning editor roles to active contributors.`
      : `Only one member is linked — invite more collaborators to grow reach.`
  );
  out.push(
    stats.openVacancies > 0
      ? `${stats.openVacancies} open ${stats.openVacancies === 1 ? "vacancy" : "vacancies"} listed — share the mini-site link to attract applicants.`
      : `No open vacancies — publish a role to recruit via the mini-site.`
  );
  return out;
}

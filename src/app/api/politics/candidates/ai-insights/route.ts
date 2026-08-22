import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { generateAiJson, isAiConfigured, type AiSource } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

/**
 * POST /api/politics/candidates/ai-insights
 * Body: { action: "summarize" | "compare" | "gaps" | "risk", candidateId?: number, candidateIds?: number[] }
 *
 * AI-driven capabilities grounded strictly in stored DB fields (no web claims):
 *  - summarize: condense a candidate's manifesto + bio into a brief + key policies
 *  - compare: head-to-head comparison across selected candidates
 *  - gaps: flag missing critical metadata fields (heuristic, always available)
 *  - risk: surface recorded red flags, unverified claims, verification gaps
 *
 * Falls back to heuristics when no AI provider is configured.
 */

function parseArr(v: unknown): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v as string); } catch { return []; }
}

function candidateBrief(c: any): string {
  return [
    `Name: ${c.name}`,
    `Office: ${c.office}${c.office_level ? ` (${c.office_level})` : ""}`,
    `State/LGA/Ward: ${c.state || "—"} / ${c.lga || "—"} / ${c.ward || "—"}`,
    `Party: ${c.party_acronym || "—"}`,
    `Record type: ${c.record_type}`,
    `Election year: ${c.election_year || "—"}`,
    `Gender: ${c.gender || "—"}`,
    `DOB: ${c.date_of_birth || "—"}`,
    `Education: ${JSON.stringify(parseArr(c.education_background))}`,
    `Previous positions: ${JSON.stringify(parseArr(c.previous_political_positions))}`,
    `Political background: ${c.political_background || "—"}`,
    `Businesses: ${JSON.stringify(parseArr(c.businesses))}`,
    `Business interests: ${c.business_interests || "—"}`,
    `Net worth: ${c.net_worth || "—"}`,
    `Health status: ${c.health_status || "—"}`,
    `Autobiography: ${(c.autobiography || c.bio || "").slice(0, 800)}`,
    `Manifesto: ${(c.manifesto || "").slice(0, 1200)}`,
    `Key policies: ${JSON.stringify(parseArr(c.key_policies))}`,
    `Achievements: ${JSON.stringify(parseArr(c.achievements))}`,
    `Corruption allegations: ${JSON.stringify(parseArr(c.corruption_allegations))}`,
    `Court cases: ${JSON.stringify(parseArr(c.court_cases))}`,
    `Controversies: ${JSON.stringify(parseArr(c.controversies))}`,
    `Criminal record: ${JSON.stringify(parseArr(c.criminal_record))}`,
    `Verification status: ${c.verification_status}, data confidence: ${c.data_confidence ?? 0}`,
    `Source URLs: ${JSON.stringify(parseArr(c.source_urls))}`,
  ].join("\n");
}

const CRITICAL_FIELDS = [
  "photo_url", "date_of_birth", "education_background", "political_background",
  "businesses", "health_status", "manifesto", "source_urls", "previous_political_positions",
];

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => ({}));
  const action: string = body.action || "gaps";
  const sql = getDb();

  const ids: number[] = [];
  if (Array.isArray(body.candidateIds)) ids.push(...body.candidateIds.filter((n: any) => Number.isFinite(+n)).map((n: any) => +n));
  if (body.candidateId) ids.push(+body.candidateId);
  if (!ids.length) return Response.json({ message: "Provide candidateId or candidateIds" }, { status: 400 });

  const candidates = (await sql`
    SELECT c.*, p.name AS party_name, p.color AS party_color
    FROM political_candidates c
    LEFT JOIN political_parties p ON c.party_acronym = p.acronym
    WHERE c.id = ANY(${ids}::int[])
  `) as unknown as any[];

  if (!candidates.length) return Response.json({ message: "No candidates found" }, { status: 404 });

  // ── Gaps: heuristic, always available ──
  const gaps = candidates.map((c) => {
    const missing = CRITICAL_FIELDS.filter((f) => {
      const v = (c as any)[f];
      if (v == null) return true;
      if (typeof v === "string") return v.trim() === "" || v === "[]" || v === "{}";
      if (Array.isArray(v)) return v.length === 0;
      return false;
    });
    return { id: c.id, name: c.name, missing, missingCount: missing.length, data_confidence: c.data_confidence ?? 0, verification_status: c.verification_status };
  });

  if (action === "gaps") {
    return Response.json({ gaps, totalGaps: gaps.reduce((s, g) => s + g.missingCount, 0) });
  }

  if (!isAiConfigured()) {
    return Response.json({
      message: "No AI provider configured (set DEEPSEEK_API_KEY or Kimi). Returning heuristic gaps instead.",
      gaps, action, source: "fallback" as AiSource,
    });
  }

  if (action === "summarize") {
    const c = candidates[0];
    const sys = "You are a non-partisan political analyst assistant for 9jatruth, a Nigerian civic accountability platform. Summarize strictly from the provided candidate data. Do not invent facts or add external information. If data is missing, say so explicitly. Be concise, neutral, and factual.";
    const user = `Summarize this Nigerian political candidate's profile and manifesto. Return JSON: { "summary": string, "key_policies": string[], "strengths": string[], "weaknesses": string[], "data_gaps": string[] }.\n\n${candidateBrief(c)}`;
    const { data, source } = await generateAiJson(sys, user, {}, { temperature: 0.3, maxOutputTokens: 900 });
    await sql`UPDATE political_candidates SET manifesto_summary = ${JSON.stringify(data).slice(0, 4000)}, ai_summary = ${JSON.stringify(data).slice(0, 4000)}, ai_last_analyzed = NOW() WHERE id = ${c.id}`.catch(() => {});
    return Response.json({ candidateId: c.id, name: c.name, insights: data, source });
  }

  if (action === "compare") {
    const sys = "You are a non-partisan Nigerian political analyst. Compare candidates strictly using the provided data. Never invent facts. Highlight where data is missing. Return neutral, balanced analysis.";
    const user = `Compare these ${candidates.length} Nigerian political candidates. Return JSON: { "comparison": string, "dimensions": [{ "dimension": string, "candidates": [{ "id": number, "name": string, "value": string }] }], "notable_differences": string[], "data_caveats": string[] }.\n\n${candidates.map(candidateBrief).join("\n\n---\n\n")}`;
    const { data, source } = await generateAiJson(sys, user, {}, { temperature: 0.3, maxOutputTokens: 1400 });
    await sql`UPDATE political_candidates SET ai_comparison = ${JSON.stringify(data).slice(0, 4000)} WHERE id = ${candidates[0].id}`.catch(() => {});
    return Response.json({ candidateIds: candidates.map((c) => c.id), insights: data, source });
  }

  if (action === "risk") {
    const sys = `You are a civic accountability analyst for 9jatruth. Assess political candidate risk strictly from provided data. Flag unverifiable claims, missing disclosures, and integrity red flags. Never fabricate allegations. If nothing adverse is recorded, say 'No recorded adverse findings'. Return JSON: { "risk_level": "low"|"medium"|"high", "red_flags": string[], "unverified_claims": string[], "recommendations": string[] }.`;
    const out = [];
    for (const c of candidates) {
      const user = `Assess risk for this candidate.\n\n${candidateBrief(c)}`;
      const { data, source } = await generateAiJson(sys, user, {}, { temperature: 0.2, maxOutputTokens: 600 });
      await sql`UPDATE political_candidates SET ai_risk_flags = ${JSON.stringify(data).slice(0, 4000)}, ai_last_analyzed = NOW() WHERE id = ${c.id}`.catch(() => {});
      out.push({ id: c.id, name: c.name, risk: data, source });
    }
    return Response.json({ assessments: out });
  }

  return Response.json({ message: `Unknown action: ${action}`, supported: ["summarize", "compare", "gaps", "risk"] }, { status: 400 });
}

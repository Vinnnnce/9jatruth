import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";

/**
 * POST /api/politics/manifesto-analyze
 * AI manifesto analyzer — extracts key promises and themes from a candidate's
 * manifesto. Persists to manifesto_analyses and denormalized onto
 * political_candidates.manifesto_summary.
 *
 * Body: { candidate_id: number }
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const ip = getClientIP(request);
  const rl = rateLimit(`manifesto-analyze:${ip}`, 10, 60_000);
  if (rl) return rl;

  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  if (!isAiConfigured()) {
    return Response.json({ message: "AI provider not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.candidate_id) {
    return Response.json({ message: "candidate_id required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = (await sql`SELECT id, name, office, manifesto, key_policies FROM political_candidates WHERE id = ${body.candidate_id} LIMIT 1`) as any;
  if (!rows || rows.length === 0) {
    return Response.json({ message: "Candidate not found" }, { status: 404 });
  }
  const c = rows[0];
  if (!c.manifesto) {
    return Response.json({ message: "Candidate has no manifesto text to analyze" }, { status: 400 });
  }

  const systemPrompt = `You are a neutral civic analyst for 9jatruth. Extract promises and themes from a Nigerian candidate's manifesto faithfully and without editorializing. Do not invent content not present in the text.`;

  const userPrompt = `Analyze this manifesto and respond with JSON ONLY.

Candidate: ${c.name} (${c.office})
Manifesto:
${String(c.manifesto).slice(0, 4000)}

JSON schema:
{
  "key_promises": ["5-8 concrete promises extracted verbatim where possible"],
  "themes": ["3-6 recurring themes, e.g. security, economy, education"],
  "feasibility_notes": "2-3 sentences noting specificity, measurability, and obvious gaps — neutral tone",
  "summary": "2-3 sentence neutral summary of the manifesto's thrust",
  "confidence": 0-100
}`;

  const fallback = { key_promises: [], themes: [], feasibility_notes: "Analysis unavailable.", summary: "", confidence: 0 };
  const { data, source } = await generateAiJson(systemPrompt, userPrompt, fallback, { temperature: 0.2, maxOutputTokens: 1000 });

  await sql`INSERT INTO manifesto_analyses
    (candidate_id, key_promises, themes, feasibility_notes, summary, confidence, model_name, generated_by)
    VALUES (${c.id}, ${JSON.stringify(data.key_promises ?? [])}::jsonb, ${JSON.stringify(data.themes ?? [])}::jsonb,
            ${data.feasibility_notes ?? ""}, ${data.summary ?? ""}, ${data.confidence ?? 0}, ${source ?? "ai"}, 'super-admin')`;
  await sql`UPDATE political_candidates SET manifesto_summary = ${data.summary ?? ""}, ai_last_analyzed = NOW() WHERE id = ${c.id}`;

  return Response.json({ ok: true, candidate_id: c.id, analysis: data, source });
}

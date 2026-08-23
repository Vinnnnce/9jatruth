import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";

/**
 * POST /api/politics/candidates/ai-profile
 * AI candidate profiler — generates a NEUTRAL summary of a candidate from
 * their stored metadata (bio, education, previous positions, businesses,
 * health status, party, manifesto). Persists to candidate_ai_profiles and
 * denormalized onto political_candidates.ai_summary for fast reads.
 *
 * Body: { candidate_id: number }
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const ip = getClientIP(request);
  const rl = rateLimit(`ai-profile:${ip}`, 10, 60_000);
  if (rl) return rl;

  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  if (!isAiConfigured()) {
    return Response.json({ message: "AI provider not configured (set DEEPSEEK_API_KEY or KIMI_API_KEY)" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.candidate_id) {
    return Response.json({ message: "candidate_id required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = (await sql`SELECT * FROM political_candidates WHERE id = ${body.candidate_id} LIMIT 1`) as any;
  if (!rows || rows.length === 0) {
    return Response.json({ message: "Candidate not found" }, { status: 404 });
  }
  const c = rows[0];

  const systemPrompt = `You are a strictly neutral civic-information analyst for 9jatruth, a Nigerian civic platform. Produce balanced, non-partisan candidate profiles based ONLY on the provided metadata. Do not endorse, smear, or speculate beyond the data. If data is missing, say so explicitly.`;

  const userPrompt = `Generate a neutral candidate profile as JSON ONLY.

Candidate:
- Name: ${c.name}
- Office: ${c.office} (${c.office_level})
- Party: ${c.party_acronym}
- State/LGA/Ward: ${c.state}, ${c.lga}, ${c.ward}
- Autobiography: ${c.autobiography || c.bio || "(none)"}
- Education: ${c.education_background || "(none)"}
- Previous political positions: ${c.previous_political_positions || "(none)"}
- Political background: ${c.political_background || "(none)"}
- Businesses / interests: ${c.businesses || c.business_interests || "(none)"}
- Health status (high-level): ${c.health_status || "(undisclosed)"}
- Manifesto: ${c.manifesto ? String(c.manifesto).slice(0, 1500) : "(none)"}

JSON schema:
{
  "summary": "3-5 sentence neutral summary of the candidate",
  "key_strengths": ["3-5 concise, evidence-grounded strengths"],
  "key_concerns": ["3-5 neutral, data-grounded concerns or gaps"],
  "stance_themes": ["main themes/priorities inferred from manifesto + background"],
  "confidence": 0-100
}`;

  const fallback = { summary: "Profile unavailable.", key_strengths: [], key_concerns: [], stance_themes: [], confidence: 0 };
  const { data, source } = await generateAiJson(systemPrompt, userPrompt, fallback, { temperature: 0.2, maxOutputTokens: 900 });

  // Persist versioned profile + denormalized summary.
  await sql`INSERT INTO candidate_ai_profiles
    (candidate_id, summary, key_strengths, key_concerns, stance_themes, confidence, model_name, generated_by)
    VALUES (${c.id}, ${data.summary}, ${JSON.stringify(data.key_strengths ?? [])}::jsonb,
            ${JSON.stringify(data.key_concerns ?? [])}::jsonb, ${JSON.stringify(data.stance_themes ?? [])}::jsonb,
            ${data.confidence ?? 0}, ${source ?? "ai"}, 'super-admin')`;
  await sql`UPDATE political_candidates SET ai_summary = ${data.summary}, ai_last_analyzed = NOW() WHERE id = ${c.id}`;

  return Response.json({ ok: true, candidate_id: c.id, profile: data, source });
}

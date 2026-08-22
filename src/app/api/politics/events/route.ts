import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { getClerkUserId, getUserId, sanitizeText } from "@/lib/api-helpers";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";
import { z } from "zod";

/**
 * Political micro-truths / events submitted by users
 * (e.g. "Candidate X visited Ward Y", "Campaign rally held here").
 *
 * GET  /api/politics/events?state=&status=&limit=  → list events
 * POST /api/politics/events                         → submit an event (AI fact-checks on submit)
 *
 * On submit, the Deepseek+Kimi ensemble runs a fake-news / plausibility check
 * and stores the verdict + confidence. Pending events need admin review.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const status = searchParams.get("status") || "approved";
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const sql = getDb();
  const rows = (await sql`
    SELECT e.*, c.name AS candidate_name
    FROM political_events e
    LEFT JOIN political_candidates c ON e.candidate_id = c.id
    WHERE (${state ?? null}::text IS NULL OR e.state = ${state ?? null})
      AND (${status === "all"}::boolean OR e.status = ${status})
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `) as unknown as any[];
  return Response.json({ events: rows });
}

const eventSchema = z.object({
  event_type: z.enum(["campaign_rally", "candidate_visit", "infrastructure_promise", "vote_buying_report", "violence_report", "result_anomaly", "other"]),
  candidate_id: z.number().int().positive().optional().nullable(),
  party_acronym: z.string().max(12).optional().nullable(),
  geo_id: z.string().max(20).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  lga: z.string().max(100).optional().nullable(),
  ward: z.string().max(100).optional().nullable(),
  description: z.string().min(5).max(2000),
  evidence_url: z.string().url().or(z.literal("")).optional().nullable(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const ip = getClientIP(request);
  const rl = rateLimit(`politics-events:${ip}`, 10, 60_000);
  if (rl) return rl;

  // Require sign-in (when Clerk is configured).
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20) {
      return Response.json({ message: "Unauthorized — Please sign in to submit a political report" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid event", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const submittedBy = (await getUserId(request)) ?? clerkUserId ?? "anonymous";
  const sql = getDb();

  // AI fake-news / plausibility check via the ensemble.
  let aiVerdict = "unverified";
  let aiConfidence = 0;
  if (isAiConfigured()) {
    try {
      const { data } = await generateAiJson(
        "You are a political fact-checker for 9jatruth (Nigeria). Assess whether a user-submitted political report is plausible, internally consistent, and whether it resembles known disinformation patterns. Be cautious — absence of evidence is not proof of falsehood.",
        `Assess this political report and respond with ONLY JSON: { "verdict": "credible"|"unverified"|"likely_false"|"suspicious", "confidence": 0-100, "reasoning": "one short sentence", "flags": ["specific concern or empty"] }.\n\nReport: ${JSON.stringify(d)}`,
        { verdict: "unverified", confidence: 0, reasoning: "", flags: [] as string[] },
        { temperature: 0.2, maxOutputTokens: 500 }
      );
      aiVerdict = data.verdict || "unverified";
      aiConfidence = Number(data.confidence) || 0;
      // Suspicious / likely_false submissions go straight to pending review.
      if (aiVerdict === "suspicious" || aiVerdict === "likely_false") {
        await sql`INSERT INTO political_abuse_signals (signal_type, entity_type, entity_id, severity, details, detected_by)
          VALUES ('suspicious_report', 'political_event', '0', ${aiVerdict === "likely_false" ? "high" : "medium"}, ${JSON.stringify({ reasoning: data.reasoning, flags: data.flags, description: d.description })}::jsonb, 'ai')`;
      }
    } catch (err) {
      console.error("[politics/events] AI fact-check failed:", err);
    }
  }

  const status = aiVerdict === "suspicious" || aiVerdict === "likely_false" ? "flagged" : "pending";
  const inserted = (await sql`
    INSERT INTO political_events (event_type, candidate_id, party_acronym, geo_id, state, lga, ward, description, evidence_url, submitted_by, status, ai_verdict, ai_confidence)
    VALUES (${d.event_type}, ${d.candidate_id ?? null}, ${d.party_acronym ?? null}, ${d.geo_id ?? null}, ${d.state ?? null}, ${d.lga ?? null}, ${d.ward ?? null}, ${sanitizeText(d.description)}, ${d.evidence_url || null}, ${submittedBy}, ${status}, ${aiVerdict}, ${aiConfidence})
    RETURNING *
  `) as unknown as any[];
  return Response.json({ event: inserted[0], aiVerdict, aiConfidence });
}

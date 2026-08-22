import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";
import { z } from "zod";

/**
 * POST /api/politics/fact-check
 * AI-driven fake political news detection. Given a claim/headline + optional
 * source, the Deepseek+Kimi ensemble returns a verdict, confidence, reasoning,
 * and named flags. Uses the ensemble: Deepseek primary, Kimi fallback.
 */
const schema = z.object({
  claim: z.string().min(5).max(5000),
  source: z.string().max(500).optional().nullable(),
  context: z.string().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const ip = getClientIP(request);
  const rl = rateLimit(`politics-factcheck:${ip}`, 15, 60_000);
  if (rl) return rl;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid claim", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  if (!isAiConfigured()) {
    return Response.json({ message: "AI fact-checking is not configured. Set DEEPSEEK_API_KEY." }, { status: 503 });
  }

  try {
    const { data, source } = await generateAiJson(
      `You are an expert Nigerian political fact-checker for 9jatruth. Evaluate claims about Nigerian politics, elections, candidates, and governance. Base assessments on general knowledge up to your cutoff, flag unverifiable claims as "unverified", and never assert a fact you cannot substantiate. Be balanced and non-partisan.`,
      `Fact-check this political claim and respond with ONLY JSON:
{
  "verdict": "true"|"mostly_true"|"mixed"|"mostly_false"|"false"|"unverified",
  "confidence": 0-100,
  "reasoning": "2-4 sentences explaining the verdict",
  "evidence_points": ["specific supporting or contradicting points"],
  "flags": ["disinformation_pattern_detected"|"impersonation"|"fabricated_quotes"|"manipulated_media"|"none"],
  "recommendation": "one short sentence on how to verify or treat this claim"
}

Claim: ${d.claim}${d.source ? `\nSource/context: ${d.source}` : ""}${d.context ? `\nAdditional context: ${d.context}` : ""}`,
      { verdict: "unverified", confidence: 0, reasoning: "", evidence_points: [] as string[], flags: ["none"], recommendation: "" },
      { temperature: 0.2, maxOutputTokens: 800 }
    );

    // Log suspicious verdicts into the abuse-signal feed for the security dashboard.
    const suspicious = data.verdict === "false" || data.verdict === "mostly_false" || (data.flags || []).includes("disinformation_pattern_detected");
    if (suspicious) {
      try {
        const sql = getDb();
        await sql`INSERT INTO political_abuse_signals (signal_type, entity_type, entity_id, severity, details, detected_by)
          VALUES ('fake_news', 'claim', '0', ${data.confidence >= 70 ? "high" : "medium"}, ${JSON.stringify({ claim: d.claim.slice(0, 500), verdict: data.verdict, reasoning: data.reasoning, flags: data.flags })}::jsonb, ${'ai:' + source})`;
      } catch (e) {
        console.error("[politics/fact-check] signal log failed:", e);
      }
    }

    return Response.json({ result: data, source, suspicious });
  } catch (err: any) {
    console.error("[politics/fact-check] AI error:", err);
    return Response.json({ message: err?.message || "AI fact-check failed" }, { status: 502 });
  }
}

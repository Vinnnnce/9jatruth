import { ensureDbInitialized, getDb } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";

/**
 * GET /api/compare?type=candidate|neighborhood|agency&ids=1,2,3
 *
 * Generic comparison API. Fetches raw data for 2–4 entities of the same type,
 * then (when AI is configured) generates a NEUTRAL, structured comparison:
 *   - key_differences
 *   - strengths / weaknesses (per entity)
 *   - highlights
 * Returns both the raw entities and the AI summary so the UI can render
 * side-by-side cards plus an AI summary section.
 */
export const dynamic = "force-dynamic";

type CompareResult = {
  summary: string;
  key_differences: string[];
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  highlights: string[];
  confidence: number;
};

const FALLBACK: CompareResult = {
  summary: "AI comparison unavailable.",
  key_differences: [],
  strengths: {},
  weaknesses: {},
  highlights: [],
  confidence: 0,
};

function parseIds(q: string | null): number[] {
  if (!q) return [];
  return q.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0).slice(0, 4);
}

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "neighborhood").toLowerCase();
  const ids = parseIds(searchParams.get("ids"));
  if (ids.length < 2) {
    return Response.json({ message: "Provide at least 2 ids, e.g. ?type=candidate&ids=1,2" }, { status: 400 });
  }
  if (!["candidate", "neighborhood", "agency"].includes(type)) {
    return Response.json({ message: "type must be candidate, neighborhood, or agency" }, { status: 400 });
  }

  const ip = getClientIP(request);
  const rl = rateLimit(`compare:${ip}`, 20, 60_000);
  if (rl) return rl;

  const sql = getDb();
  let entities: any[] = [];

  if (type === "candidate") {
    entities = (await sql`
      SELECT c.id, c.name, c.office, c.office_level, c.party_acronym, c.state, c.lga,
             c.autobiography, c.education_background, c.previous_political_positions,
             c.businesses, c.health_status, c.manifesto, c.manifesto_summary,
             c.record_type, c.election_year, c.term_start, c.term_end, c.ai_summary,
             p.name AS party_name, p.color AS party_color
      FROM political_candidates c
      LEFT JOIN political_parties p ON c.party_acronym = p.acronym
      WHERE c.id = ANY(${ids}::int[])`) as any;
  } else if (type === "neighborhood") {
    entities = (await sql`
      SELECT n.id, n.name, n.region, n.state, n.lga, n.lat, n.lng,
             s.power_status, s.fuel_status, s.traffic_level, s.price_index,
             s.safety_index, s.active_truths,
             (SELECT COUNT(*) FROM micro_truths t WHERE t.neighborhood_id = n.id AND t.status = 'verified') AS truth_count
      FROM neighborhoods n
      LEFT JOIN snapshots s ON s.neighborhood_id = n.id
      WHERE n.id = ANY(${ids}::int[])`) as any;
  } else {
    // agency
    entities = (await sql`
      SELECT o.id, o.name, o.type, o.verification_badge,
             (SELECT COUNT(*) FROM news_articles a WHERE a.organization_id = o.id AND a.status = 'published') AS published_count
      FROM organizations o
      WHERE o.id = ANY(${ids}::int[])`) as any;
  }

  if (entities.length < 2) {
    return Response.json({ message: `Could not find 2 ${type}s for the given ids` }, { status: 404 });
  }

  let ai: CompareResult = FALLBACK;
  let aiSource: string | null = null;
  let aiPowered = false;

  if (isAiConfigured()) {
    const systemPrompt = `You are a neutral civic analyst for 9jatruth. Compare the provided entities objectively, using only the supplied data. Be balanced and concise.`;
    const userPrompt = `Compare these ${type} entities and respond with JSON ONLY.

Entities:
${JSON.stringify(entities, null, 2)}

JSON schema:
{
  "summary": "2-3 sentence neutral overall comparison",
  "key_differences": ["3-6 concise differences"],
  "strengths": { "<entity name or id>": ["strengths for that entity"] },
  "weaknesses": { "<entity name or id>": ["weaknesses / gaps for that entity"] },
  "highlights": ["3-5 notable takeaways for a reader"],
  "confidence": 0-100
}`;
    try {
      const res = await generateAiJson(systemPrompt, userPrompt, FALLBACK, { temperature: 0.3, maxOutputTokens: 1200 });
      ai = res.data as CompareResult;
      aiSource = res.source;
      aiPowered = true;
    } catch (err) {
      console.error("[compare] AI failed:", err);
    }
  }

  return Response.json({ type, ids, entities, aiSummary: ai, aiSource, aiPowered });
}

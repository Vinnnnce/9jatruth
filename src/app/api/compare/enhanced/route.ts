import { ensureDbInitialized, getDb } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson } from "@/lib/ai-providers";

/**
 * GET /api/compare?type=candidate|office-holder|party|geo&ids=1,2,3
 *
 * Enhanced comparison API supporting:
 *   - candidates (political candidates)
 *   - office-holders (incumbent politicians)
 *   - parties (political parties)
 *   - geo (geo units: states/lgas)
 *
 * Returns raw entities + AI-driven neutral comparison:
 *   - key_differences
 *   - strengths / weaknesses (per entity)
 *   - neutral_insights
 *   - confidence
 *
 * Output is factual, non-political, and non-persuasive.
 */

export const dynamic = "force-dynamic";

type CompareResult = {
  summary: string;
  key_differences: string[];
  strengths: Record<string, string[]>;
  weaknesses: Record<string, string[]>;
  neutral_insights: string[];
  confidence: number;
};

const FALLBACK: CompareResult = {
  summary: "AI comparison unavailable. Showing raw data only.",
  key_differences: [],
  strengths: {},
  weaknesses: {},
  neutral_insights: [],
  confidence: 0,
};

function parseIds(q: string | null): number[] {
  if (!q) return [];
  return q
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 4);
}

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "candidate").toLowerCase();
  const ids = parseIds(searchParams.get("ids"));

  if (ids.length < 2) {
    return Response.json(
      { message: "Provide at least 2 ids, e.g. ?type=candidate&ids=1,2" },
      { status: 400 }
    );
  }

  const validTypes = ["candidate", "office-holder", "party", "geo"];
  if (!validTypes.includes(type)) {
    return Response.json(
      {
        message: `type must be one of: ${validTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const ip = getClientIP(request);
  const rl = rateLimit(`compare:${ip}`, 20, 60_000);
  if (rl) return rl;

  const sql = getDb();
  let entities: any[] = [];

  try {
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
    } else if (type === "office-holder") {
      entities = (await sql`
        SELECT oh.id, oh.status, oh.term_start, oh.term_end, oh.incumbent_since,
               oh.party_acronym, oh.senatorial_district, oh.federal_constituency, oh.state_constituency,
               pp.code AS position_code, pp.name AS position_name, pp.level AS position_level,
               p.id AS person_id, p.slug AS person_slug, p.full_name, p.photo_url, p.gender,
               p.autobiography, p.education_background, p.previous_political_positions,
               p.political_background, p.businesses, p.health_status, p.state_of_origin,
               s.name AS state_name, s.code AS state_code,
               party.name AS party_name, party.color AS party_color
        FROM office_holders oh
        JOIN political_persons p ON p.id = oh.person_id
        JOIN political_positions pp ON pp.id = oh.position_id
        LEFT JOIN states s ON s.id = oh.state_id
        LEFT JOIN political_parties party ON party.acronym = oh.party_acronym
        WHERE oh.id = ANY(${ids}::int[]) AND oh.status = 'active'`) as any;
    } else if (type === "party") {
      entities = (await sql`
        SELECT p.id, p.acronym, p.name, p.color, p.logo_url, p.active,
               (SELECT COUNT(*) FROM political_candidates c WHERE c.party_acronym = p.acronym) AS candidate_count,
               (SELECT COUNT(*) FROM office_holders oh WHERE oh.party_acronym = p.acronym AND oh.status = 'active') AS holder_count
        FROM political_parties p
        WHERE p.id = ANY(${ids}::int[])`) as any;
    } else if (type === "geo") {
      entities = (await sql`
        SELECT s.id, s.name, s.code, s.region_id,
               r.name AS region_name, r.code AS region_code,
               (SELECT COUNT(*) FROM political_candidates c WHERE c.state = s.name) AS candidate_count,
               (SELECT COUNT(*) FROM office_holders oh WHERE oh.state_id = s.id AND oh.status = 'active') AS holder_count,
               (SELECT COUNT(*) FROM lgas l WHERE l.state_id = s.id) AS lga_count
        FROM states s
        LEFT JOIN regions r ON r.id = s.region_id
        WHERE s.id = ANY(${ids}::int[])`) as any;
    }
  } catch (err) {
    console.error("[compare] Query error:", err);
    return Response.json(
      { message: "Failed to fetch comparison data" },
      { status: 500 }
    );
  }

  if (entities.length < 2) {
    return Response.json(
      { message: `Could not find 2 ${type}s for the given ids` },
      { status: 404 }
    );
  }

  // AI-driven comparison
  let ai: CompareResult = FALLBACK;
  let aiPowered = false;
  let aiSource: string | null = null;

  if (isAiConfigured()) {
    const systemPrompt = `You are a neutral civic analyst for 9jatruth. Compare the provided entities objectively, using only the supplied data. Be balanced, factual, and concise. Do not express political opinions, endorse candidates, or persuade readers. Focus on verifiable differences in background, experience, and stated positions.`;

    const entityData = JSON.stringify(entities, null, 2);

    const userPrompt = `Compare these ${type} entities and respond with JSON ONLY. Use entity IDs as keys in strengths/weaknesses objects.

Entities:
${entityData}

Respond with this exact JSON structure:
{
  "summary": "A 2-3 sentence neutral summary of what these entities have in common and how they differ",
  "key_differences": ["difference 1", "difference 2", ...],
  "strengths": { "entity_id_1": ["strength 1", ...], "entity_id_2": [...] },
  "weaknesses": { "entity_id_1": ["weakness 1", ...], "entity_id_2": [...] },
  "neutral_insights": ["insight 1", "insight 2", ...],
  "confidence": 0.0-1.0
}`;

    try {
      const result = await generateAiJson(systemPrompt, userPrompt, FALLBACK);
      if (result && result.data && typeof result.data === "object") {
        const d = result.data as any;
        ai = {
          summary: d.summary || FALLBACK.summary,
          key_differences: Array.isArray(d.key_differences) ? d.key_differences : [],
          strengths: typeof d.strengths === "object" ? d.strengths : {},
          weaknesses: typeof d.weaknesses === "object" ? d.weaknesses : {},
          neutral_insights: Array.isArray(d.neutral_insights) ? d.neutral_insights : [],
          confidence: typeof d.confidence === "number" ? d.confidence : 0.5,
        };
        aiPowered = true;
        aiSource = result.source;
      }
    } catch (err) {
      console.error("[compare] AI generation failed:", err);
    }
  }

  return Response.json({
    type,
    entities,
    ai,
    aiPowered,
    aiSource,
  });
}

import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Current office holders (incumbents) — normalized model.
 * GET /api/politics/office-holders?zone=&state=&lga=&ward=&position=&party=
 *
 * Filters by geopolitical zone, state, LGA, ward, position code, and party.
 * Joins political_persons ↔ office_holders ↔ political_positions ↔ geo tables.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 1000);
  try {
  await ensureDbInitialized();
  const zone = searchParams.get("zone"); // geopolitical zone code (NC/NE/...)
  const state = searchParams.get("state"); // state id or name
  const lga = searchParams.get("lga");
  const ward = searchParams.get("ward");
  const position = searchParams.get("position"); // position code
  const party = searchParams.get("party");

  const sql = getDb();

  // Resolve zone → state ids, or state name → state id, for filtering.
  const stateIdClause = (() => {
    if (state) return null; // handled by name/ILIKE below
    return null;
  })();

  const rows = (await sql`
    SELECT
      oh.id, oh.status, oh.term_start, oh.term_end, oh.incumbent_since,
      oh.senatorial_district, oh.federal_constituency, oh.state_constituency,
      oh.party_acronym, oh.verification_status, oh.data_confidence, oh.source_urls,
      pp.code AS position_code, pp.name AS position_name, pp.level AS position_level,
      p.id AS person_id, p.slug AS person_slug, p.full_name, p.photo_url, p.gender,
      p.autobiography, p.education_background, p.previous_political_positions,
      p.political_background, p.businesses, p.health_status, p.state_of_origin,
      p.local_govt_of_origin,
      s.name AS state_name, s.code AS state_code, s.id AS state_id,
      l.name AS lga_name, l.code AS lga_code, l.id AS lga_id,
      w.name AS ward_name, w.code AS ward_code,
      r.name AS zone_name, r.code AS zone_code,
      party.name AS party_name, party.color AS party_color, party.logo_url AS party_logo
    FROM office_holders oh
    JOIN political_persons p ON p.id = oh.person_id
    JOIN political_positions pp ON pp.id = oh.position_id
    LEFT JOIN states s ON s.id = oh.state_id
    LEFT JOIN lgas l ON l.id = oh.lga_id
    LEFT JOIN wards w ON w.id = oh.ward_id
    LEFT JOIN regions r ON r.id = s.region_id
    LEFT JOIN political_parties party ON party.acronym = oh.party_acronym
    WHERE oh.status = 'active'
      AND (${position ?? null}::text IS NULL OR pp.code = ${position ?? null})
      AND (${party ?? null}::text IS NULL OR oh.party_acronym = ${party ?? null})
      AND (${zone ?? null}::text IS NULL OR r.code = ${zone ?? null})
      AND (${state ?? null}::text IS NULL OR s.id::text = ${state ?? null} OR s.name ILIKE ${"%" + (state ?? "") + "%"})
      AND (${lga ?? null}::text IS NULL OR l.id::text = ${lga ?? null} OR l.name ILIKE ${"%" + (lga ?? "") + "%"})
      AND (${ward ?? null}::text IS NULL OR w.id::text = ${ward ?? null} OR w.name ILIKE ${"%" + (ward ?? "") + "%"})
    ORDER BY pp.sort_order, s.name, p.full_name
    LIMIT ${limit}
  `) as unknown as any[];

  console.log(`[politics/office-holders] Returning ${rows.length} office holders`);
  return Response.json({ officeHolders: rows, total: rows.length, limit });
  } catch (err: any) {
    console.error("[politics/office-holders] GET failed:", err);
    return Response.json({ message: "Failed to load office holders", error: err.message, officeHolders: [], total: 0, limit }, { status: 500 });
  }
}

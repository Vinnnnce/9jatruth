import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/office-holders
 * Current office holders (president, VP, governors, senators, reps, LGA
 * chairmen, councillors) filterable by geopolitical zone, state, LGA, ward
 * and position. Joins people, parties, positions and geo units.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const positionSlug = searchParams.get("position");
  const stateId = searchParams.get("state_id");
  const lgaId = searchParams.get("lga_id");
  const wardId = searchParams.get("ward_id");
  const zoneCode = searchParams.get("zone")?.toUpperCase();
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  try {
    const rows = (await sql`
      SELECT oh.id, oh.status, oh.term_start, oh.term_end, oh.incumbent_since,
             oh.senatorial_district, oh.federal_constituency, oh.state_constituency,
             oh.office_level, oh.source, oh.source_url,
             pe.full_name, pe.slug, pe.photo_url, pe.gender, pe.autobiography,
             pe.political_background, pe.health_status, pe.state_of_origin,
             pe.local_govt_of_origin, pe.education_background,
             pe.previous_political_positions, pe.businesses,
             pp.name AS position_name, pp.slug AS position_slug,
             pa.acronym AS party_acronym, pa.name AS party_name, pa.color AS party_color, pa.logo_url AS party_logo,
             s.name AS state_name, l.name AS lga_name, w.name AS ward_name,
             gz.name AS zone_name, gz.short_code AS zone_code
      FROM office_holders oh
      JOIN people pe ON pe.id = oh.person_id
      LEFT JOIN political_positions pp ON pp.id = oh.position_id
      LEFT JOIN political_parties pa ON pa.id = oh.party_id
      LEFT JOIN states s ON s.id = oh.state_id
      LEFT JOIN lgas l ON l.id = oh.lga_id
      LEFT JOIN wards w ON w.id = oh.ward_id
      LEFT JOIN geopolitical_zones gz ON gz.id = oh.geopolitical_zone_id
      WHERE oh.status = 'active'
        AND (${positionSlug ?? null}::text IS NULL OR pp.slug = ${positionSlug})
        AND (${stateId ?? null}::int IS NULL OR oh.state_id = ${stateId ? parseInt(stateId) : null}::int)
        AND (${lgaId ?? null}::int IS NULL OR oh.lga_id = ${lgaId ? parseInt(lgaId) : null}::int)
        AND (${wardId ?? null}::int IS NULL OR oh.ward_id = ${wardId ? parseInt(wardId) : null}::int)
        AND (${zoneCode ?? null}::text IS NULL OR gz.short_code = ${zoneCode} OR gz.code = ${zoneCode})
        AND (${search ?? null}::text IS NULL OR pe.full_name ILIKE ${"%" + (search ?? "") + "%"})
      ORDER BY pp.sort_order NULLS LAST, pe.full_name
      LIMIT ${limit}`) as unknown as any[];

    return Response.json({ officeHolders: rows, count: rows.length });
  } catch (err: any) {
    return Response.json({ message: err?.message || "Failed to load office holders" }, { status: 500 });
  }
}

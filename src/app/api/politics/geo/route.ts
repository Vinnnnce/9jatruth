import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/geo
 * Returns Nigeria's electoral geography for filter UIs:
 *  ?zone=nc          → states in a geopolitical zone
 *  ?state_id=1        → LGAs in a state
 *  ?lga_id=5          → wards in an LGA
 *  (no params)       → all 6 geopolitical zones with their states
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id");
  const lgaId = searchParams.get("lga_id");
  const zoneCode = searchParams.get("zone")?.toUpperCase();

  try {
    if (lgaId) {
      const wards = (await sql`
        SELECT w.id, w.name, w.inec_code, w.code, w.lat, w.lng
        FROM wards w
        WHERE w.lga_id = ${parseInt(lgaId)} AND w.deleted_at IS NULL
          AND w.inec_code IS NOT NULL
        ORDER BY w.name`) as unknown as any[];
      return Response.json({ wards });
    }
    if (stateId) {
      const lgas = (await sql`
        SELECT l.id, l.name, l.inec_code,
          (SELECT COUNT(*) FROM wards w WHERE w.lga_id = l.id AND w.inec_code IS NOT NULL) AS ward_count
        FROM lgas l
        WHERE l.state_id = ${parseInt(stateId)}
        ORDER BY l.name`) as unknown as any[];
      return Response.json({ lgas });
    }
    if (zoneCode) {
      const states = (await sql`
        SELECT s.id, s.name, s.inec_code, s.lat, s.lng, s.capital
        FROM states s
        JOIN geopolitical_zones z ON z.id = s.geopolitical_zone_id
        WHERE z.short_code = ${zoneCode} OR z.code = ${zoneCode}
        ORDER BY s.name`) as unknown as any[];
      return Response.json({ states });
    }
    const zones = (await sql`
      SELECT z.id, z.name, z.code, z.short_code,
        (SELECT COUNT(*) FROM states s WHERE s.geopolitical_zone_id = z.id) AS state_count
      FROM geopolitical_zones z
      ORDER BY z.name`) as unknown as any[];
    return Response.json({ zones });
  } catch (err: any) {
    return Response.json({ message: err?.message || "Failed to load geo" }, { status: 500 });
  }
}

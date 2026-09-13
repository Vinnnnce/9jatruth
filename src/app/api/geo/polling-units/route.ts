import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/geo/polling-units
 * Search polling units by geo hierarchy with pagination.
 * Query params: state_id, lga_id, ward_id, search, limit, offset
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id");
  const lgaId = searchParams.get("lga_id");
  const wardId = searchParams.get("ward_id");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 1000);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  try {
    const rows = (await sql`
      SELECT pu.id, pu.code, pu.pu_code, pu.name, pu.location,
             pu.ward_id, pu.lga_id, pu.state_id, pu.portal_id,
             w.name AS ward_name, l.name AS lga_name, s.name AS state_name
      FROM geo_polling_units pu
      LEFT JOIN wards w ON w.id = pu.ward_id
      LEFT JOIN lgas l ON l.id = pu.lga_id
      LEFT JOIN states s ON s.id = pu.state_id
      WHERE (${stateId ?? null}::int IS NULL OR pu.state_id = ${stateId ?? null}::int)
        AND (${lgaId ?? null}::int IS NULL OR pu.lga_id = ${lgaId ?? null}::int)
        AND (${wardId ?? null}::int IS NULL OR pu.ward_id = ${wardId ?? null}::int)
        AND (${search ?? null}::text IS NULL OR pu.name ILIKE ${"%" + (search ?? "") + "%"} OR pu.code ILIKE ${"%" + (search ?? "") + "%"})
      ORDER BY pu.code
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as any[];
    const count = ((await sql`
      SELECT COUNT(*) c FROM geo_polling_units pu
      WHERE (${stateId ?? null}::int IS NULL OR pu.state_id = ${stateId ?? null}::int)
        AND (${lgaId ?? null}::int IS NULL OR pu.lga_id = ${lgaId ?? null}::int)
        AND (${wardId ?? null}::int IS NULL OR pu.ward_id = ${wardId ?? null}::int)
        AND (${search ?? null}::text IS NULL OR pu.name ILIKE ${"%" + (search ?? "") + "%"} OR pu.code ILIKE ${"%" + (search ?? "") + "%"})
    `) as unknown as any[])[0];
    return Response.json({ pollingUnits: rows, total: count?.c ?? 0, limit, offset });
  } catch (err: any) {
    console.error("[api/geo/polling-units] Error:", err);
    return Response.json({ message: "Failed to search polling units" }, { status: 500 });
  }
}

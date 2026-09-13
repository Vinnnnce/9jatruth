import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/geo/states
 * List all 37 states with their geopolitical zones.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbInitialized();
  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT s.id, s.name, s.code, s.portal_id, s.region_id, s.lat, s.lng,
             r.name AS region_name, r.code AS region_code
      FROM states s
      LEFT JOIN regions r ON r.id = s.region_id
      ORDER BY s.code
    `) as unknown as any[];
    return Response.json({ states: rows, total: rows.length });
  } catch (err: any) {
    console.error("[api/geo/states] Error:", err);
    return Response.json({ message: "Failed to load states" }, { status: 500 });
  }
}

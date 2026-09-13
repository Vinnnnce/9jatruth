import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/geo/wards/{id}/polling-units
 * List polling units for a given ward.
 * Query params: limit (default 500), offset (default 0)
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const sql = getDb();
  const { id } = await params;
  const wardId = parseInt(id, 10);
  if (!wardId || isNaN(wardId)) {
    return Response.json({ message: "Invalid ward ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "500", 10) || 500, 1000);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  try {
    const rows = (await sql`
      SELECT id, code, pu_code, name, location, ward_id, lga_id, state_id, portal_id
      FROM geo_polling_units
      WHERE ward_id = ${wardId}
      ORDER BY pu_code
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as any[];
    const count = ((await sql`SELECT COUNT(*) c FROM geo_polling_units WHERE ward_id = ${wardId}`) as unknown as any[])[0];
    return Response.json({ pollingUnits: rows, total: count?.c ?? 0, limit, offset });
  } catch (err: any) {
    console.error("[api/geo/wards/[id]/polling-units] Error:", err);
    return Response.json({ message: "Failed to load polling units" }, { status: 500 });
  }
}

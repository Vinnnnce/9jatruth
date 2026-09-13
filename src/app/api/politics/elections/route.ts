import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/elections
 * List all election cycles.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const status = searchParams.get("status");

  try {
    const rows = (await sql`
      SELECT e.id, e.year, e.name, e.type, e.geo_scope, e.election_date, e.status, e.created_at,
             tt.id AS timetable_id,
             CASE WHEN tt.id IS NOT NULL THEN true ELSE false END AS has_timetable
      FROM political_elections e
      LEFT JOIN election_timetable tt ON tt.election_id = e.id
      WHERE (${year ?? null}::int IS NULL OR e.year = ${year ?? null}::int)
        AND (${status ?? null}::text IS NULL OR e.status = ${status ?? null})
      ORDER BY e.year DESC
    `) as unknown as any[];
    return Response.json({ elections: rows, total: rows.length });
  } catch (err: any) {
    console.error("[api/politics/elections] Error:", err);
    return Response.json({ message: "Failed to load elections" }, { status: 500 });
  }
}

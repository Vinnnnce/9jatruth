import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/elections/{id}
 * Single election detail.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const sql = getDb();
  const { id } = await params;
  const electionId = parseInt(id, 10);
  if (!electionId || isNaN(electionId)) {
    return Response.json({ message: "Invalid election ID" }, { status: 400 });
  }
  try {
    const row = ((await sql`
      SELECT e.id, e.year, e.name, e.type, e.geo_scope, e.election_date, e.status, e.created_at,
             tt.id AS timetable_id,
             CASE WHEN tt.id IS NOT NULL THEN true ELSE false END AS has_timetable
      FROM political_elections e
      LEFT JOIN election_timetable tt ON tt.election_id = e.id
      WHERE e.id = ${electionId}
      LIMIT 1
    `) as unknown as any[])[0];
    if (!row) return Response.json({ message: "Election not found" }, { status: 404 });
    return Response.json({ election: row });
  } catch (err: any) {
    console.error("[api/politics/elections/[id]] Error:", err);
    return Response.json({ message: "Failed to load election" }, { status: 500 });
  }
}

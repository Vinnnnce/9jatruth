import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/elections/{id}/timetable
 * Get the full timetable with all events/phases for an election.
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
    const timetable = ((await sql`
      SELECT id, election_id, title, description, published_date, status, source_url, created_at, updated_at
      FROM election_timetable
      WHERE election_id = ${electionId}
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as any[])[0];

    if (!timetable) {
      return Response.json({ message: "No timetable found for this election" }, { status: 404 });
    }

    const events = (await sql`
      SELECT ev.id, ev.timetable_id, ev.election_id, ev.name, ev.description,
             ev.event_type, ev.geo_scope, ev.state_id, ev.start_date, ev.end_date,
             ev.sort_order, ev.status, ev.notes, ev.source_url, ev.created_at, ev.updated_at,
             s.name AS state_name
      FROM election_events ev
      LEFT JOIN states s ON s.id = ev.state_id
      WHERE ev.timetable_id = ${timetable.id}
      ORDER BY ev.sort_order, ev.start_date
    `) as unknown as any[];

    return Response.json({ timetable: { ...timetable, events } });
  } catch (err: any) {
    console.error("[api/politics/elections/[id]/timetable] Error:", err);
    return Response.json({ message: "Failed to load timetable" }, { status: 500 });
  }
}

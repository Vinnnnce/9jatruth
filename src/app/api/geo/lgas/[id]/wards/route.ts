import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/geo/lgas/{id}/wards
 * List wards for a given LGA.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const sql = getDb();
  const { id } = await params;
  const lgaId = parseInt(id, 10);
  if (!lgaId || isNaN(lgaId)) {
    return Response.json({ message: "Invalid LGA ID" }, { status: 400 });
  }
  try {
    const rows = (await sql`
      SELECT w.id, w.name, w.code, w.lga_id, w.state_id, w.portal_id
      FROM wards w
      WHERE w.lga_id = ${lgaId}
      ORDER BY w.name
    `) as unknown as any[];
    return Response.json({ wards: rows, total: rows.length });
  } catch (err: any) {
    console.error("[api/geo/lgas/[id]/wards] Error:", err);
    return Response.json({ message: "Failed to load wards" }, { status: 500 });
  }
}

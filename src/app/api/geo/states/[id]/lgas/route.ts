import { ensureDbInitialized, getDb } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/geo/states/{id}/lgas
 * List LGAs for a given state.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const sql = getDb();
  const { id } = await params;
  const stateId = parseInt(id, 10);
  if (!stateId || isNaN(stateId)) {
    return Response.json({ message: "Invalid state ID" }, { status: 400 });
  }
  try {
    const rows = (await sql`
      SELECT l.id, l.name, l.code, l.state_id, l.portal_id
      FROM lgas l
      WHERE l.state_id = ${stateId}
      ORDER BY l.name
    `) as unknown as any[];
    return Response.json({ lgas: rows, total: rows.length });
  } catch (err: any) {
    console.error("[api/geo/states/[id]/lgas] Error:", err);
    return Response.json({ message: "Failed to load LGAs" }, { status: 500 });
  }
}

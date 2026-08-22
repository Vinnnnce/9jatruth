import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/politics/events?status=all
 * Super-admin list of ALL political events (including pending/flagged/rejected).
 * Public /api/politics/events only returns approved events.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
  const sql = getDb();
  const rows = (await sql`
    SELECT e.*, c.name AS candidate_name
    FROM political_events e
    LEFT JOIN political_candidates c ON e.candidate_id = c.id
    WHERE ${status === "all"}::boolean OR e.status = ${status}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `) as unknown as any[];
  return Response.json({ events: rows });
}

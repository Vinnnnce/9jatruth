import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Admin: Elections & Timetable management.
 * POST /api/admin/politics/elections — Create election
 * POST /api/admin/politics/elections/[id]/timetable — Create/update timetable
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const schema = z.object({
    year: z.number().int().min(1990).max(2100),
    name: z.string().min(2).max(200),
    type: z.string().default("general"),
    geo_scope: z.string().default("national"),
    election_date: z.string().optional(),
    status: z.string().default("upcoming"),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid election data", errors: parsed.error.flatten() }, { status: 400 });

  const sql = getDb();
  const result = ((await sql`
    INSERT INTO political_elections (year, name, type, geo_scope, election_date, status)
    VALUES (${parsed.data.year}, ${parsed.data.name}, ${parsed.data.type}, ${parsed.data.geo_scope}, ${parsed.data.election_date || null}, ${parsed.data.status})
    ON CONFLICT (year, type, geo_scope) DO UPDATE SET name = EXCLUDED.name, election_date = EXCLUDED.election_date, status = EXCLUDED.status
    RETURNING *
  `) as unknown as any[])[0];
  return Response.json({ election: result });
}

/**
 * GET /api/admin/politics/elections — List all elections for admin
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const sql = getDb();
  const rows = (await sql`
    SELECT e.*, tt.id AS timetable_id,
           CASE WHEN tt.id IS NOT NULL THEN true ELSE false END AS has_timetable,
           (SELECT COUNT(*) FROM election_events ev WHERE ev.election_id = e.id) AS event_count,
           (SELECT COUNT(*) FROM election_results r WHERE r.election_id = e.id) AS result_count
    FROM political_elections e
    LEFT JOIN election_timetable tt ON tt.election_id = e.id
    ORDER BY e.year DESC
  `) as unknown as any[];
  return Response.json({ elections: rows, total: rows.length });
}

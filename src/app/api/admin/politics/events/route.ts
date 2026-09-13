import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Admin: Election Events management.
 * POST /api/admin/politics/events — Create event
 * PUT  /api/admin/politics/events/[id] — Update event
 * POST /api/admin/politics/events/[id]/status — Update status
 *
 * GET  /api/admin/politics/events?election_id=X — List events for admin
 */
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  timetable_id: z.number().int().positive(),
  election_id: z.number().int().positive(),
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  event_type: z.enum(["voter_registration", "party_primaries", "campaign_period", "election_day", "collation", "result_announcement", "voter_verification", "party_registration"]),
  geo_scope: z.string().default("national"),
  state_id: z.number().int().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_order: z.number().int().default(99),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
  source_url: z.string().url().optional().or(z.literal("")),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("election_id");
  const rows = (await sql`
    SELECT ev.*, s.name AS state_name, tt.title AS timetable_title
    FROM election_events ev
    LEFT JOIN states s ON s.id = ev.state_id
    LEFT JOIN election_timetable tt ON tt.id = ev.timetable_id
    WHERE (${electionId ?? null}::int IS NULL OR ev.election_id = ${electionId ?? null}::int)
    ORDER BY ev.sort_order, ev.start_date
  `) as unknown as any[];
  return Response.json({ events: rows, total: rows.length });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid event data", errors: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const sql = getDb();
  const result = ((await sql`
    INSERT INTO election_events (timetable_id, election_id, name, description, event_type, geo_scope, state_id, start_date, end_date, sort_order, status, notes, source_url)
    VALUES (${d.timetable_id}, ${d.election_id}, ${d.name}, ${d.description || null}, ${d.event_type}, ${d.geo_scope}, ${d.state_id || null}, ${d.start_date || null}, ${d.end_date || null}, ${d.sort_order}, ${d.status}, ${d.notes || null}, ${d.source_url || null})
    RETURNING *
  `) as unknown as any[])[0];
  return Response.json({ event: result });
}

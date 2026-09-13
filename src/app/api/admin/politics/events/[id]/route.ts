import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Admin: Update or delete an election event.
 * PUT  /api/admin/politics/events/[id] — Update event
 * DELETE /api/admin/politics/events/[id] — Delete event
 */
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  event_type: z.enum(["voter_registration", "party_primaries", "campaign_period", "election_day", "collation", "result_announcement", "voter_verification", "party_registration"]).optional(),
  geo_scope: z.string().optional(),
  state_id: z.number().int().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_order: z.number().int().optional(),
  status: z.enum(["scheduled", "ongoing", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
  source_url: z.string().url().optional().or(z.literal("")).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const eventId = parseInt(id, 10);
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid event data", errors: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const sql = getDb();
  const result = ((await sql`
    UPDATE election_events SET
      name = COALESCE(${d.name ?? null}, name),
      description = COALESCE(${d.description ?? null}, description),
      event_type = COALESCE(${d.event_type ?? null}, event_type),
      geo_scope = COALESCE(${d.geo_scope ?? null}, geo_scope),
      state_id = COALESCE(${d.state_id ?? null}, state_id),
      start_date = COALESCE(${d.start_date ?? null}, start_date),
      end_date = COALESCE(${d.end_date ?? null}, end_date),
      sort_order = COALESCE(${d.sort_order ?? null}, sort_order),
      status = COALESCE(${d.status ?? null}, status),
      notes = COALESCE(${d.notes ?? null}, notes),
      source_url = COALESCE(${d.source_url ?? null}, source_url),
      updated_at = NOW()
    WHERE id = ${eventId}
    RETURNING *
  `) as unknown as any[])[0];
  if (!result) return Response.json({ message: "Event not found" }, { status: 404 });
  return Response.json({ event: result });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const eventId = parseInt(id, 10);
  const sql = getDb();
  await sql`DELETE FROM election_events WHERE id = ${eventId}`;
  return Response.json({ success: true });
}

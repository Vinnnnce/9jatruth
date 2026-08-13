import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  entityType: z.string().max(100).optional(),
  actorId: z.string().max(200).optional(),
  action: z.string().max(100).optional(),
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
});

/**
 * GET /api/admin/audit — list audit logs (admin dashboard)
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 100;
  const offset = parsed.success ? parsed.data.offset : 0;
  const { entityType, actorId, action, startDate, endDate } = parsed.success ? parsed.data : {} as any;

  const sql = getDb();

  const conditions: string[] = [];
  const params: any[] = [];
  if (entityType) {
    params.push(entityType);
    conditions.push(`entity_type = $${params.length}`);
  }
  if (actorId) {
    params.push(actorId);
    conditions.push(`actor_id = $${params.length}`);
  }
  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`created_at <= $${params.length}::timestamptz`);
  }

  params.push(limit);
  const limitIdx = `$${params.length}`;
  params.push(offset);
  const offsetIdx = `$${params.length}`;

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
    params
  )) as unknown as any[];

  return Response.json({
    logs: rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      description: r.description,
      oldValues: r.old_values,
      newValues: r.new_values,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    })),
    limit,
    offset,
  });
}

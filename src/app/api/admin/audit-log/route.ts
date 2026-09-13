import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * GET /api/admin/audit
 *
 * Returns audit log entries with pagination and optional filtering.
 * Super admin only.
 */
const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  action: z.string().max(50).optional(),
  targetType: z.string().max(30).optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();

  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      { message: "Invalid query parameters", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { limit, offset, action, targetType } = parsed.data;
  const sql = getDb();

  const conditions: string[] = [];
  const params: any[] = [];

  if (action) {
    params.push(action);
    conditions.push(`action = $${params.length}`);
  }
  if (targetType) {
    params.push(targetType);
    conditions.push(`target_type = $${params.length}`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countParams = params.slice(0, conditions.length);
  const countRows = (await sql.query(
    `SELECT COUNT(*) as total FROM audit_log ${where}`,
    countParams
  )) as unknown as { total: number }[];

  const total = countRows[0]?.total ?? 0;

  const fetchParams = [...params, limit, offset];
  const rows = (await sql.query(
    `SELECT id, admin_clerk_id, action, target_type, target_id, target_email,
            reason, metadata, created_at
     FROM audit_log ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    fetchParams
  )) as unknown as any[];

  return Response.json({
    entries: rows,
    total,
    limit,
    offset,
  });
}

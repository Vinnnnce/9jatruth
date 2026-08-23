import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/news/errors
 * Super-admin: lists failed news publish attempts (news_publish_errors table).
 * Filters: agency_id, code, limit, offset.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get("agency_id");
  const code = searchParams.get("code");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const sql = getDb();
  const rows = (await sql`
    SELECT e.*, o.name AS agency_name
    FROM news_publish_errors e
    LEFT JOIN organizations o ON o.id = e.agency_id
    WHERE (${agencyId ?? null}::int IS NULL OR e.agency_id = ${agencyId ?? null}::int)
      AND (${code ?? null}::text IS NULL OR e.error_code = ${code ?? null})
    ORDER BY e.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`) as any;

  const countRow = (await sql`
    SELECT COUNT(*)::int AS total FROM news_publish_errors e
    WHERE (${agencyId ?? null}::int IS NULL OR e.agency_id = ${agencyId ?? null}::int)
      AND (${code ?? null}::text IS NULL OR e.error_code = ${code ?? null})`) as any;

  return Response.json({ errors: rows ?? [], total: countRow?.[0]?.total ?? 0 });
}

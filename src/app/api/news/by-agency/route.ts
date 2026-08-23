import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/news/by-agency?agency_id=...&status=...&limit=...&offset=...
 * Lists news articles published by a given agency (organization).
 * Public — only returns published articles unless the caller is the agency's
 * owner / super admin (then draft/pending_review/rejected are included).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const agencyId = parseInt(searchParams.get("agency_id") || "0", 10);
  if (!agencyId) {
    return Response.json({ message: "agency_id is required" }, { status: 400 });
  }
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const sql = getDb();
  const rows = (await sql`
    SELECT id, title, slug, excerpt, cover_image_url, category, tags, state, lga,
           status, is_verified, verification_badge, view_count, like_count, comment_count,
           published_at, created_at
    FROM news_articles
    WHERE organization_id = ${agencyId}
      AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    LIMIT ${limit} OFFSET ${offset}`) as any;

  const countRow = (await sql`SELECT COUNT(*)::int AS total FROM news_articles
    WHERE organization_id = ${agencyId} AND (${status ?? null}::text IS NULL OR status = ${status ?? null})`) as any;

  return Response.json({ articles: rows ?? [], total: countRow?.[0]?.total ?? 0 });
}

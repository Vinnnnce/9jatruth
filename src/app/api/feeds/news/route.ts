import { ensureDbInitialized, getDb } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/feeds/news — External news items for the Feeds → News section
 *
 * Returns news articles from the news_external table (fetched from NewsAPI),
 * with pagination, loading states, and optional category filtering.
 *
 * Query params:
 *   - limit  (default 20, max 100)
 *   - offset (default 0)
 *   - category (optional)
 *   - search (optional: ILIKE on title + description)
 */

const newsSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();

  const { searchParams } = new URL(request.url);
  const parsed = newsSchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      { message: "Invalid query parameters", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { limit, offset, category, search } = parsed.data;
  const sql = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const searchIdx = params.length;
    conditions.push(
      `(title ILIKE $${searchIdx} OR description ILIKE $${searchIdx})`
    );
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    // Count total matching rows
    const countParams = params.slice(0, conditions.length);
    const countRows = (await sql.query(
      `SELECT COUNT(*) as total FROM news_external ${where}`,
      countParams
    )) as unknown as { total: number }[];

    const total = countRows[0]?.total ?? 0;

    // Fetch paginated rows
    const fetchParams = [...params, limit, offset];
    const rows = (await sql.query(
      `SELECT
         id,
         source_name,
         title,
         description,
         url,
         image_url,
         published_at,
         category,
         created_at
       FROM news_external ${where}
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      fetchParams
    )) as unknown as any[];

    return Response.json({
      articles: rows.map((r) => ({
        id: r.id,
        source: r.source_name,
        title: r.title,
        description: r.description,
        url: r.url,
        imageUrl: r.image_url,
        publishedAt: r.published_at,
        category: r.category,
        createdAt: r.created_at,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (err: any) {
    console.error("[feeds/news] Error:", err);
    return Response.json(
      {
        articles: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
        message: "Failed to load news. Please try again later.",
      },
      { status: 200 } // Return 200 with empty array for graceful degradation
    );
  }
}

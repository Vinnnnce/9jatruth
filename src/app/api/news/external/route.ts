import { ensureDbInitialized, getDb } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

/**
 * GET /api/news/external — list external news articles
 *
 * Query params:
 *   - limit  (default 20, max 100)
 *   - offset (default 0)
 *   - category (optional: business, entertainment, general, health, science, sports, technology)
 *   - search  (optional: case-insensitive ILIKE on title + description)
 *
 * Returns: { articles: [...], total: N, limit, offset }
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const { searchParams } = new URL(request.url);
  const parsed = listSchema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      {
        message: "Invalid query parameters",
        errors: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const { limit, offset, category, search } = parsed.data;
  const sql = getDb();

  // Build conditions dynamically
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
       author,
       title,
       description,
       content,
       url,
       image_url,
       published_at,
       category,
       created_at,
       is_audio_generated,
       audio_url
     FROM news_external
     ${where}
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $${fetchParams.length - 1}
     OFFSET $${fetchParams.length}`,
    fetchParams
  )) as unknown as Record<string, unknown>[];

  return Response.json({
    articles: rows,
    total,
    limit,
    offset,
  });
}

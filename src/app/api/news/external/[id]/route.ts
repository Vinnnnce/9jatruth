import { ensureDbInitialized, getDb } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * GET /api/news/external/[id] — get a single external news article by id
 *
 * Returns: { article: {...} }
 * 404 if not found.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const resolvedParams = await params;
  const parsed = idParamSchema.safeParse(resolvedParams);

  if (!parsed.success) {
    return Response.json(
      { message: "Invalid article ID" },
      { status: 400 }
    );
  }

  const sql = getDb();
  const id = parsed.data.id;

  const rows = (await sql`
    SELECT
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
    WHERE id = ${id}
    LIMIT 1
  `) as unknown as Record<string, unknown>[];

  if (rows.length === 0) {
    return Response.json(
      { message: "Article not found" },
      { status: 404 }
    );
  }

  return Response.json({ article: rows[0] });
}

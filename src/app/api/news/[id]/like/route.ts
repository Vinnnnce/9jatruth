import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/news/[id]/like — toggle like on article
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const articleId = parseInt(id, 10);
  if (isNaN(articleId)) return Response.json({ message: "Invalid article id" }, { status: 400 });

  const userHash = await getUserId(request);
  const sql = getDb();

  // Verify article exists
  const article = (await sql`SELECT id FROM news_articles WHERE id = ${articleId}`) as unknown as any[];
  if (article.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  // Toggle like: insert, if conflict then delete (toggle off)
  const existing = (await sql`
    SELECT id FROM news_likes WHERE article_id = ${articleId} AND user_hash = ${userHash}
  `) as unknown as any[];

  let liked: boolean;
  if (existing.length > 0) {
    // Unlike
    await sql`DELETE FROM news_likes WHERE article_id = ${articleId} AND user_hash = ${userHash}`;
    await sql`UPDATE news_articles SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${articleId}`;
    liked = false;
  } else {
    // Like
    await sql`
      INSERT INTO news_likes (article_id, user_hash)
      VALUES (${articleId}, ${userHash})
      ON CONFLICT (article_id, user_hash) DO NOTHING
    `;
    await sql`UPDATE news_articles SET like_count = like_count + 1 WHERE id = ${articleId}`;
    liked = true;
  }

  const count = (await sql`SELECT like_count FROM news_articles WHERE id = ${articleId}`) as unknown as any[];

  return Response.json({ liked, likeCount: count[0]?.like_count ?? 0 });
}

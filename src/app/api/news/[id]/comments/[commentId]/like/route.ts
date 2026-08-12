import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/news/[id]/comments/[commentId]/like — toggle like on comment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id, commentId } = await params;
  const articleId = parseInt(id, 10);
  const cId = parseInt(commentId, 10);
  if (isNaN(articleId) || isNaN(cId)) {
    return Response.json({ message: "Invalid id" }, { status: 400 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  // Verify comment exists
  const comment = (await sql`
    SELECT id FROM news_comments WHERE id = ${cId} AND article_id = ${articleId}
  `) as unknown as any[];
  if (comment.length === 0) {
    return Response.json({ message: "Comment not found" }, { status: 404 });
  }

  // Toggle like
  const existing = (await sql`
    SELECT id FROM comment_likes WHERE comment_id = ${cId} AND user_hash = ${userHash}
  `) as unknown as any[];

  let liked: boolean;
  if (existing.length > 0) {
    // Unlike
    await sql`DELETE FROM comment_likes WHERE comment_id = ${cId} AND user_hash = ${userHash}`;
    await sql`UPDATE news_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${cId}`;
    liked = false;
  } else {
    // Like
    await sql`
      INSERT INTO comment_likes (comment_id, user_hash, article_id)
      VALUES (${cId}, ${userHash}, ${articleId})
      ON CONFLICT (comment_id, user_hash) DO NOTHING
    `;
    await sql`UPDATE news_comments SET like_count = like_count + 1 WHERE id = ${cId}`;
    liked = true;
  }

  const count = (await sql`SELECT like_count FROM news_comments WHERE id = ${cId}`) as unknown as any[];

  return Response.json({ liked, likeCount: count[0]?.like_count ?? 0 });
}

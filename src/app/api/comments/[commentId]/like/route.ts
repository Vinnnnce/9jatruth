import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/comments/[commentId]/like — toggle like on a comment
 * Returns the new like count
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { commentId } = await params;
  const cId = parseInt(commentId, 10);
  if (isNaN(cId)) return Response.json({ message: "Invalid comment id" }, { status: 400 });

  const userHash = await getUserId(request);
  const sql = getDb();

  // Verify comment exists
  const comment = (await sql`
    SELECT id, article_id FROM news_comments WHERE id = ${cId}
  `) as unknown as any[];

  if (comment.length === 0) {
    return Response.json({ message: "Comment not found" }, { status: 404 });
  }

  const articleId = comment[0].article_id;

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

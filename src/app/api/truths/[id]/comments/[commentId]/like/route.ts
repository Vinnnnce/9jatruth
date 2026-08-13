import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/truths/[id]/comments/[commentId]/like — Toggle like on a feed comment
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
  const truthId = parseInt(id, 10);
  const cId = parseInt(commentId, 10);
  if (isNaN(truthId) || isNaN(cId)) {
    return Response.json({ message: "Invalid parameters" }, { status: 400 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  // Check if already liked
  const existing = (await sql`
    SELECT id FROM feed_comment_likes WHERE comment_id = ${cId} AND user_hash = ${userHash}
  `) as unknown as any[];

  if (existing.length > 0) {
    // Unlike
    await sql`DELETE FROM feed_comment_likes WHERE comment_id = ${cId} AND user_hash = ${userHash}`;
    await sql`UPDATE feed_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ${cId}`;
    const rows = (await sql`SELECT like_count FROM feed_comments WHERE id = ${cId}`) as unknown as any[];
    return Response.json({ liked: false, likeCount: rows[0]?.like_count ?? 0 });
  } else {
    // Like
    await sql`
      INSERT INTO feed_comment_likes (comment_id, user_hash) VALUES (${cId}, ${userHash})
      ON CONFLICT (comment_id, user_hash) DO NOTHING
    `;
    await sql`UPDATE feed_comments SET like_count = like_count + 1 WHERE id = ${cId}`;
    const rows = (await sql`SELECT like_count FROM feed_comments WHERE id = ${cId}`) as unknown as any[];
    return Response.json({ liked: true, likeCount: rows[0]?.like_count ?? 1 }, { status: 201 });
  }
}

import { ensureDbInitialized, getDb } from "@/lib/db";
import { validate } from "@/lib/api-helpers";
import { z } from "zod";

const idParamSchema = z.object({
  commentId: z.coerce.number().int().positive().max(1_000_000),
});

const listSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/comments/[commentId]/replies — list replies to a comment
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  await ensureDbInitialized();

  const { commentId } = await params;
  const parsed = validate(idParamSchema, { commentId });
  if (!parsed.success) {
    return Response.json({ message: "Invalid comment id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const queryParsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = queryParsed.success ? queryParsed.data.limit : 50;
  const offset = queryParsed.success ? queryParsed.data.offset : 0;

  const sql = getDb();

  // Verify parent comment exists
  const parent = (await sql`
    SELECT id, article_id FROM news_comments WHERE id = ${parsed.data.commentId}
  `) as unknown as any[];

  if (parent.length === 0) {
    return Response.json({ message: "Comment not found" }, { status: 404 });
  }

  const rows = (await sql`
    SELECT id, article_id, user_hash, author_name, author_avatar, content,
           image_url, sticker_id, gift_id, parent_comment_id,
           like_count, reply_count, status, created_at, updated_at
    FROM news_comments
    WHERE parent_comment_id = ${parsed.data.commentId} AND status = 'active'
    ORDER BY created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as any[];

  return Response.json({
    replies: rows.map((r) => ({
      id: r.id,
      articleId: r.article_id,
      userHash: r.user_hash,
      authorName: r.author_name,
      authorAvatar: r.author_avatar,
      content: r.content,
      imageUrl: r.image_url,
      stickerId: r.sticker_id,
      giftId: r.gift_id,
      parentCommentId: r.parent_comment_id,
      likeCount: r.like_count,
      replyCount: r.reply_count,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    parentCommentId: parsed.data.commentId,
    limit,
    offset,
  });
}

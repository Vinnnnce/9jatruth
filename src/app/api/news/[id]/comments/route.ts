import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

/**
 * GET /api/news/[id]/comments — list comments with like counts
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const sql = getDb();

  // Verify article exists
  const article = (await sql`SELECT id FROM news_articles WHERE id = ${parsed.data.id}`) as unknown as any[];
  if (article.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const rows = (await sql`
    SELECT id, article_id, user_hash, author_name, author_avatar, content,
           image_url, sticker_id, gift_id, parent_comment_id,
           like_count, reply_count, status, created_at, updated_at
    FROM news_comments
    WHERE article_id = ${parsed.data.id} AND status = 'active'
    ORDER BY created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as any[];

  return Response.json({
    comments: rows.map((r) => ({
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
  });
}

const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  imageUrl: z.string().url().max(1000).optional(),
  stickerId: z.string().max(100).optional(),
  giftId: z.string().max(100).optional(),
  parentCommentId: z.number().int().positive().max(1_000_000).optional(),
});

/**
 * POST /api/news/[id]/comments — create comment with rich content
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
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = validate(createCommentSchema, body);
  if (!parsedBody.success) return validationErrorResponse(parsedBody.error);
  const data = parsedBody.data;

  const sql = getDb();

  // Verify article exists
  const article = (await sql`SELECT id FROM news_articles WHERE id = ${parsed.data.id}`) as unknown as any[];
  if (article.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const userHash = await getUserId(request);
  const content = sanitizeText(data.content);
  if (!content || content.length < 1) {
    return Response.json({ message: "Comment content required" }, { status: 400 });
  }

  // Resolve author name/avatar from Clerk
  let authorName = "User";
  let authorAvatar: string | null = null;
  try {
    const user = await currentUser();
    if (user) {
      authorName = user.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user.username || user.emailAddresses?.[0]?.emailAddress || "User";
      authorAvatar = user.imageUrl || null;
    }
  } catch {
    // Non-critical
  }

  // Verify parent comment if provided
  if (data.parentCommentId) {
    const parent = (await sql`
      SELECT id FROM news_comments
      WHERE id = ${data.parentCommentId} AND article_id = ${parsed.data.id}
    `) as unknown as any[];
    if (parent.length === 0) {
      return Response.json({ message: "Parent comment not found" }, { status: 400 });
    }
  }

  const rows = (await sql`
    INSERT INTO news_comments (
      article_id, user_hash, author_name, author_avatar, content,
      image_url, sticker_id, gift_id, parent_comment_id, status
    ) VALUES (
      ${parsed.data.id}, ${userHash}, ${authorName}, ${authorAvatar}, ${content},
      ${data.imageUrl || null}, ${data.stickerId || null}, ${data.giftId || null},
      ${data.parentCommentId || null}, 'active'
    )
    RETURNING *
  `) as unknown as any[];

  // Update comment count on article
  await sql`UPDATE news_articles SET comment_count = comment_count + 1 WHERE id = ${parsed.data.id}`;

  // If reply, increment parent reply_count
  if (data.parentCommentId) {
    await sql`UPDATE news_comments SET reply_count = reply_count + 1 WHERE id = ${data.parentCommentId}`;
  }

  const r = rows[0];
  return Response.json(
    {
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
    },
    { status: 201 }
  );
}

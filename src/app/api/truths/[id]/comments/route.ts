import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, sanitizeText, validate, validationErrorResponse } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * GET /api/truths/[id]/comments — List comments for a truth with like counts
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const sql = getDb();
  const rows = (await sql`
    SELECT c.id, c.truth_id, c.user_hash, c.content, c.image_url, c.sticker_id, c.gift_id,
           c.parent_comment_id, c.like_count, c.reply_count, c.status, c.created_at, c.updated_at,
           u.display_name, u.username
    FROM feed_comments c
    LEFT JOIN platform_users u ON c.user_hash = u.user_hash
    WHERE c.truth_id = ${truthId} AND c.status = 'active'
    ORDER BY c.created_at ASC
    LIMIT 100
  `) as unknown as any[];

  return Response.json(rows.map((r) => ({
    id: r.id,
    truthId: r.truth_id,
    userHash: r.user_hash,
    displayName: r.display_name || r.username || null,
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
  })));
}

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional().or(z.literal("")),
  stickerId: z.string().max(100).optional(),
  giftId: z.string().max(100).optional(),
  parentCommentId: z.number().int().positive().optional(),
});

/**
 * POST /api/truths/[id]/comments — Add a rich comment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const body = await request.json();
  const parsed = validate(commentSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userHash = await getUserId(request);
  const content = sanitizeText(parsed.data.content);
  if (!content || content.length < 1) {
    return Response.json({ message: "Comment content required" }, { status: 400 });
  }

  const sql = getDb();

  // If replying, increment parent's reply count
  if (parsed.data.parentCommentId) {
    await sql`UPDATE feed_comments SET reply_count = reply_count + 1 WHERE id = ${parsed.data.parentCommentId}`;
  }

  const rows = (await sql`
    INSERT INTO feed_comments (truth_id, user_hash, content, image_url, sticker_id, gift_id, parent_comment_id, like_count, reply_count, status, created_at, updated_at)
    VALUES (${truthId}, ${userHash}, ${content}, ${parsed.data.imageUrl || null}, ${parsed.data.stickerId || null}, ${parsed.data.giftId || null}, ${parsed.data.parentCommentId || null}, 0, 0, 'active', NOW(), NOW())
    RETURNING id, truth_id, user_hash, content, image_url, sticker_id, gift_id, parent_comment_id, like_count, reply_count, status, created_at, updated_at
  `) as unknown as any[];

  const r = rows[0];
  return Response.json({
    id: r.id,
    truthId: r.truth_id,
    userHash: r.user_hash,
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
  }, { status: 201 });
}

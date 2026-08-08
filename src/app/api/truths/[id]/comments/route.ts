import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, sanitizeText, validate, validationErrorResponse } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * GET /api/truths/[id]/comments — List comments for a truth
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
    SELECT id, truth_id, user_hash, content, parent_comment_id, status, created_at, updated_at
    FROM feed_comments
    WHERE truth_id = ${truthId} AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 100
  `) as unknown as any[];

  return Response.json(rows.map((r) => ({
    id: r.id,
    truthId: r.truth_id,
    userHash: r.user_hash,
    content: r.content,
    parentCommentId: r.parent_comment_id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
}

const commentSchema = z.object({
  content: z.string().min(1).max(500),
  parentCommentId: z.number().int().positive().optional(),
});

/**
 * POST /api/truths/[id]/comments — Add a comment
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
  const rows = (await sql`
    INSERT INTO feed_comments (truth_id, user_hash, content, parent_comment_id, status, created_at, updated_at)
    VALUES (${truthId}, ${userHash}, ${content}, ${parsed.data.parentCommentId || null}, 'active', NOW(), NOW())
    RETURNING id, truth_id, user_hash, content, parent_comment_id, status, created_at, updated_at
  `) as unknown as any[];

  return Response.json({
    id: rows[0].id,
    truthId: rows[0].truth_id,
    userHash: rows[0].user_hash,
    content: rows[0].content,
    parentCommentId: rows[0].parent_comment_id,
    status: rows[0].status,
    createdAt: rows[0].created_at,
    updatedAt: rows[0].updated_at,
  }, { status: 201 });
}

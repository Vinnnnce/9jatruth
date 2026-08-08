import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const upvoteSchema = z.object({
  feedbackId: z.coerce.number().int().positive(),
});

/**
 * POST /api/feedback/[id]/upvote
 * Upvotes a feedback entry. Toggles the upvote if already upvoted.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const feedbackId = parseInt(id, 10);
  if (isNaN(feedbackId) || feedbackId < 1) {
    return Response.json({ message: "Invalid feedback ID" }, { status: 400 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    // Check if already upvoted
    const existing = (await sql`
      SELECT id FROM feedback_upvotes WHERE feedback_id = ${feedbackId} AND user_hash = ${userHash} LIMIT 1
    `) as unknown as any[];

    if (existing.length > 0) {
      // Remove upvote (toggle off)
      await sql`DELETE FROM feedback_upvotes WHERE feedback_id = ${feedbackId} AND user_hash = ${userHash}`;
      await sql`UPDATE user_feedback SET upvotes = GREATEST(0, upvotes - 1) WHERE id = ${feedbackId}`;
      return Response.json({ upvoted: false, upvotes: 0 });
    }

    // Add upvote
    await sql`
      INSERT INTO feedback_upvotes (feedback_id, user_hash)
      VALUES (${feedbackId}, ${userHash})
    `;
    await sql`UPDATE user_feedback SET upvotes = upvotes + 1 WHERE id = ${feedbackId}`;

    const countRows = (await sql`SELECT upvotes FROM user_feedback WHERE id = ${feedbackId}`) as unknown as any[];
    return Response.json({ upvoted: true, upvotes: countRows[0]?.upvotes || 1 });
  } catch (err) {
    console.error("[Feedback] Upvote error:", err);
    return Response.json({ message: "Failed to upvote" }, { status: 500 });
  }
}

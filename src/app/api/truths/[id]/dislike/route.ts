import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

const clampTrust = (n: number) => Math.max(0, Math.min(100, n));

async function applyTrustDelta(sql: any, truthId: number, delta: number): Promise<number> {
  const rows = (await sql`SELECT trust_score::int AS t FROM micro_truths WHERE id = ${truthId} AND deleted_at IS NULL LIMIT 1`) as unknown as any[];
  if (!rows.length) return 50;
  const next = clampTrust(Number(rows[0].t ?? 50) + delta);
  await sql`UPDATE micro_truths SET trust_score = ${next} WHERE id = ${truthId}`;
  return next;
}

/**
 * POST /api/truths/[id]/dislike — Dislike a truth.
 * Disliking reduces the post's trust count (-1) and removes any like.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized — Please sign in to dislike a post" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    // Remove any existing like (mutual exclusion) then record the dislike.
    await sql`DELETE FROM feed_likes WHERE truth_id = ${truthId} AND user_hash = ${userHash}`;
    await sql`
      INSERT INTO feed_dislikes (truth_id, user_hash)
      VALUES (${truthId}, ${userHash})
      ON CONFLICT (truth_id, user_hash) DO NOTHING
    `;
    // Dislike → trust down.
    const trustScore = await applyTrustDelta(sql, truthId, -1);

    const count = (await sql`SELECT COUNT(*)::int AS count FROM feed_dislikes WHERE truth_id = ${truthId}`) as unknown as any[];
    const likeCount = (await sql`SELECT COUNT(*)::int AS count FROM feed_likes WHERE truth_id = ${truthId}`) as unknown as any[];
    return Response.json({
      disliked: true,
      dislikeCount: Number(count[0].count),
      likeCount: Number(likeCount[0].count),
      trustScore,
    });
  } catch (err) {
    return Response.json({ message: "Failed to dislike" }, { status: 500 });
  }
}

/**
 * DELETE /api/truths/[id]/dislike — Remove a dislike (reverses the trust reduction).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const userHash = await getUserId(request);
  const sql = getDb();

  const removed = (await sql`DELETE FROM feed_dislikes WHERE truth_id = ${truthId} AND user_hash = ${userHash} RETURNING id`) as unknown as any[];
  let trustScore: number | undefined;
  if (removed.length > 0) {
    trustScore = await applyTrustDelta(sql, truthId, 1);
  }
  const count = (await sql`SELECT COUNT(*)::int AS count FROM feed_dislikes WHERE truth_id = ${truthId}`) as unknown as any[];
  return Response.json({ disliked: false, dislikeCount: Number(count[0].count), trustScore });
}

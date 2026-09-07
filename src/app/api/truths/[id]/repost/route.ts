import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/truths/[id]/repost — Repost a truth to your audience.
 * Idempotent: re-reposting just removes the existing repost (toggle).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized — Please sign in to repost" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const userHash = await getUserId(request);
  const sql = getDb();

  // Can't repost your own post.
  const truth = (await sql`SELECT user_hash FROM micro_truths WHERE id = ${truthId} AND deleted_at IS NULL LIMIT 1`) as unknown as any[];
  if (!truth.length) return Response.json({ message: "Truth not found" }, { status: 404 });
  if (truth[0].user_hash === userHash) {
    return Response.json({ message: "You cannot repost your own post" }, { status: 400 });
  }

  // Toggle: if already reposted, undo; otherwise create.
  const existing = (await sql`SELECT id FROM feed_reposts WHERE truth_id = ${truthId} AND user_hash = ${userHash} LIMIT 1`) as unknown as any[];
  if (existing.length > 0) {
    await sql`DELETE FROM feed_reposts WHERE truth_id = ${truthId} AND user_hash = ${userHash}`;
    const count = (await sql`SELECT COUNT(*)::int AS count FROM feed_reposts WHERE truth_id = ${truthId}`) as unknown as any[];
    return Response.json({ reposted: false, repostCount: Number(count[0].count) });
  }

  await sql`
    INSERT INTO feed_reposts (truth_id, user_hash)
    VALUES (${truthId}, ${userHash})
    ON CONFLICT (truth_id, user_hash) DO NOTHING
  `;
  const count = (await sql`SELECT COUNT(*)::int AS count FROM feed_reposts WHERE truth_id = ${truthId}`) as unknown as any[];
  return Response.json({ reposted: true, repostCount: Number(count[0].count) });
}

import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, sanitizeText } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/truths/[id]/like — Like a truth
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

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    await sql`
      INSERT INTO feed_likes (truth_id, user_hash)
      VALUES (${truthId}, ${userHash})
      ON CONFLICT (truth_id, user_hash) DO NOTHING
    `;
    const count = (await sql`SELECT COUNT(*) as count FROM feed_likes WHERE truth_id = ${truthId}`) as unknown as any[];
    return Response.json({ liked: true, likeCount: Number(count[0].count) });
  } catch (err) {
    return Response.json({ message: "Failed to like" }, { status: 500 });
  }
}

/**
 * DELETE /api/truths/[id]/like — Unlike a truth
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

  await sql`DELETE FROM feed_likes WHERE truth_id = ${truthId} AND user_hash = ${userHash}`;
  const count = (await sql`SELECT COUNT(*) as count FROM feed_likes WHERE truth_id = ${truthId}`) as unknown as any[];
  return Response.json({ liked: false, likeCount: Number(count[0].count) });
}

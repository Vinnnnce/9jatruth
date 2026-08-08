import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * POST /api/truths/[id]/share — Record a share event
 * Does not require auth (ghost users can share), but userHash is null if not signed in
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const channel = body.channel || "copy";

  // Try to get user hash if signed in (optional for shares)
  const clerkUserId = await getClerkUserId();
  const userHash = clerkUserId ? await getUserId(request) : null;

  const sql = getDb();
  await sql`
    INSERT INTO feed_shares (truth_id, user_hash, channel)
    VALUES (${truthId}, ${userHash}, ${channel})
  `;

  const count = (await sql`SELECT COUNT(*) as count FROM feed_shares WHERE truth_id = ${truthId}`) as unknown as any[];
  return Response.json({ shared: true, shareCount: Number(count[0].count) });
}

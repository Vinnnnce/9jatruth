import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/users/[userHash]/subscribe — Subscribe to a user
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userHash: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { userHash: targetHash } = await params;
  if (!targetHash) return Response.json({ message: "Invalid user" }, { status: 400 });

  const subscriberHash = await getUserId(request);

  if (subscriberHash === targetHash) {
    return Response.json({ message: "Cannot subscribe to yourself" }, { status: 400 });
  }

  const sql = getDb();
  await sql`
    INSERT INTO user_subscriptions (subscriber_hash, target_hash)
    VALUES (${subscriberHash}, ${targetHash})
    ON CONFLICT (subscriber_hash, target_hash) DO NOTHING
  `;

  const count = (await sql`SELECT COUNT(*) as count FROM user_subscriptions WHERE target_hash = ${targetHash}`) as unknown as any[];
  return Response.json({ subscribed: true, subscriberCount: Number(count[0].count) });
}

/**
 * DELETE /api/users/[userHash]/subscribe — Unsubscribe from a user
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userHash: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { userHash: targetHash } = await params;
  const subscriberHash = await getUserId(request);
  const sql = getDb();

  await sql`DELETE FROM user_subscriptions WHERE subscriber_hash = ${subscriberHash} AND target_hash = ${targetHash}`;
  const count = (await sql`SELECT COUNT(*) as count FROM user_subscriptions WHERE target_hash = ${targetHash}`) as unknown as any[];
  return Response.json({ subscribed: false, subscriberCount: Number(count[0].count) });
}

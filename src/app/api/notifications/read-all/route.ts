import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";

/**
 * PATCH /api/notifications/read-all — Mark all notifications as read for the current user
 */
export async function PATCH(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userHash = await getUserId(request);
  const sql = getDb();

  await sql`
    UPDATE notifications SET read = 1
    WHERE user_hash = ${userHash} AND read = 0
  `;

  return Response.json({ success: true });
}

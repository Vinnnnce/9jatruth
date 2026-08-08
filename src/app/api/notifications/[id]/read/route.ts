import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";

/**
 * PATCH /api/notifications/[id]/read — Mark a single notification as read
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userHash = await getUserId(request);
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return Response.json({ message: "Invalid notification id" }, { status: 400 });
  }

  const sql = getDb();
  await sql`
    UPDATE notifications SET read = 1
    WHERE id = ${numericId} AND user_hash = ${userHash}
  `;

  return Response.json({ success: true });
}

import { ensureDbInitialized } from "@/lib/db";
import { getAdminStats, getPlatformUserByClerkId } from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";

/**
 * Platform-wide admin stats. Requires an authenticated Clerk user whose
 * platform_users record has is_admin = true.
 */
export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const platformUser = await getPlatformUserByClerkId(clerkUserId);
  if (!platformUser?.is_admin) {
    return Response.json({ message: "Forbidden — admin access required" }, { status: 403 });
  }
  const stats = await getAdminStats();
  return Response.json(stats);
}

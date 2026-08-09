import { ensureDbInitialized } from "@/lib/db";
import { getAdminStats, getPlatformUserByClerkId } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";

/**
 * Platform-wide admin stats. Requires the super admin email.
 */
export async function GET() {
  await ensureDbInitialized();

  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

  // In dev mode (Clerk not configured), allow access via SUPER_ADMIN_EMAIL env var
  if (isClerkConfigured) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
    }
  }

  try {
    const stats = await getAdminStats();
    return Response.json(stats);
  } catch (err) {
    console.error("[api/admin/stats] Error:", err);
    return Response.json({
      totalUsers: 0,
      totalOrganizations: 0,
      totalTruths: 0,
      totalRewards: 0,
      pendingOrganizations: 0,
      totalMembers: 0,
      openVacancies: 0,
      truthsByState: [],
      truthsByCategory: [],
      truthsByLga: [],
      truthsByCommunity: [],
      truthsByRegion: [],
    });
  }
}

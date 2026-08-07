import { ensureDbInitialized } from "@/lib/db";
import {
  getPlatformUserByClerkId,
  upsertPlatformUser,
  updatePlatformUserIpInfo,
  getOrganization,
} from "@/lib/neon-storage";
import { getClerkUserId, getIpLocation } from "@/lib/api-helpers";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Get the current user's platform profile. Falls back to Clerk user data
 * when no platform_users row exists yet (e.g. before the webhook runs).
 * Also tracks the user's IP and geo info for admin dashboard.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  let platformUser = await getPlatformUserByClerkId(clerkUserId);

  // If the webhook hasn't synced this user yet, create them on demand.
  if (!platformUser) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || user?.primaryEmailAddress?.emailAddress || "";
    platformUser = await upsertPlatformUser({
      clerkUserId,
      email,
      displayName: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user?.username || null),
      avatarUrl: user?.imageUrl || null,
    });
  }

  // Track IP and geo info for the admin dashboard
  try {
    const ipLocation = await getIpLocation(request);
    if (ipLocation.ipHash) {
      await updatePlatformUserIpInfo(clerkUserId, {
        ipHash: ipLocation.ipHash,
        ipRegion: ipLocation.ipRegion,
        ipCity: ipLocation.ipCity,
        state: ipLocation.ipRegion,
        region: ipLocation.ipRegion,
      });
      // Refresh the user object with updated IP info
      platformUser = await getPlatformUserByClerkId(clerkUserId);
    }
  } catch {
    // Non-critical — don't fail the profile request
  }

  let organization = null;
  if (platformUser?.organization_id) {
    organization = await getOrganization(platformUser.organization_id);
  }

  return Response.json({
    id: platformUser.id,
    clerkUserId: platformUser.clerk_user_id,
    email: platformUser.email,
    displayName: platformUser.display_name,
    avatarUrl: platformUser.avatar_url,
    role: platformUser.role,
    isAdmin: platformUser.is_admin,
    isOrgAdmin: platformUser.is_org_admin,
    organizationId: platformUser.organization_id,
    organization: organization
      ? { id: organization.id, name: organization.name, type: organization.type, verified: organization.verified }
      : null,
    lastIpHash: platformUser.last_ip_hash ?? null,
    lastIpRegion: platformUser.last_ip_region ?? null,
    lastIpCity: platformUser.last_ip_city ?? null,
    state: platformUser.state ?? null,
    lga: platformUser.lga ?? null,
    community: platformUser.community ?? null,
    village: platformUser.village ?? null,
    region: platformUser.region ?? null,
    createdAt: platformUser.created_at,
    updatedAt: platformUser.updated_at,
  });
}

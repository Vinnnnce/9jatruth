import { csrfCheck } from "@/lib/security";
import { ensureDbInitialized, getDb } from "@/lib/db";
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
    bio: platformUser.bio ?? null,
    phone: platformUser.phone ?? null,
    occupation: platformUser.occupation ?? null,
    website: platformUser.website ?? null,
    twitterHandle: platformUser.twitter_handle ?? null,
    linkedinUrl: platformUser.linkedin_url ?? null,
    dateOfBirth: platformUser.date_of_birth ?? null,
    gender: platformUser.gender ?? null,
    interests: platformUser.interests ?? null,
    skills: platformUser.skills ?? null,
    profileCompleted: platformUser.profile_completed ?? false,
  });
}

/**
 * PUT /api/user/profile — update optional profile details.
 * Only the fields provided in the body will be updated.
 */
export async function PUT(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Build SET clause dynamically from allowed fields
  const allowedFields: Record<string, string> = {
    bio: "bio",
    phone: "phone",
    occupation: "occupation",
    website: "website",
    twitterHandle: "twitter_handle",
    linkedinUrl: "linkedin_url",
    dateOfBirth: "date_of_birth",
    gender: "gender",
    displayName: "display_name",
  };

  const updates: { col: string; val: any }[] = [];
  for (const [key, col] of Object.entries(allowedFields)) {
    if (key in body) {
      updates.push({ col, val: body[key] || null });
    }
  }
  // Array fields
  if ("interests" in body) {
    const arr = Array.isArray(body.interests) ? body.interests : [];
    updates.push({ col: "interests", val: arr });
  }
  if ("skills" in body) {
    const arr = Array.isArray(body.skills) ? body.skills : [];
    updates.push({ col: "skills", val: arr });
  }
  if (updates.length === 0) {
    return Response.json({ message: "No updatable fields provided" }, { status: 400 });
  }

  const sql = getDb();
  const setClauses = updates.map((u, i) => `${u.col} = $${i + 1}`).join(", ");
  const values = updates.map((u) => u.val);
  values.push(clerkUserId);

  try {
    // Update each field individually using Neon's tagged template
    // Column names are validated against the allowedFields whitelist (no injection risk)
    for (const u of updates) {
      const col = u.col
      const val = u.val
      if (col === "bio") {
        await sql`UPDATE platform_users SET bio = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "phone") {
        await sql`UPDATE platform_users SET phone = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "occupation") {
        await sql`UPDATE platform_users SET occupation = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "website") {
        await sql`UPDATE platform_users SET website = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "twitter_handle") {
        await sql`UPDATE platform_users SET twitter_handle = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "linkedin_url") {
        await sql`UPDATE platform_users SET linkedin_url = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "date_of_birth") {
        await sql`UPDATE platform_users SET date_of_birth = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "gender") {
        await sql`UPDATE platform_users SET gender = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "display_name") {
        await sql`UPDATE platform_users SET display_name = ${val}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "interests") {
        const arr = val as string[]
        await sql`UPDATE platform_users SET interests = ${arr as any}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      } else if (col === "skills") {
        const arr = val as string[]
        await sql`UPDATE platform_users SET skills = ${arr as any}, updated_at = NOW(), profile_completed = TRUE WHERE clerk_user_id = ${clerkUserId}`
      }
    }
    // Re-fetch updated user
    const platformUser = await getPlatformUserByClerkId(clerkUserId);
    return Response.json({
      success: true,
      message: "Profile updated",
      profile: {
        bio: platformUser?.bio ?? null,
        phone: platformUser?.phone ?? null,
        occupation: platformUser?.occupation ?? null,
        website: platformUser?.website ?? null,
        twitterHandle: platformUser?.twitter_handle ?? null,
        linkedinUrl: platformUser?.linkedin_url ?? null,
        dateOfBirth: platformUser?.date_of_birth ?? null,
        gender: platformUser?.gender ?? null,
        interests: platformUser?.interests ?? null,
        skills: platformUser?.skills ?? null,
        displayName: platformUser?.display_name ?? null,
        profileCompleted: platformUser?.profile_completed ?? true,
      },
    });
  } catch (err) {
    return Response.json({ message: "Failed to update profile", error: String(err) }, { status: 500 });
  }
}

import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByClerkId,
  getOrganization,
  getPlatformUserByClerkId,
  upsertPlatformUser,
} from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";
import { currentUser } from "@clerk/nextjs/server";
import { createHash } from "crypto";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // Generate the same userHash that getUserId produces
  const userHash = `dev_${createHash("sha256").update(clerkUserId).digest("hex").substring(0, 12)}`;

  // Look up the agency account linked to this Clerk user.
  const account = await getAgencyAccountByClerkId(clerkUserId);
  if (!account || !account.active) {
    // Fall back to the platform_users record if no agency account exists.
    let platformUser = await getPlatformUserByClerkId(clerkUserId);

    // Lazily create a platform_users row if the Clerk webhook hasn't fired yet.
    // This ensures new signups can use the app immediately.
    if (!platformUser) {
      try {
        const clerkUser = await currentUser();
        if (clerkUser) {
          const email = clerkUser.emailAddresses?.find(
            (e: any) => e.id === clerkUser.primaryEmailAddressId
          )?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || "";
          const firstName = clerkUser.firstName || "";
          const lastName = clerkUser.lastName || "";
          const displayName = (firstName || lastName ? `${firstName} ${lastName}`.trim() : clerkUser.username) || null;
          const avatarUrl = clerkUser.imageUrl || null;

          platformUser = await upsertPlatformUser({
            clerkUserId,
            email: email || clerkUserId,
            displayName,
            avatarUrl,
          });
        }
      } catch {
        // If lazy creation fails, continue without a platform_user row
      }
    }

    return Response.json({
      account: platformUser
        ? {
            id: platformUser.id,
            email: platformUser.email,
            displayName: platformUser.display_name,
            role: platformUser.role,
          }
        : null,
      organization: null,
      userHash,
    });
  }

  const org = await getOrganization(account.organizationId);
  return Response.json({
    account: { id: account.id, email: account.email, displayName: account.displayName, role: account.role },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          type: org.type,
          verified: org.verified,
          contactEmail: org.contactEmail,
          description: org.description,
          region: org.region,
          city: org.city,
          website: org.website,
        }
      : null,
    userHash,
  });
}

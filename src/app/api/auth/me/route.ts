import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByClerkId,
  getOrganization,
  getPlatformUserByClerkId,
} from "@/lib/neon-storage";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
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
    const platformUser = await getPlatformUserByClerkId(clerkUserId);
    if (!platformUser) {
      return Response.json({
        account: null,
        organization: null,
        userHash,
      });
    }
    return Response.json({
      account: {
        id: platformUser.id,
        email: platformUser.email,
        displayName: platformUser.display_name,
        role: platformUser.role,
      },
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

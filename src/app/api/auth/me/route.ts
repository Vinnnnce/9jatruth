import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByClerkId,
  getOrganization,
  getPlatformUserByClerkId,
} from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";

export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Not authenticated" }, { status: 401 });
  }

  // Look up the agency account linked to this Clerk user.
  const account = await getAgencyAccountByClerkId(clerkUserId);
  if (!account || !account.active) {
    // Fall back to the platform_users record if no agency account exists.
    const platformUser = await getPlatformUserByClerkId(clerkUserId);
    if (!platformUser) {
      return Response.json({ message: "Account not found or inactive" }, { status: 401 });
    }
    return Response.json({
      account: {
        id: platformUser.id,
        email: platformUser.email,
        displayName: platformUser.display_name,
        role: platformUser.role,
      },
      organization: null,
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
  });
}

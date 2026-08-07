import { ensureDbInitialized } from "@/lib/db";
import {
  getOrgMembers,
  addOrgMember,
  getPlatformUserByClerkId,
  getPlatformUserOrgId,
} from "@/lib/neon-storage";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * List org members for the caller's organization.
 */
export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });
  const members = await getOrgMembers(orgId);
  return Response.json(members);
}

const addMemberSchema = z.object({
  clerkUserId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.string().max(50).optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * Invite/add a member to the caller's organization.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const platformUser = await getPlatformUserByClerkId(clerkUserId);
  if (!platformUser?.organization_id) {
    return Response.json({ message: "No organization associated with this account" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const member = await addOrgMember({
    organizationId: platformUser.organization_id,
    clerkUserId: parsed.data.clerkUserId,
    email: parsed.data.email,
    displayName: sanitizeText(parsed.data.displayName),
    role: parsed.data.role,
    permissions: parsed.data.permissions,
    invitedBy: clerkUserId,
  });
  return Response.json(member, { status: 201 });
}

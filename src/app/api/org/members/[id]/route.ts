import { ensureDbInitialized } from "@/lib/db";
import { updateOrgMember, deleteOrgMember, getOrgMemberById, getPlatformUserOrgId } from "@/lib/neon-storage";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const updateSchema = z.object({
  role: z.string().max(50).optional(),
  permissions: z.array(z.string()).optional(),
  active: z.number().int().min(0).max(1).optional(),
});

/**
 * Update an org member's role/permissions.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return Response.json({ message: "Invalid member id" }, { status: 400 });

  // IDOR guard: the target member must belong to the caller's organization.
  const existing = await getOrgMemberById(numericId);
  if (!existing) return Response.json({ message: "Member not found" }, { status: 404 });
  if (existing.organization_id !== orgId) {
    return Response.json({ message: "Forbidden — resource outside your organization" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const updates: any = {};
  if (parsed.data.role !== undefined) updates.role = sanitizeText(parsed.data.role);
  if (parsed.data.permissions !== undefined) updates.permissions = parsed.data.permissions;
  if (parsed.data.active !== undefined) updates.active = parsed.data.active;

  const updated = await updateOrgMember(numericId, updates);
  if (!updated) return Response.json({ message: "Member not found" }, { status: 404 });
  return Response.json(updated);
}

/**
 * Remove an org member (soft-delete by setting active = 0).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(_request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return Response.json({ message: "Invalid member id" }, { status: 400 });

  // IDOR guard: the target member must belong to the caller's organization.
  const existing = await getOrgMemberById(numericId);
  if (!existing) return Response.json({ message: "Member not found" }, { status: 404 });
  if (existing.organization_id !== orgId) {
    return Response.json({ message: "Forbidden — resource outside your organization" }, { status: 403 });
  }

  const result = await deleteOrgMember(numericId);
  return Response.json(result);
}

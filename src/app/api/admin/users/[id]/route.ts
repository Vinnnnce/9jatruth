import { csrfCheck } from "@/lib/security";
import { ensureDbInitialized } from "@/lib/db";
import { updatePlatformUser } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { sanitizeText } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  role: z.string().max(50).optional(),
  isAdmin: z.boolean().optional(),
  isOrgAdmin: z.boolean().optional(),
  organizationId: z.number().int().positive().nullable().optional(),
});

/**
 * Update a platform user's role/status. Super admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return Response.json({ message: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const updates: any = {};
  if (parsed.data.role !== undefined) updates.role = sanitizeText(parsed.data.role);
  if (parsed.data.isAdmin !== undefined) updates.isAdmin = parsed.data.isAdmin;
  if (parsed.data.isOrgAdmin !== undefined) updates.isOrgAdmin = parsed.data.isOrgAdmin;
  if (parsed.data.organizationId !== undefined) updates.organizationId = parsed.data.organizationId;

  const updated = await updatePlatformUser(numericId, updates);
  if (!updated) return Response.json({ message: "User not found" }, { status: 404 });
  return Response.json(updated);
}

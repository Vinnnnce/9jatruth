import { ensureDbInitialized } from "@/lib/db";
import { updateVacancy, deleteVacancy, getPlatformUserOrgId } from "@/lib/neon-storage";
import { getClerkUserId, sanitizeText } from "@/lib/api-helpers";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  category: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  employmentType: z.string().max(50).optional(),
  salaryRange: z.string().max(100).optional(),
  status: z.enum(["open", "closed", "draft"]).optional(),
  applicationDeadline: z.string().optional(),
});

/**
 * Update a vacancy.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return Response.json({ message: "Invalid vacancy id" }, { status: 400 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Validation error", errors: parsed.error.issues }, { status: 400 });
  }

  const updates: any = {};
  if (parsed.data.title !== undefined) updates.title = sanitizeText(parsed.data.title);
  if (parsed.data.description !== undefined) updates.description = sanitizeText(parsed.data.description);
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.employmentType !== undefined) updates.employmentType = parsed.data.employmentType;
  if (parsed.data.salaryRange !== undefined) updates.salaryRange = parsed.data.salaryRange;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.applicationDeadline !== undefined) updates.applicationDeadline = parsed.data.applicationDeadline;

  const updated = await updateVacancy(numericId, updates);
  if (!updated) return Response.json({ message: "Vacancy not found" }, { status: 404 });
  return Response.json(updated);
}

/**
 * Delete a vacancy.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const orgId = await getPlatformUserOrgId(clerkUserId);
  if (!orgId) return Response.json({ message: "No organization associated with this account" }, { status: 403 });

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) return Response.json({ message: "Invalid vacancy id" }, { status: 400 });

  const result = await deleteVacancy(numericId);
  return Response.json(result);
}

import { ensureDbInitialized } from "@/lib/db";
import { getOrganization, updateOrganizationProfile } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const patchSchema = z.object({
  description: z.string().max(500).optional(),
  tagline: z.string().max(120).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  subdomain: z.union([z.string().regex(slugRegex), z.null()]).optional(),
  contactPhone: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getOrganization(parsed.data.id);
  if (!result) return Response.json({ message: "Organization not found" }, { status: 404 });
  return Response.json(result);
}

/** PATCH — update an org's public mini-site profile (customization). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const body = await request.json().catch(() => ({}));
  const patch = validate(patchSchema, body);
  if (!patch.success) return validationErrorResponse(patch.error);

  const userHash = await getUserId(request);
  const org = await getOrganization(parsed.data.id);
  if (!org) return Response.json({ message: "Organization not found" }, { status: 404 });
  if (org.adminHash !== userHash) {
    return Response.json({ message: "Only the org admin can edit this profile" }, { status: 403 });
  }

  const updated = await updateOrganizationProfile(parsed.data.id, patch.data);
  return Response.json(updated);
}

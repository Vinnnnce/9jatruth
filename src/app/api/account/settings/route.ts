import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByClerkId,
  updateAgencyAccount,
  updateOrganizationProfile,
  getOrganization,
  hashPassword,
  verifyPassword,
} from "@/lib/neon-storage";
import { validate, validationErrorResponse, getClerkUserId } from "@/lib/api-helpers";
import { agencyUpdateSchema } from "@shared/schema";
import { z } from "zod";

export async function PATCH(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authAccount = await getAgencyAccountByClerkId(clerkUserId);
  if (!authAccount) {
    return Response.json({ message: "Account not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = validate(agencyUpdateSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    // If changing password, verify current password
    if (data.newPassword) {
      if (!data.currentPassword) {
        return Response.json({ message: "Current password is required to change password" }, { status: 400 });
      }
      const account = await getAgencyAccountByClerkId(clerkUserId);
      if (!account) return Response.json({ message: "Account not found" }, { status: 404 });
      const valid = await verifyPassword(data.currentPassword, account.passwordHash);
      if (!valid) {
        return Response.json({ message: "Current password is incorrect" }, { status: 403 });
      }
      const newHash = await hashPassword(data.newPassword);
      await updateAgencyAccount(account.id, { passwordHash: newHash });
    }

    // Update account display name
    if (data.displayName) {
      await updateAgencyAccount(authAccount.id, { displayName: data.displayName });
    }

    // Update organization profile
    const orgUpdates: any = {};
    if (data.description !== undefined) orgUpdates.description = data.description;
    if (data.contactEmail !== undefined) orgUpdates.contactEmail = data.contactEmail;
    if (data.contactPhone !== undefined) orgUpdates.contactPhone = data.contactPhone;
    if (data.website !== undefined) orgUpdates.website = data.website || null;
    if (data.region !== undefined) orgUpdates.region = data.region;
    if (data.city !== undefined) orgUpdates.city = data.city;

    if (Object.keys(orgUpdates).length > 0) {
      await updateOrganizationProfile(authAccount.organizationId, orgUpdates);
    }

    const account = await getAgencyAccountByClerkId(clerkUserId);
    const org = await getOrganization(authAccount.organizationId);
    return Response.json({
      account: account ? { id: account.id, email: account.email, displayName: account.displayName, role: account.role } : null,
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
            contactPhone: org.contactPhone,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({ message: "Validation error", errors: err.issues });
    }
    throw err;
  }
}

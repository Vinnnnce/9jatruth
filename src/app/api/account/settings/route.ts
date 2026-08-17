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
import { csrfCheck } from "@/lib/security";
import { agencyUpdateSchema } from "@shared/schema";
import { z } from "zod";

// Privileged fields that must never be settable through the account/settings
// endpoint. The agencyUpdateSchema already omits them (so zod strips unknown
// keys by default), but we strip them again here as defense-in-depth against
// any future schema regression or direct updateAgencyAccount calls.
const SENSITIVE_ACCOUNT_FIELDS = [
  "isAdmin",
  "isOrgAdmin",
  "organizationId",
  "role",
  "trustScore",
  "active",
  "verified",
] as const;

export async function PATCH(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const authAccount = clerkUserId ? await getAgencyAccountByClerkId(clerkUserId) : null;
  if (!authAccount) {
    return Response.json({ message: "Account not found. Please register first." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = validate(agencyUpdateSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    // Defense-in-depth: ensure no privileged field leaked through validation.
    for (const field of SENSITIVE_ACCOUNT_FIELDS) {
      if (field in (data as Record<string, unknown>)) {
        return Response.json({ message: `Field '${field}' cannot be modified here` }, { status: 400 });
      }
    }
    for (const field of SENSITIVE_ACCOUNT_FIELDS) {
      if (field in (body as Record<string, unknown>)) {
        return Response.json({ message: `Field '${field}' cannot be modified here` }, { status: 400 });
      }
    }

    // If changing password, verify current password
    if (data.newPassword) {
      if (!data.currentPassword) {
        return Response.json({ message: "Current password is required to change password" }, { status: 400 });
      }
      const account = clerkUserId ? await getAgencyAccountByClerkId(clerkUserId) : null;
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

    const account = clerkUserId ? await getAgencyAccountByClerkId(clerkUserId) : null;
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

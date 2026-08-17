import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByEmail,
  createOrganization,
  createAgencyAccount,
  hashPassword,
} from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId, getClerkUserId } from "@/lib/api-helpers";
import { agencyRegisterSchema } from "@shared/schema";
import { z } from "zod";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  try {
    const body = await request.json();
    const parsed = validate(agencyRegisterSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    const existing = await getAgencyAccountByEmail(data.email);
    if (existing) {
      return Response.json({ message: "An account with this email already exists" }, { status: 409 });
    }

    const clerkUserId = await getClerkUserId();
    const adminHash = await getUserId(request);

    // Allow registration even when Clerk isn't configured (dev/legacy mode)
    const org = await createOrganization({
      name: data.orgName,
      type: data.orgType,
      description: data.description || undefined,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || undefined,
      website: data.website || undefined,
      region: data.region || undefined,
      city: data.city || undefined,
      adminHash,
      clerkUserId: clerkUserId || undefined,
    });

    const passwordHash = await hashPassword(data.password);
    const account = await createAgencyAccount({
      organizationId: org.id,
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      clerkUserId: clerkUserId || undefined,
    });

    return Response.json(
      {
        account: { id: account.id, email: account.email, displayName: account.displayName, role: account.role },
        organization: { id: org.id, name: org.name, type: org.type, verified: org.verified },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({
        message: "Validation error",
        errors: err.issues.map((e: any) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    throw err;
  }
}

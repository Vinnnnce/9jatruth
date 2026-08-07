import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByEmail,
  updateAgencyAccount,
  getOrganization,
  verifyPassword,
} from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { agencyLoginSchema } from "@shared/schema";
import { z } from "zod";

export async function POST(request: Request) {
  await ensureDbInitialized();
  try {
    const body = await request.json();
    const parsed = validate(agencyLoginSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const account = await getAgencyAccountByEmail(parsed.data.email);
    if (!account) {
      return Response.json({ message: "Invalid email or password" }, { status: 401 });
    }
    if (!account.active) {
      return Response.json({ message: "Account is deactivated" }, { status: 403 });
    }
    const valid = await verifyPassword(parsed.data.password, account.passwordHash);
    if (!valid) {
      return Response.json({ message: "Invalid email or password" }, { status: 401 });
    }

    await updateAgencyAccount(account.id, { lastLoginAt: new Date().toISOString() });
    const org = await getOrganization(account.organizationId);

    return Response.json({
      account: { id: account.id, email: account.email, displayName: account.displayName, role: account.role },
      organization: org ? { id: org.id, name: org.name, type: org.type, verified: org.verified } : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({ message: "Validation error", errors: err.issues });
    }
    throw err;
  }
}

import { csrfCheck } from "@/lib/security";
import { ensureDbInitialized } from "@/lib/db";
import { getOrganizations, createOrganization } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId, getClerkUserId } from "@/lib/api-helpers";
import { insertOrganizationSchema } from "@shared/schema";
import { z } from "zod";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const verifiedOnly = searchParams.get("verified") === "true";
  const result = await getOrganizations(type, verifiedOnly);
  return Response.json(result);
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  try {
    const body = await request.json();
    const parsed = validate(insertOrganizationSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const adminHash = await getUserId(request);
    const clerkUserId = await getClerkUserId();
    const org = await createOrganization({
      ...parsed.data,
      adminHash,
      clerkUserId: clerkUserId || undefined,
    });
    return Response.json(org, { status: 201 });
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

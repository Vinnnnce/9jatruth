import { ensureDbInitialized } from "@/lib/db";
import {
  getAgencyAccountByClerkId,
  createTruth,
} from "@/lib/neon-storage";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getIpLocation,
  getClerkUserId,
} from "@/lib/api-helpers";
import { insertMicroTruthSchema, TRUTH_CATEGORIES } from "@shared/schema";
import { z } from "zod";

/**
 * Organization post submission (requires agency auth via Clerk).
 * The organizationId comes from the authenticated account, never from the
 * request body — mirroring the original requireAgencyAuth flow.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authAccount = await getAgencyAccountByClerkId(clerkUserId);
  if (!authAccount || !authAccount.active) {
    return Response.json({ message: "Agency account not found or inactive" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = validate(insertMicroTruthSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    const sanitizedContent = sanitizeText(data.content);
    if (!sanitizedContent || sanitizedContent.length < 10) {
      return Response.json({ message: "Content must be at least 10 characters after sanitization" }, { status: 400 });
    }
    if (sanitizedContent.length > 500) {
      return Response.json({ message: "Content must not exceed 500 characters" }, { status: 400 });
    }
    if (!TRUTH_CATEGORIES.includes(data.category as any)) {
      return Response.json({ message: "Invalid category" }, { status: 400 });
    }

    const userHash = await getUserId(request);
    const ipLocation = await getIpLocation(request);

    // organizationId comes from the auth token, never from the request body
    const truth = await createTruth({
      ...data,
      content: sanitizedContent,
      userHash,
      ipHash: ipLocation.ipHash || undefined,
      ipRegion: ipLocation.ipRegion || undefined,
      ipCity: ipLocation.ipCity || undefined,
      reportLat: data.reportLat,
      reportLng: data.reportLng,
      locationSource: data.locationSource || (ipLocation.ipLat ? "ip" : undefined),
      organizationId: authAccount.organizationId,
    });
    return Response.json(truth, { status: 201 });
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

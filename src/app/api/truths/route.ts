import { ensureDbInitialized } from "@/lib/db";
import { getTruths, createTruth } from "@/lib/neon-storage";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getIpLocation,
} from "@/lib/api-helpers";
import { insertMicroTruthSchema, TRUTH_CATEGORIES } from "@shared/schema";
import { z } from "zod";

const truthsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  neighborhoodId: z.coerce.number().int().positive().max(1_000_000).optional(),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]).optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(truthsQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getTruths(parsed.data.limit, parsed.data.neighborhoodId, parsed.data.category);
  return Response.json(result);
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  try {
    const body = await request.json();
    const parsed = validate(insertMicroTruthSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    // Reject organizationId from public endpoint — orgs must use /api/organizations/me/truths
    if (data.organizationId !== undefined && data.organizationId !== null) {
      return Response.json(
        { message: "Organization posts must be submitted through the authenticated agency endpoint" },
        { status: 403 }
      );
    }

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

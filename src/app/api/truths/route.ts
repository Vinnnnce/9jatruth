import { ensureDbInitialized } from "@/lib/db";
import { getTruths, createTruth } from "@/lib/neon-storage";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getIpLocation,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { securityCheck } from "@/lib/ai-security";
import { getClientIP } from "@/lib/rate-limiter";
import { insertMicroTruthSchema, TRUTH_CATEGORIES } from "@shared/schema";
import { z } from "zod";

const truthsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  neighborhoodId: z.coerce.number().int().positive().max(1_000_000).optional(),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety", "security", "real-estate", "housing", "patrol-gas-station", "restaurant", "hotel", "school", "pharmacy", "hospital", "supermarket"]).optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(truthsQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getTruths(parsed.data.limit, parsed.data.neighborhoodId, parsed.data.category, parsed.data.state, parsed.data.lga);
  // Compute authorship server-side so the client can safely hide the delete
  // control for posts the viewer did not publish. The DELETE endpoint
  // re-checks ownership, so this is defense-in-depth, not the only gate.
  const viewerHash = await getUserId(request).catch(() => null);
  const withAuthorship = (result || []).map((t: any) => ({
    ...t,
    isAuthor: !!(viewerHash && t.userHash && t.userHash === viewerHash),
  }));
  return Response.json({ truths: withAuthorship });
}

export async function POST(request: Request) {
  await ensureDbInitialized();

  // Require authentication for submitting reports (unless Clerk isn't configured)
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    // Check if Clerk is configured — if not, allow anonymous submission with IP-based userHash
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to submit a report" }, { status: 401 });
    }
  }

  // CSRF protection
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();

    // Support neighborhoodName: resolve to neighborhoodId
    let neighborhoodId = body.neighborhoodId;
    if (!neighborhoodId && body.neighborhoodName) {
      const name = String(body.neighborhoodName).trim();
      if (name.length < 2) {
        return Response.json({ message: "Neighborhood name too short" }, { status: 400 });
      }
      try {
        // Look up or create neighborhood by name
        const { getDb } = await import("@/lib/db");
        const sql = getDb();
        const existing: any[] = await sql`SELECT id FROM neighborhoods WHERE name ILIKE ${name} LIMIT 1` as unknown as any[];
        if (existing.length > 0) {
          neighborhoodId = existing[0].id;
        } else {
          // Auto-create neighborhood from user input — provide defaults for NOT NULL fields
          const created: any[] = await sql`INSERT INTO neighborhoods (name, region, geo_hash, lat, lng) VALUES (${name}, ${body.regionName || "Unknown"}, ${"manual_" + name.toLowerCase().replace(/\\s/g, "_")}, 0.0, 0.0) RETURNING id` as unknown as any[];
          neighborhoodId = created[0].id;
        }
        body.neighborhoodId = neighborhoodId;
      } catch (dbErr) {
        console.error("Neighborhood resolution error:", dbErr);
        return Response.json({ message: "Could not resolve neighborhood. Please try again." }, { status: 500 });
      }
    }

    // If still no neighborhoodId, return error
    if (!body.neighborhoodId) {
      return Response.json({ message: "Please provide a neighborhood or area name" }, { status: 400 });
    }

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

    // AI security check — blocks suspicious content (SQLi, XSS, injection patterns)
    const clientIP = getClientIP(request);
    const secCheck = await securityCheck(sanitizedContent, clientIP, "truths/POST");
    if (!secCheck.allowed) {
      return Response.json(
        { message: secCheck.reason || "Content flagged by security monitor", aiSecurity: secCheck },
        { status: 403 }
      );
    }

    const userHash = await getUserId(request);
    const ipLocation = await getIpLocation(request);

    // Determine geo hierarchy from IP location
    const stateName = ipLocation.ipRegion || undefined;
    const regionName = ipLocation.ipRegion || undefined;

    // Strip null-typed geo fields from schema data before spreading
    const { stateName: _sn, lgaName: _ln, communityName: _cn, villageName: _vn, regionName: _rn, ...restData } = data;
    const truth = await createTruth({
      ...restData,
      content: sanitizedContent,
      userHash,
      ipHash: ipLocation.ipHash || undefined,
      ipRegion: ipLocation.ipRegion || undefined,
      ipCity: ipLocation.ipCity || undefined,
      reportLat: data.reportLat || (ipLocation.ipLat ?? undefined),
      reportLng: data.reportLng || (ipLocation.ipLng ?? undefined),
      locationSource: data.locationSource || (ipLocation.ipLat ? "ip" : undefined),
      stateName,
      regionName,
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

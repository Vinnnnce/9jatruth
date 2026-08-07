import { ensureDbInitialized } from "@/lib/db";
import { getTruth } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { validate, validationErrorResponse, getClientIp, hashIp } from "@/lib/api-helpers";
import { z } from "zod";

const ipTrackQuerySchema = z.object({
  truthId: z.coerce.number().int().positive().optional(),
});

/**
 * Track post via IP address. Super admin only.
 * Returns IP metadata for a specific post, or the caller's own IP hash.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(ipTrackQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  let ipHash: string | null = null;
  let truthInfo: any = null;

  if (parsed.data.truthId) {
    const truth = await getTruth(parsed.data.truthId);
    if (!truth) return Response.json({ message: "Truth not found" }, { status: 404 });
    ipHash = truth.ipHash || null;
    truthInfo = {
      truthId: truth.id,
      ipHash: truth.ipHash,
      ipRegion: truth.ipRegion,
      ipCity: truth.ipCity,
      locationSource: truth.locationSource,
      reportLat: truth.reportLat,
      reportLng: truth.reportLng,
      stateName: (truth as any).stateName ?? null,
      lgaName: (truth as any).lgaName ?? null,
      communityName: (truth as any).communityName ?? null,
      villageName: (truth as any).villageName ?? null,
      regionName: (truth as any).regionName ?? null,
    };
  }

  const callerIp = getClientIp(request);
  const callerIpHash = callerIp ? hashIp(callerIp) : null;

  return Response.json({
    trackedTruth: truthInfo,
    callerIpHash,
    message: ipHash ? "IP hash associated with this post" : "No IP metadata for this post",
  });
}

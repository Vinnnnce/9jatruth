import { ensureDbInitialized } from "@/lib/db";
import { getTruth } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getClientIp, hashIp } from "@/lib/api-helpers";
import { z } from "zod";

const ipTrackQuerySchema = z.object({
  truthId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
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

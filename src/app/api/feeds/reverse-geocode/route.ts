import { ensureDbInitialized } from "@/lib/db";
import { assignLocationFromCoordinates } from "@/lib/geo-reverse";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  stateName: z.string().trim().max(60).optional(),
  lgaName: z.string().trim().max(80).optional(),
  wardName: z.string().trim().max(80).optional(),
  communityName: z.string().trim().max(80).optional(),
});

/**
 * POST /api/feeds/reverse-geocode
 * Lat/lng → state → LGA → ward → community assignment. Used by the post
 * composer to auto-fill the location fields (the user can then override).
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = validate(reverseGeocodeSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const assignment = await assignLocationFromCoordinates({
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    source: "browser",
    stateName: parsed.data.stateName,
    lgaName: parsed.data.lgaName,
    wardName: parsed.data.wardName,
    communityName: parsed.data.communityName,
  });

  return Response.json({ assignment });
}

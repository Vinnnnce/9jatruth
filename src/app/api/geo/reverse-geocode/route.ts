import { ensureDbInitialized } from "@/lib/db";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * GET /api/geo/reverse-geocode?lat=X&lng=Y
 *
 * Reverse geocodes lat/lng to the Nigerian geo hierarchy:
 *   State → LGA → Ward → Community
 *
 * Returns: {
 *   state: { id, name } | null,
 *   lga: { id, name } | null,
 *   ward: { id, name } | null,
 *   community: { id, name } | null,
 *   neighborhoodId, neighborhoodName,
 *   distanceKm, source
 * }
 */
export const dynamic = "force-dynamic";

const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(reverseGeocodeSchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const result = await reverseGeocode(parsed.data.lat, parsed.data.lng);
  return Response.json(result);
}

import { ensureDbInitialized } from "@/lib/db";
import { getTruthsNearby } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(500).default(50),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]).optional(),
  status: z.enum(["pending", "verified", "rejected"]).optional(),
  minTrust: z.coerce.number().int().min(0).max(100).optional(),
  maxTrust: z.coerce.number().int().min(0).max(100).optional(),
  hoursBack: z.coerce.number().positive().max(720).optional(),
  organizationId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(nearbyQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const q = parsed.data;
  const result = await getTruthsNearby(q.lat, q.lng, q.radiusKm, {
    category: q.category,
    status: q.status,
    minTrust: q.minTrust,
    maxTrust: q.maxTrust,
    hoursBack: q.hoursBack,
    organizationId: q.organizationId,
  });
  return Response.json(result);
}

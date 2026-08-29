import { ensureDbInitialized } from "@/lib/db";
import { getWardsByLga } from "@/lib/community-feeds";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * GET /api/geo/wards?lgaId=X
 *
 * Returns wards for a given LGA (for cascading dropdown filters).
 */
export const dynamic = "force-dynamic";

const wardsQuerySchema = z.object({
  lgaId: z.coerce.number().int().positive(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(wardsQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const wards = await getWardsByLga(parsed.data.lgaId);
  return Response.json({ wards });
}

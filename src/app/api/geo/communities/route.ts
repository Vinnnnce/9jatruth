import { ensureDbInitialized } from "@/lib/db";
import { getCommunitiesByWard, getCommunitiesByLga } from "@/lib/community-feeds";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * GET /api/geo/communities?wardId=X  or  ?lgaId=X
 *
 * Returns communities for a given ward or LGA (for cascading dropdown filters).
 */
export const dynamic = "force-dynamic";

const communitiesQuerySchema = z.object({
  wardId: z.coerce.number().int().positive().optional(),
  lgaId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(communitiesQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  if (parsed.data.wardId) {
    const communities = await getCommunitiesByWard(parsed.data.wardId);
    return Response.json({ communities });
  } else if (parsed.data.lgaId) {
    const communities = await getCommunitiesByLga(parsed.data.lgaId);
    return Response.json({ communities });
  }

  return Response.json({ message: "wardId or lgaId required" }, { status: 400 });
}

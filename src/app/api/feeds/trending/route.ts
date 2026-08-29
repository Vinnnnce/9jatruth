import { ensureDbInitialized } from "@/lib/db";
import { getTrendingTopics, type TrendingGeoLevel } from "@/lib/ai-community";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * GET /api/feeds/trending
 *
 * Query params:
 *   level: community | ward | lga | state | all_nigeria
 *   geoId: the ID of the geo entity (state_id, lga_id, ward_id, or community_id)
 *   hoursBack: time window (default 24)
 *
 * Returns: { trending: TrendingTopic[] }
 */
export const dynamic = "force-dynamic";

const trendingQuerySchema = z.object({
  level: z.enum(["community", "ward", "lga", "state", "all_nigeria"]).default("all_nigeria"),
  geoId: z.coerce.number().int().positive().optional(),
  hoursBack: z.coerce.number().int().positive().max(168).default(24),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(trendingQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const trending = await getTrendingTopics(
    parsed.data.level as TrendingGeoLevel,
    parsed.data.geoId ?? null,
    parsed.data.hoursBack
  );

  return Response.json({ trending });
}

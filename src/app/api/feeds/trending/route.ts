import { ensureDbInitialized } from "@/lib/db";
import { computeTrending } from "@/lib/community-feed-ai";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const trendingQuerySchema = z.object({
  scope: z.enum(["community", "ward", "lga", "state", "all"]).default("all"),
  state: z.string().trim().max(60).optional(),
  lga: z.string().trim().max(80).optional(),
  ward: z.string().trim().max(80).optional(),
  community: z.string().trim().max(80).optional(),
  windowHours: z.coerce.number().int().min(1).max(168).default(24),
});

/**
 * GET /api/feeds/trending?scope=&state=&lga=&ward=&community=&windowHours=
 * AI-driven trending topics per community / ward / LGA / state.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const parsed = validate(trendingQuerySchema, Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const result = await computeTrending(
    parsed.data.scope,
    {
      state: parsed.data.state,
      lga: parsed.data.lga,
      ward: parsed.data.ward,
      community: parsed.data.community,
    },
    parsed.data.windowHours
  );
  return Response.json(result);
}

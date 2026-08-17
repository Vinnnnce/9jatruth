import { ensureDbInitialized } from "@/lib/db";
import { search } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { searchRegions } from "@/lib/extended-locations";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]).optional(),
  region: z.string().trim().max(50).optional(),
  type: z.enum(["all", "regions"]).optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(searchQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  // If type=regions, search extended locations (African + international)
  if (parsed.data.type === "regions") {
    const regionResults = searchRegions(parsed.data.q);
    return Response.json({ regions: regionResults, total: regionResults.length });
  }

  const result: any = await search(parsed.data.q, parsed.data.category, parsed.data.region);
  const resultTotal = Array.isArray(result) ? result.length : (result?.total || 0);

  // Also search extended regions and merge results
  const extendedRegions = searchRegions(parsed.data.q);
  if (extendedRegions.length > 0) {
    return Response.json({
      results: Array.isArray(result) ? result : [],
      regions: extendedRegions,
      total: resultTotal + extendedRegions.length,
    });
  }

  return Response.json(result);
}

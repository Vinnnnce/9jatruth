import { ensureDbInitialized } from "@/lib/db";
import { getTimeSeriesData } from "@/lib/neon-storage";
import { z } from "zod";

const querySchema = z.object({
  neighborhoodId: z.coerce.number().int().positive().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

/**
 * GET /api/ai/time-series
 * Returns historical time-series data for analysis and visualization.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = querySchema.safeParse(queryObj);
  if (!parsed.success) {
    return Response.json({ message: "Invalid query", errors: parsed.error.issues }, { status: 400 });
  }

  const data = await getTimeSeriesData(
    parsed.data.neighborhoodId,
    parsed.data.category,
    parsed.data.limit
  );

  return Response.json(data);
}

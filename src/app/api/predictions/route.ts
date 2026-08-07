import { ensureDbInitialized } from "@/lib/db";
import { getPredictions } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const predictionsQuerySchema = z.object({
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]).optional(),
  neighborhoodId: z.coerce.number().int().positive().max(1_000_000).optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(predictionsQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getPredictions(parsed.data.category, parsed.data.neighborhoodId);
  return Response.json(result);
}

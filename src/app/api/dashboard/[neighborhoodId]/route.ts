import { ensureDbInitialized } from "@/lib/db";
import {
  getNeighborhood,
  getSnapshot,
  getTruths,
  getPredictions,
} from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const neighborhoodIdParamSchema = z.object({
  neighborhoodId: z.coerce.number().int().positive().max(1_000_000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ neighborhoodId: string }> }
) {
  await ensureDbInitialized();
  const { neighborhoodId } = await params;
  const parsed = validate(neighborhoodIdParamSchema, { neighborhoodId });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const neighborhood = await getNeighborhood(parsed.data.neighborhoodId);
  if (!neighborhood) return Response.json({ message: "Neighborhood not found" }, { status: 404 });

  const [snapshot, truths, predictions] = await Promise.all([
    getSnapshot(parsed.data.neighborhoodId),
    getTruths(20, parsed.data.neighborhoodId),
    getPredictions(undefined, parsed.data.neighborhoodId),
  ]);

  return Response.json({
    neighborhood,
    snapshot,
    recentTruths: truths,
    predictions,
  });
}

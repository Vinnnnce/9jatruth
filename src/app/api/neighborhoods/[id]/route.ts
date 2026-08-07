import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhood } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await getNeighborhood(parsed.data.id);
  if (!result) return Response.json({ message: "Neighborhood not found" }, { status: 404 });
  return Response.json(result);
}

import { ensureDbInitialized } from "@/lib/db";
import { search } from "@/lib/neon-storage";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const searchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety"]).optional(),
  region: z.string().trim().max(50).optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(searchQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const result = await search(parsed.data.q, parsed.data.category, parsed.data.region);
  return Response.json(result);
}

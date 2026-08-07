import { ensureDbInitialized } from "@/lib/db";
import { ingestBatch } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const batchIngestSchema = z.object({
  reports: z
    .array(
      z.object({
        neighborhoodId: z.number().int().positive().max(1000000),
        category: z.enum(["power", "fuel", "traffic", "prices", "safety"]),
        content: z.string().min(10).max(500),
        reportLat: z.number().optional(),
        reportLng: z.number().optional(),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  try {
    const body = await request.json();
    const parsed = validate(batchIngestSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const userHash = await getUserId(request);
    const inputs = parsed.data.reports.map((r) => ({ ...r, userHash }));
    const result = await ingestBatch(inputs);
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({
        message: "Validation error",
        errors: err.issues.map((e: any) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    throw err;
  }
}

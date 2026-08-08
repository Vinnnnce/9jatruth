import { ensureDbInitialized } from "@/lib/db";
import { redeemReward } from "@/lib/neon-storage";
import { validate, validationErrorResponse, sanitizeText, getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const redeemSchema = z.object({
  amount: z.number().int().positive().max(10000),
  description: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = validate(redeemSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const userHash = await getUserId(request);
    const entry = await redeemReward(userHash, parsed.data.amount, sanitizeText(parsed.data.description));
    return Response.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return validationErrorResponse({
        message: "Validation error",
        errors: err.issues.map((e: any) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    if (err instanceof Error && err.message.includes("Insufficient")) {
      return Response.json({ message: err.message }, { status: 400 });
    }
    throw err;
  }
}

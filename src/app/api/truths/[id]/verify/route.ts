import { ensureDbInitialized } from "@/lib/db";
import { verifyTruth } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

const verifyBodySchema = z.object({
  action: z.enum(["corroborate", "dispute", "stale"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsedParams = validate(idParamSchema, { id });
  if (!parsedParams.success) return validationErrorResponse(parsedParams.error);

  const body = await request.json();
  const parsedBody = validate(verifyBodySchema, body);
  if (!parsedBody.success) return validationErrorResponse(parsedBody.error);

  const userHash = await getUserId(request);
  try {
    const result = await verifyTruth(parsedParams.data.id, userHash, parsedBody.data.action);
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) {
        return Response.json({ message: "Truth not found" }, { status: 404 });
      }
      if (err.message.includes("own truth")) {
        return Response.json({ message: "You cannot verify your own truth" }, { status: 403 });
      }
      if (err.message.includes("already verified")) {
        return Response.json({ message: "You have already verified this truth" }, { status: 409 });
      }
    }
    throw err;
  }
}

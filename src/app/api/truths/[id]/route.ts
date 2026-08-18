import { ensureDbInitialized } from "@/lib/db";
import { getTruth, deleteTruth } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
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
  const result = await getTruth(parsed.data.id);
  if (!result) return Response.json({ message: "Truth not found" }, { status: 404 });
  return Response.json(result);
}

/**
 * Delete a truth (requires a signed-in user).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to delete a post" }, { status: 401 });
    }
  }

  const { id } = await params;
  const parsed = validate(idParamSchema, { id });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userHash = await getUserId(request);

  // Only allow the post owner to delete their own post
  const deleted = await deleteTruth(parsed.data.id, userHash);
  if (!deleted) return Response.json({ message: "Truth not found or you don't have permission to delete it" }, { status: 404 });
  return Response.json({ success: true });
}

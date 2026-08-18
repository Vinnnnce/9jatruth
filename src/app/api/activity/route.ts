import { ensureDbInitialized } from "@/lib/db";
import { getActivity } from "@/lib/neon-storage";
import { validate, validationErrorResponse, getUserId } from "@/lib/api-helpers";
import { z } from "zod";

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsed = validate(activityQuerySchema, queryObj);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  try {
    // Only show the current user's activities, not all website activities
    const userHash = await getUserId(request);
    const result = await getActivity(parsed.data.limit, userHash);
    return Response.json(result);
  } catch (err) {
    console.error("[api/activity] Error:", err);
    return Response.json([]);
  }
}

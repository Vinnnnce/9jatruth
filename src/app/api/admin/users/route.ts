import { ensureDbInitialized } from "@/lib/db";
import { getPlatformUsers, getPlatformUserByClerkId } from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * List all platform users. Admin-only.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const platformUser = await getPlatformUserByClerkId(clerkUserId);
  if (!platformUser?.is_admin) {
    return Response.json({ message: "Forbidden — admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 100;
  const offset = parsed.success ? parsed.data.offset : 0;

  const users = await getPlatformUsers(limit, offset);
  return Response.json(users);
}

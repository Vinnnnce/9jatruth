import { ensureDbInitialized } from "@/lib/db";
import { getPlatformUsers, getPlatformUserByClerkId } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * List all platform users with IP tracking data. Super admin only.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  const limit = parsed.success ? parsed.data.limit : 100;
  const offset = parsed.success ? parsed.data.offset : 0;

  const users = await getPlatformUsers(limit, offset);
  return Response.json(users);
}

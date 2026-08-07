import { ensureDbInitialized } from "@/lib/db";
import { getAdminTruths } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  region: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  community: z.string().optional(),
  village: z.string().optional(),
});

/**
 * Get all truths/posts with IP tracking data for the super admin dashboard.
 * Supports geo-hierarchical filtering.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return Response.json({ message: "Invalid query parameters" }, { status: 400 });
  }

  const { limit, offset, region, state, lga, community, village } = parsed.data;
  const truths = await getAdminTruths(limit, offset, {
    region: region || undefined,
    state: state || undefined,
    lga: lga || undefined,
    community: community || undefined,
    village: village || undefined,
  });

  return Response.json(truths);
}

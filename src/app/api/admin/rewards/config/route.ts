import { ensureDbInitialized } from "@/lib/db";
import { getRewardsConfig } from "@/lib/config";

/**
 * GET /api/admin/rewards/config          → active config + list of all configs
 * POST /api/admin/rewards/config/update   → upsert + activate (see ./update/route.ts)
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { requireSuperAdmin } = await import("@/lib/admin-auth");
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { getDb } = await import("@/lib/db");
  const sql = getDb();
  const active = (await sql`SELECT * FROM rewards_config WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1`) as any;
  const all = (await sql`SELECT id, name, is_active, config, updated_at FROM rewards_config ORDER BY id ASC`) as any;
  return Response.json({ active: active?.[0] ?? null, configs: all ?? [] });
}

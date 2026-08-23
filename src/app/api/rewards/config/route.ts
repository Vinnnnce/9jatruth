import { ensureDbInitialized } from "@/lib/db";
import { getRewardsConfig } from "@/lib/config";
import { csrfCheck } from "@/lib/security";

/**
 * GET /api/rewards/config
 * Returns the live, active rewards configuration (read by the rewards UI).
 * Cache-busted on every `rewards.config.updated` event emitted by the admin.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const config = await getRewardsConfig();
  // Non-mutating read; no CSRF needed.
  void csrfCheck;
  return Response.json({ config });
}

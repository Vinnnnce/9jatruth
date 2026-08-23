import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { emitConfigEvent } from "@/lib/config";
import { z } from "zod";

/**
 * Rewards configuration — super-admin controlled, reflected instantly.
 *
 * GET  /api/admin/rewards/config          → active config + list of all configs
 * POST /api/admin/rewards/config/update   → upsert a rewards config + activate it
 *   body: { name, config: { truthSubmission, corroboration, aiVerified, dailyStreak,
 *           disputedPenalty, referralSignup, referralCompletion, ... }, activate?: true }
 * Emits `rewards.config.updated` so every rewards UI reads fresh values on next request.
 */
export const dynamic = "force-dynamic";

const configSchema = z.object({
  name: z.string().min(1).max(120),
  config: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  activate: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const sql = getDb();
  const active = (await sql`SELECT * FROM rewards_config WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1`) as any;
  const all = (await sql`SELECT id, name, is_active, config, updated_at FROM rewards_config ORDER BY id ASC`) as any;
  return Response.json({
    active: active?.[0] ?? null,
    configs: all ?? [],
  });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid rewards config", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { name, config, activate } = parsed.data;
  const updatedBy = (await getClerkUserId()) ?? "super-admin";
  const sql = getDb();

  // Upsert by name: if a config with this name exists, update it; else insert.
  const existing = (await sql`SELECT id FROM rewards_config WHERE name = ${name} LIMIT 1`) as any;
  let configId: number;
  if (existing && existing.length > 0) {
    configId = existing[0].id;
    await sql`UPDATE rewards_config SET config = ${JSON.stringify(config)}::jsonb, updated_by = ${updatedBy}, updated_at = NOW() WHERE id = ${configId}`;
  } else {
    const inserted = (await sql`INSERT INTO rewards_config (name, is_active, config, updated_by)
      VALUES (${name}, FALSE, ${JSON.stringify(config)}::jsonb, ${updatedBy}) RETURNING id`) as any;
    configId = inserted[0].id;
  }

  if (activate) {
    await sql`UPDATE rewards_config SET is_active = FALSE WHERE id <> ${configId}`;
    await sql`UPDATE rewards_config SET is_active = TRUE, updated_at = NOW() WHERE id = ${configId}`;
    await sql`UPDATE site_config SET default_rewards_config_id = ${configId}, updated_at = NOW() WHERE id = 1`;
  }

  // Bust cache + emit event for cross-instance invalidation.
  await emitConfigEvent("rewards.config.updated", { configId, name, activated: !!activate }, updatedBy);

  return Response.json({ ok: true, configId, active: !!activate });
}

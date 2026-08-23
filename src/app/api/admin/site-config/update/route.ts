import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { emitConfigEvent } from "@/lib/config";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  primary_color: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/).optional(),
  secondary_color: z.string().regex(/^#?[0-9a-fA-F]{3,8}$/).optional(),
  logo_url: z.string().url().or(z.literal("")).or(z.null()).optional(),
  homepage_banner_text: z.string().max(500).or(z.null()).optional(),
  announcement_bar: z.object({
    active: z.boolean(),
    text: z.string().max(500),
    type: z.enum(["info", "warning", "success", "danger"]),
  }).optional(),
  referral_base_url: z.string().url().optional(),
  default_rewards_config_id: z.number().int().positive().or(z.null()).optional(),
});

/** POST /api/admin/site-config/update — upsert site config fields. */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid site config", errors: parsed.error.flatten() }, { status: 400 });
  }

  const updatedBy = (await getClerkUserId()) ?? "super-admin";
  const sql = getDb();

  const p = parsed.data;
  // Ensure the singleton row exists, then update only provided fields.
  await sql`INSERT INTO site_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  if (p.primary_color !== undefined) await sql`UPDATE site_config SET primary_color = ${p.primary_color} WHERE id = 1`;
  if (p.secondary_color !== undefined) await sql`UPDATE site_config SET secondary_color = ${p.secondary_color} WHERE id = 1`;
  if (p.logo_url !== undefined) await sql`UPDATE site_config SET logo_url = ${p.logo_url} WHERE id = 1`;
  if (p.homepage_banner_text !== undefined) await sql`UPDATE site_config SET homepage_banner_text = ${p.homepage_banner_text} WHERE id = 1`;
  if (p.referral_base_url !== undefined) await sql`UPDATE site_config SET referral_base_url = ${p.referral_base_url} WHERE id = 1`;
  if (p.default_rewards_config_id !== undefined) await sql`UPDATE site_config SET default_rewards_config_id = ${p.default_rewards_config_id} WHERE id = 1`;
  if (p.announcement_bar !== undefined) await sql`UPDATE site_config SET announcement_bar = ${JSON.stringify(p.announcement_bar)}::jsonb WHERE id = 1`;
  await sql`UPDATE site_config SET updated_by = ${updatedBy}, updated_at = NOW() WHERE id = 1`;

  await emitConfigEvent("site.config.updated", parsed.data, updatedBy);
  return Response.json({ ok: true });
}

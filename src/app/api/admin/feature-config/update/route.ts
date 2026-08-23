import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { emitConfigEvent } from "@/lib/config";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  news_enabled: z.boolean().optional(),
  rewards_enabled: z.boolean().optional(),
  politics_enabled: z.boolean().optional(),
  questionnaire_enabled: z.boolean().optional(),
  ai_compare_enabled: z.boolean().optional(),
});

/** POST /api/admin/feature-config/update — toggle feature flags. */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid feature config", errors: parsed.error.flatten() }, { status: 400 });
  }

  const updatedBy = (await getClerkUserId()) ?? "super-admin";
  const sql = getDb();
  await sql`INSERT INTO feature_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  const p = parsed.data;
  if (p.news_enabled !== undefined) await sql`UPDATE feature_config SET news_enabled = ${p.news_enabled} WHERE id = 1`;
  if (p.rewards_enabled !== undefined) await sql`UPDATE feature_config SET rewards_enabled = ${p.rewards_enabled} WHERE id = 1`;
  if (p.politics_enabled !== undefined) await sql`UPDATE feature_config SET politics_enabled = ${p.politics_enabled} WHERE id = 1`;
  if (p.questionnaire_enabled !== undefined) await sql`UPDATE feature_config SET questionnaire_enabled = ${p.questionnaire_enabled} WHERE id = 1`;
  if (p.ai_compare_enabled !== undefined) await sql`UPDATE feature_config SET ai_compare_enabled = ${p.ai_compare_enabled} WHERE id = 1`;
  await sql`UPDATE feature_config SET updated_by = ${updatedBy}, updated_at = NOW() WHERE id = 1`;

  await emitConfigEvent("feature.config.updated", parsed.data, updatedBy);
  return Response.json({ ok: true });
}

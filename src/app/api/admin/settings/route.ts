import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { getClerkUserId } from "@/lib/api-helpers";
import { generateAiJson, isAiConfigured } from "@/lib/ai-providers";

/**
 * Super-admin site settings & reward credit rules.
 *
 * GET  /api/admin/settings           → { rewardRules, siteControls }
 * PUT  /api/admin/settings            → persist rewardRules and/or siteControls
 * POST /api/admin/settings/optimize   → AI (Deepseek → Kimi) suggests optimized rules
 *
 * All mutations are gated behind requireSuperAdmin() + same-origin CSRF check.
 */

const DEFAULT_REWARD_RULES = {
  truthSubmission: 20,
  corroboration: 10,
  aiVerified: 15,
  dailyStreak: 5,
  disputedPenalty: -10,
  referralSignup: 50,
  referralCompletion: 100,
};

const DEFAULT_SITE_CONTROLS = {
  maintenanceMode: false,
  registrationOpen: true,
  newsPublishingOpen: true,
  bannerText: "",
  bannerActive: false,
};

async function readSetting<T>(sql: any, key: string, fallback: T): Promise<T> {
  try {
    const rows = (await sql`SELECT value FROM site_settings WHERE key = ${key} LIMIT 1`) as unknown as any[];
    if (rows && rows.length > 0 && rows[0].value) {
      const val = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
      return { ...fallback, ...val };
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const sql = getDb();
  const rewardRules = await readSetting(sql, "reward_rules", DEFAULT_REWARD_RULES);
  const siteControls = await readSetting(sql, "site_controls", DEFAULT_SITE_CONTROLS);

  return Response.json({ rewardRules, siteControls, aiConfigured: isAiConfigured() });
}

export async function PUT(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const reviewedBy = (await getClerkUserId()) ?? "super-admin";

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const sql = getDb();

  if (body.rewardRules && typeof body.rewardRules === "object") {
    const value = { ...DEFAULT_REWARD_RULES, ...body.rewardRules };
    await sql`
      INSERT INTO site_settings (key, value, category, updated_by)
      VALUES ('reward_rules', ${JSON.stringify(value)}::jsonb, 'rewards', ${reviewedBy})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
  }

  if (body.siteControls && typeof body.siteControls === "object") {
    const value = { ...DEFAULT_SITE_CONTROLS, ...body.siteControls };
    await sql`
      INSERT INTO site_settings (key, value, category, updated_by)
      VALUES ('site_controls', ${JSON.stringify(value)}::jsonb, 'site', ${reviewedBy})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
  }

  const rewardRules = await readSetting(sql, "reward_rules", DEFAULT_REWARD_RULES);
  const siteControls = await readSetting(sql, "site_controls", DEFAULT_SITE_CONTROLS);

  return Response.json({ success: true, rewardRules, siteControls });
}

/**
 * POST /api/admin/settings/optimize
 * Deepseek (with Kimi fallback) analyzes the current reward rules and proposes
 * optimized values. The proposed rules are returned (not auto-applied) so the
 * admin can review them before saving.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const sql = getDb();
  const current = await readSetting(sql, "reward_rules", DEFAULT_REWARD_RULES);

  const systemPrompt =
    "You are a gamification economist for 9jatruth, a Nigerian community truth-reporting platform. " +
    "Users earn credits for submitting truths, getting corroboration, being AI-verified as authentic, " +
    "and daily streaks; they lose credits for disputed truths. Propose optimized credit values that " +
    "maximize healthy participation and deter fraud, keeping numbers reasonable (5-50, penalties negative).";
  const userPrompt = `Current rules: ${JSON.stringify(current)}.\n` +
    "Respond with ONLY a JSON object with keys: truthSubmission, corroboration, aiVerified, dailyStreak, disputedPenalty, and a short 'rationale' string explaining the changes.";

  const { data, source } = await generateAiJson(
    systemPrompt,
    userPrompt,
    { ...current, rationale: "AI optimization unavailable — kept current values." },
    { temperature: 0.5, maxOutputTokens: 800 }
  );

  // Strip rationale from the rule values themselves.
  const { rationale, ...proposedRules } = data as any;
  const optimized = { ...DEFAULT_REWARD_RULES, ...proposedRules };

  return Response.json({
    success: true,
    source,
    currentRules: current,
    proposedRules: optimized,
    rationale: rationale ?? "No rationale provided.",
  });
}

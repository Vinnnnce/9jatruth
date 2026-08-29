import { ensureDbInitialized, getDb } from "@/lib/db";
import { getFeatureConfig } from "@/lib/config";

/**
 * GET /api/site/features
 *
 * Public endpoint (no auth) returning the feature_config flags so the
 * frontend can show/hide modules (news, rewards, politics, questionnaire, ai_compare).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const features = await getFeatureConfig();
    return Response.json({ features });
  } catch (err: any) {
    console.error("[site/features] GET failed:", err);
    return Response.json({ message: "Failed to load site features" }, { status: 500 });
  }
}

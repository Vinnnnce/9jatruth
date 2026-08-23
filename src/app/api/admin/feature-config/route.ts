import { ensureDbInitialized } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getFeatureConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

/** GET /api/admin/feature-config — read feature flags. */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const config = await getFeatureConfig();
  return Response.json({ config });
}

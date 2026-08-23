import { ensureDbInitialized } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/site-config — read the singleton site config. */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  // reuse the public config getter (cached + event-busted)
  const { getSiteConfig } = await import("@/lib/config");
  const config = await getSiteConfig();
  return Response.json({ config });
}

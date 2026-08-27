import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { importInecGeo } from "@/lib/inec-geo-import";

/**
 * POST /api/admin/import-inec-geo
 * Super-admin only. Imports Nigeria's official INEC electoral geography
 * (37 states, 774 LGAs, 8,809 wards) into the geo tables with official codes.
 * Idempotent — safe to call repeatedly. Returns the counts affected.
 */
export async function POST() {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  try {
    const sql = getDb() as any;
    const logs: string[] = [];
    const result = await importInecGeo(sql, (m: string) => logs.push(m));
    return Response.json({ ok: true, ...result, logs });
  } catch (err: any) {
    return Response.json({ ok: false, message: err?.message || String(err) }, { status: 500 });
  }
}

/**
 * GET /api/admin/import-inec-geo — report current INEC coverage counts.
 */
export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });

  const sql = getDb() as any;
  const counts = (await sql`
    SELECT
      (SELECT COUNT(*) FROM geopolitical_zones) AS zones,
      (SELECT COUNT(*) FROM states WHERE inec_code IS NOT NULL) AS coded_states,
      (SELECT COUNT(*) FROM lgas WHERE inec_code IS NOT NULL) AS coded_lgas,
      (SELECT COUNT(*) FROM wards WHERE inec_code IS NOT NULL) AS coded_wards,
      (SELECT COUNT(*) FROM political_positions) AS positions,
      (SELECT COUNT(*) FROM political_parties) AS parties
  `) as any[];
  return Response.json({ coverage: counts[0] });
}

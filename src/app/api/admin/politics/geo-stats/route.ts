import { ensureDbInitialized, getDb } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-auth";

/**
 * GET /api/admin/politics/geo-stats
 * Returns geo data statistics for the admin dashboard.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const sql = getDb();

  const states = ((await sql`SELECT COUNT(*) c FROM states`) as unknown as any[])[0]?.c ?? 0;
  const lgas = ((await sql`SELECT COUNT(*) c FROM lgas`) as unknown as any[])[0]?.c ?? 0;
  const wards = ((await sql`SELECT COUNT(*) c FROM wards`) as unknown as any[])[0]?.c ?? 0;
  const pollingUnits = ((await sql`SELECT COUNT(*) c FROM geo_polling_units`) as unknown as any[])[0]?.c ?? 0;
  const parties = ((await sql`SELECT COUNT(*) c FROM political_parties`) as unknown as any[])[0]?.c ?? 0;
  const positions = ((await sql`SELECT COUNT(*) c FROM political_positions`) as unknown as any[])[0]?.c ?? 0;
  const elections = ((await sql`SELECT COUNT(*) c FROM political_elections`) as unknown as any[])[0]?.c ?? 0;
  const officeHolders = ((await sql`SELECT COUNT(*) c FROM office_holders`) as unknown as any[])[0]?.c ?? 0;
  const candidates = ((await sql`SELECT COUNT(*) c FROM election_candidates`) as unknown as any[])[0]?.c ?? 0;
  const persons = ((await sql`SELECT COUNT(*) c FROM political_persons`) as unknown as any[])[0]?.c ?? 0;

  const lastPuSync = ((await sql`SELECT MAX(source_updated_at) d FROM geo_polling_units`) as unknown as any[])[0]?.d ?? null;
  const lastGeoSync = ((await sql`SELECT MAX(source_updated_at) d FROM states`) as unknown as any[])[0]?.d ?? null;

  return Response.json({
    geo: {
      states,
      lgas,
      wards,
      polling_units: pollingUnits,
      last_geo_sync: lastGeoSync,
      last_pu_sync: lastPuSync,
      expected: { states: 37, lgas: 774, wards: 8809, polling_units: 176846 },
    },
    politics: {
      parties,
      positions,
      elections,
      office_holders: officeHolders,
      candidates,
      persons,
    },
  });
}

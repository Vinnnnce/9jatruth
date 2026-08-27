import { ensureDbInitialized, getDb } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";
import { importInecGeo, loadInecGeo, GEOPOLITICAL_ZONES } from "@/lib/nigeria-geo";
import { seedPoliticsReferenceData } from "@/lib/politics-seed";

/**
 * Seed Nigeria INEC electoral geography + politics reference data.
 * Super-admin only. Chunked by state so each call stays well under the
 * serverless function timeout (wards for one state ≈ 30-250 rows).
 *
 * Usage:
 *   GET  /api/admin/politics/seed-geo            → status + list of states to import
 *   POST /api/admin/politics/seed-geo            → seed zones + reference data (positions/parties/elections)
 *   POST /api/admin/politics/seed-geo?state=01   → import one state's LGAs + wards (by INEC code)
 *   POST /api/admin/politics/seed-geo?all=1      → import everything (use locally / via cron, not in a single Vercel call)
 */
async function requireAdmin(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return { error: csrfError, status: 403 };
  await ensureDbInitialized();
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return { error: Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 }), status: 403 };
  }
  return null;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard.error ?? Response.json({ message: "Forbidden" }, { status: guard.status });

  try {
    const { states } = loadInecGeo();
    const sql = getDb();
    // Which states already have wards imported?
    const done = (await sql`SELECT DISTINCT s.code FROM states s JOIN wards w ON w.state_id = s.id`) as unknown as any[];
    const doneSet = new Set(done.map((r) => r.code));
    return Response.json({
      source: "github.com/saidiadegoke/nigeria-inec-geo",
      zones: GEOPOLITICAL_ZONES.length,
      totalStates: states.length,
      importedStates: doneSet.size,
      pendingStates: states.filter((s) => !doneSet.has(s.code)).map((s) => ({ code: s.code, name: s.name })),
    });
  } catch (err: any) {
    return Response.json({ message: "Failed to read geo status", error: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard.error ?? Response.json({ message: "Forbidden" }, { status: guard.status });

  const url = new URL(request.url);
  const stateCode = url.searchParams.get("state");
  const all = url.searchParams.get("all") === "1";
  const sql = getDb();

  try {
    if (stateCode) {
      // Chunked import for a single state
      const result = await importInecGeo(sql, { stateCode });
      return Response.json({ success: true, scope: "state", stateCode, ...result });
    }

    if (all) {
      // Full import — only safe outside a single serverless invocation (local/cron).
      const result = await importInecGeo(sql);
      const ref = await seedPoliticsReferenceData(sql as any);
      return Response.json({ success: true, scope: "all", ...result, reference: ref });
    }

    // Default: seed reference data (zones via importInecGeo + positions/parties/elections)
    const geo = await importInecGeo(sql);
    const ref = await seedPoliticsReferenceData(sql as any);
    return Response.json({ success: true, scope: "reference", geo, reference: ref });
  } catch (err: any) {
    return Response.json({ message: "Geo seed failed", error: err?.message }, { status: 500 });
  }
}

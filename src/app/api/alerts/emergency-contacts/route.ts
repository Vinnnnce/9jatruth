import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/alerts/emergency-contacts
 * Query params: state, lga, community, village, agencyType, lat, lng
 * Returns emergency contacts filtered by Nigerian geographic metadata.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const lga = url.searchParams.get("lga");
    const community = url.searchParams.get("community");
    const village = url.searchParams.get("village");
    const agencyType = url.searchParams.get("agencyType");
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");

    const sql = getDb();

    let rows: any[];

    if (state && lga) {
      // State + LGA level contacts
      rows = (await sql`
        SELECT * FROM emergency_contacts 
        WHERE state = ${state} 
        AND (${lga ?? null}::text IS NULL OR lga = ${lga} OR lga IS NULL)
        AND (${agencyType ?? null}::text IS NULL OR agency_type = ${agencyType})
        ORDER BY 
          CASE WHEN lga = ${lga} THEN 0 ELSE 1 END,
          CASE WHEN community = ${community ?? null} THEN 0 ELSE 1 END,
          verified DESC, agency_type
      `) as unknown as any[];
    } else if (state) {
      // State level contacts
      rows = (await sql`
        SELECT * FROM emergency_contacts 
        WHERE state = ${state}
        AND (${agencyType ?? null}::text IS NULL OR agency_type = ${agencyType})
        ORDER BY verified DESC, agency_type
      `) as unknown as any[];
    } else {
      // National level (fallback)
      rows = (await sql`
        SELECT * FROM emergency_contacts 
        WHERE (${agencyType ?? null}::text IS NULL OR agency_type = ${agencyType})
        ORDER BY state NULLS FIRST, verified DESC, agency_type
        LIMIT 100
      `) as unknown as any[];
    }

    // If no state-specific results, fall back to national
    if (rows.length === 0) {
      rows = (await sql`
        SELECT * FROM emergency_contacts 
        WHERE state IS NULL OR state = 'FCT'
        AND (${agencyType ?? null}::text IS NULL OR agency_type = ${agencyType})
        ORDER BY verified DESC, agency_type
        LIMIT 50
      `) as unknown as any[];
    }

    // Group by agency type for easier frontend consumption
    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      const key = row.agency_type;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        id: row.id,
        agencyType: row.agency_type,
        agencyName: row.agency_name,
        phonePrimary: row.phone_primary,
        phoneSecondary: row.phone_secondary,
        email: row.email,
        address: row.address,
        state: row.state,
        lga: row.lga,
        community: row.community,
        village: row.village,
        verified: row.verified,
        source: row.source,
      });
    }

    return Response.json({
      contacts: rows.map((r) => ({
        id: r.id,
        agencyType: r.agency_type,
        agencyName: r.agency_name,
        phonePrimary: r.phone_primary,
        phoneSecondary: r.phone_secondary,
        email: r.email,
        address: r.address,
        state: r.state,
        lga: r.lga,
        community: r.community,
        village: r.village,
        verified: r.verified,
      })),
      grouped,
      total: rows.length,
    });
  } catch (err) {
    console.error("[api/emergency-contacts] Error:", err);
    return Response.json({ contacts: [], grouped: {}, total: 0 }, { status: 200 });
  }
}

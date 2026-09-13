import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/results
 * Query election results with multi-level geo drill-down.
 *
 * Query params:
 *   election_id (required) — Election cycle ID
 *   office_id (optional) — Position ID
 *   state_id, lga_id, ward_id, polling_unit_id (optional) — Geo filters
 *   geo_level (optional) — national | state | lga | ward | polling_unit
 *   party (optional) — Party acronym
 *   status (optional) — Result status
 *   limit (default 100, max 1000), offset (default 0)
 *
 * NEUTRAL & FACTUAL: No predictions, no projections. Results are displayed
 * as officially declared by INEC.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);

  const electionId = searchParams.get("election_id");
  const positionId = searchParams.get("office_id");
  const stateId = searchParams.get("state_id");
  const lgaId = searchParams.get("lga_id");
  const wardId = searchParams.get("ward_id");
  const pollingUnitId = searchParams.get("polling_unit_id");
  const geoLevel = searchParams.get("geo_level");
  const party = searchParams.get("party");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 1000);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  if (!electionId) {
    return Response.json({ message: "election_id is required" }, { status: 400 });
  }

  try {
    const rows = (await sql`
      SELECT r.id, r.election_id, r.position_id, r.party_acronym, r.candidate_name, r.candidate_id,
             r.votes, r.geo_level, r.state_id, r.lga_id, r.ward_id, r.polling_unit_id,
             r.total_registered_voters, r.total_accredited_voters,
             r.total_valid_votes, r.total_rejected_votes, r.total_votes_cast,
             r.result_type, r.status, r.source_url, r.source_name, r.declared_at,
             pp.name AS position_name, pp.code AS position_code,
             p.name AS party_name, p.color AS party_color, p.logo_url AS party_logo,
             s.name AS state_name, l.name AS lga_name, w.name AS ward_name,
             pu.name AS polling_unit_name, pu.code AS polling_unit_code
      FROM election_results r
      LEFT JOIN political_positions pp ON pp.id = r.position_id
      LEFT JOIN political_parties p ON p.acronym = r.party_acronym
      LEFT JOIN states s ON s.id = r.state_id
      LEFT JOIN lgas l ON l.id = r.lga_id
      LEFT JOIN wards w ON w.id = r.ward_id
      LEFT JOIN geo_polling_units pu ON pu.id = r.polling_unit_id
      WHERE r.election_id = ${parseInt(electionId, 10)}
        AND (${positionId ?? null}::int IS NULL OR r.position_id = ${positionId ?? null}::int)
        AND (${stateId ?? null}::int IS NULL OR r.state_id = ${stateId ?? null}::int)
        AND (${lgaId ?? null}::int IS NULL OR r.lga_id = ${lgaId ?? null}::int)
        AND (${wardId ?? null}::int IS NULL OR r.ward_id = ${wardId ?? null}::int)
        AND (${pollingUnitId ?? null}::int IS NULL OR r.polling_unit_id = ${pollingUnitId ?? null}::int)
        AND (${geoLevel ?? null}::text IS NULL OR r.geo_level = ${geoLevel ?? null})
        AND (${party ?? null}::text IS NULL OR r.party_acronym = ${party ?? null})
        AND (${status ?? null}::text IS NULL OR r.status = ${status ?? null})
      ORDER BY r.geo_level, r.votes DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as any[];

    // Build summary from the results
    const summary = {
      total_valid_votes: 0,
      total_rejected_votes: 0,
      total_votes_cast: 0,
      total_accredited_voters: 0,
      total_registered_voters: 0,
      parties: [] as Array<{ acronym: string; name: string; votes: number; percentage: number }>,
    };

    const partyMap = new Map<string, { name: string; votes: number }>();
    for (const r of rows as any[]) {
      if (r.party_acronym) {
        const existing = partyMap.get(r.party_acronym) || { name: r.party_name || r.party_acronym, votes: 0 };
        existing.votes += r.votes || 0;
        partyMap.set(r.party_acronym, existing);
      }
      // Sum from national-level results only (avoid double counting)
      if (r.geo_level === "national") {
        summary.total_valid_votes = r.total_valid_votes || summary.total_valid_votes;
        summary.total_rejected_votes = r.total_rejected_votes || summary.total_rejected_votes;
        summary.total_votes_cast = r.total_votes_cast || summary.total_votes_cast;
        summary.total_accredited_voters = r.total_accredited_voters || summary.total_accredited_voters;
        summary.total_registered_voters = r.total_registered_voters || summary.total_registered_voters;
      }
    }

    const totalVotes = Array.from(partyMap.values()).reduce((s, p) => s + p.votes, 0);
    summary.parties = Array.from(partyMap.entries())
      .map(([acronym, data]) => ({
        acronym,
        name: data.name,
        votes: data.votes,
        percentage: totalVotes > 0 ? Math.round((data.votes / totalVotes) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    const total = ((await sql`
      SELECT COUNT(*) c FROM election_results r
      WHERE r.election_id = ${parseInt(electionId, 10)}
        AND (${positionId ?? null}::int IS NULL OR r.position_id = ${positionId ?? null}::int)
        AND (${stateId ?? null}::int IS NULL OR r.state_id = ${stateId ?? null}::int)
        AND (${lgaId ?? null}::int IS NULL OR r.lga_id = ${lgaId ?? null}::int)
        AND (${wardId ?? null}::int IS NULL OR r.ward_id = ${wardId ?? null}::int)
        AND (${pollingUnitId ?? null}::int IS NULL OR r.polling_unit_id = ${pollingUnitId ?? null}::int)
        AND (${geoLevel ?? null}::text IS NULL OR r.geo_level = ${geoLevel ?? null})
        AND (${party ?? null}::text IS NULL OR r.party_acronym = ${party ?? null})
        AND (${status ?? null}::text IS NULL OR r.status = ${status ?? null})
    `) as unknown as any[])[0]?.c ?? 0;

    return Response.json({ results: rows, summary, total, limit, offset });
  } catch (err: any) {
    console.error("[api/politics/results] Error:", err);
    return Response.json({ message: "Failed to load results" }, { status: 500 });
  }
}

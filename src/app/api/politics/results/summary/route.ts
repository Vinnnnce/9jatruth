import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/results/summary
 * Aggregated result summaries at state/LGA/ward level for dashboard rendering.
 *
 * Query params: election_id, office_id, geo_level, state_id, lga_id
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();
  const { searchParams } = new URL(request.url);

  const electionId = searchParams.get("election_id");
  const positionId = searchParams.get("office_id");
  const geoLevel = searchParams.get("geo_level");
  const stateId = searchParams.get("state_id");
  const lgaId = searchParams.get("lga_id");

  if (!electionId) {
    return Response.json({ message: "election_id is required" }, { status: 400 });
  }

  try {
    const rows = (await sql`
      SELECT rs.id, rs.election_id, rs.position_id, rs.geo_level,
             rs.state_id, rs.lga_id, rs.ward_id,
             rs.total_valid_votes, rs.total_rejected_votes, rs.total_votes_cast,
             rs.total_registered_voters, rs.total_accredited_voters,
             rs.leading_party, rs.leading_votes, rs.results_count, rs.status, rs.computed_at,
             pp.name AS position_name,
             s.name AS state_name, l.name AS lga_name, w.name AS ward_name,
             p.name AS leading_party_name, p.color AS leading_party_color
      FROM election_result_summaries rs
      LEFT JOIN political_positions pp ON pp.id = rs.position_id
      LEFT JOIN states s ON s.id = rs.state_id
      LEFT JOIN lgas l ON l.id = rs.lga_id
      LEFT JOIN wards w ON w.id = rs.ward_id
      LEFT JOIN political_parties p ON p.acronym = rs.leading_party
      WHERE rs.election_id = ${parseInt(electionId, 10)}
        AND (${positionId ?? null}::int IS NULL OR rs.position_id = ${positionId ?? null}::int)
        AND (${geoLevel ?? null}::text IS NULL OR rs.geo_level = ${geoLevel ?? null})
        AND (${stateId ?? null}::int IS NULL OR rs.state_id = ${stateId ?? null}::int)
        AND (${lgaId ?? null}::int IS NULL OR rs.lga_id = ${lgaId ?? null}::int)
      ORDER BY rs.geo_level, s.name, l.name, w.name
    `) as unknown as any[];
    return Response.json({ summaries: rows, total: rows.length });
  } catch (err: any) {
    console.error("[api/politics/results/summary] Error:", err);
    return Response.json({ message: "Failed to load result summaries" }, { status: 500 });
  }
}

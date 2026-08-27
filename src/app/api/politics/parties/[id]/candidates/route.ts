import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politics/parties/[id]/candidates
 * Show all registered candidates for a political party.
 *  id may be the numeric party id or the acronym (e.g. "APC").
 * Supports optional filters: position, state, zone, election_year, search.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbInitialized();
  const { id } = await params;
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const position = searchParams.get("position");
  const state = searchParams.get("state");
  const zone = searchParams.get("zone")?.toUpperCase();
  const year = searchParams.get("election_year");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  const isNumeric = /^\d+$/.test(id);

  try {
    // Resolve the party first (so we always return party info even with 0 candidates).
    const party = isNumeric
      ? ((await sql`SELECT * FROM political_parties WHERE id = ${parseInt(id)}`) as unknown as any[])[0]
      : ((await sql`SELECT * FROM political_parties WHERE UPPER(acronym) = ${id.toUpperCase()}`) as unknown as any[])[0];

    if (!party) return Response.json({ message: "Party not found" }, { status: 404 });

    const candidates = (await sql`
      SELECT c.id, c.name, c.office, c.photo_url, c.state, c.lga, c.ward,
             c.election_year, c.record_type, c.record_status, c.is_verified,
             c.manifesto_summary, c.campaign_slogan, c.party_acronym,
             c.bio, c.autobiography
      FROM political_candidates c
      WHERE c.party_acronym = ${party.acronym}
        AND (${position ?? null}::text IS NULL OR c.office ILIKE ${"%" + (position ?? "") + "%"})
        AND (${state ?? null}::text IS NULL OR c.state ILIKE ${"%" + (state ?? "") + "%"})
        AND (${year ?? null}::int IS NULL OR c.election_year = ${year ? parseInt(year) : null}::int)
        AND (${search ?? null}::text IS NULL OR c.name ILIKE ${"%" + (search ?? "") + "%"})
      ORDER BY
        CASE c.office WHEN 'presidential' THEN 0 WHEN 'governor' THEN 1 WHEN 'senate' THEN 2
                     WHEN 'house' THEN 3 WHEN 'lga_chairman' THEN 4 WHEN 'councillor' THEN 5 ELSE 9 END,
        c.state NULLS FIRST, c.name
      LIMIT ${limit}`) as unknown as any[];

    return Response.json({ party, candidates });
  } catch (err: any) {
    return Response.json({ message: err?.message || "Failed to load candidates" }, { status: 500 });
  }
}

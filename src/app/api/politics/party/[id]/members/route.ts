import { ensureDbInitialized, getDb } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/politics/party/[id]/members
 *
 * Returns the political party and all its members — both current office
 * holders (incumbents) and election candidates — joined with political_persons
 * for name/photo.
 */
export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.coerce.number().int().positive().max(1_000_000) });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const sql = getDb();

    const { id } = await params;
    const parsedId = idParamSchema.safeParse({ id });
    if (!parsedId.success) {
      return Response.json({ message: "Invalid party id" }, { status: 400 });
    }
    const partyId = parsedId.data.id;

    // 1. Fetch the party by id
    const parties = (await sql`SELECT * FROM political_parties WHERE id = ${partyId} LIMIT 1`) as unknown as any[];
    if (parties.length === 0) {
      return Response.json({ message: "Party not found" }, { status: 404 });
    }
    const party = parties[0];
    const partyAcronym = party.acronym;

    // 2. Fetch office holders (incumbents) for this party
    const officeHolders = (await sql`
      SELECT oh.*, p.full_name AS person_name, p.photo_url AS person_photo,
             p.slug AS person_slug, p.gender, p.state_of_origin,
             pp.name AS position_name, pp.level AS position_level,
             s.name AS state_name,
             e.year AS election_year, e.name AS election_name
      FROM office_holders oh
      LEFT JOIN political_persons p ON oh.person_id = p.id
      LEFT JOIN political_positions pp ON oh.position_id = pp.id
      LEFT JOIN states s ON oh.state_id = s.id
      LEFT JOIN political_elections e ON oh.election_id = e.id
      WHERE oh.party_acronym = ${partyAcronym}
      ORDER BY pp.level, p.full_name
    `) as unknown as any[];

    // 3. Fetch election candidates for this party
    const electionCandidates = (await sql`
      SELECT ec.*, p.full_name AS person_name, p.photo_url AS person_photo,
             p.slug AS person_slug, p.gender, p.state_of_origin,
             pp.name AS position_name, pp.level AS position_level,
             s.name AS state_name,
             e.year AS election_year, e.name AS election_name
      FROM election_candidates ec
      LEFT JOIN political_persons p ON ec.person_id = p.id
      LEFT JOIN political_positions pp ON ec.position_id = pp.id
      LEFT JOIN states s ON ec.state_id = s.id
      LEFT JOIN political_elections e ON ec.election_id = e.id
      WHERE ec.party_acronym = ${partyAcronym}
      ORDER BY e.year DESC, pp.level, p.full_name
    `) as unknown as any[];

    // Merge and tag each member with a record_type
    const members = [
      ...officeHolders.map((oh) => ({ ...oh, record_type: "incumbent" })),
      ...electionCandidates.map((ec) => ({ ...ec, record_type: ec.record_type || "candidate" })),
    ];

    return Response.json({
      party,
      totalMembers: members.length,
      members,
    });
  } catch (err: any) {
    console.error("[politics/party/members] GET failed:", err);
    return Response.json({ message: "Failed to load party members" }, { status: 500 });
  }
}

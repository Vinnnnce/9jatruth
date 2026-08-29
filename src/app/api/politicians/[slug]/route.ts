import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/politicians/[slug] — fetch a single politician by slug
 *
 * Returns the full political_person record plus their office_holders and
 * election_candidates entries (with position names and geo hierarchy).
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  await ensureDbInitialized();
  const { slug } = await params;
  const sql = getDb();

  // Fetch the person by slug (exact match)
  const persons = (await sql`
    SELECT * FROM political_persons WHERE slug = ${slug} LIMIT 1
  `) as unknown as any[];

  if (persons.length === 0) {
    return Response.json({ message: "Politician not found" }, { status: 404 });
  }

  const person = persons[0];

  // Fetch office holders (incumbent positions)
  const officeHolders = (await sql`
    SELECT oh.*, pp.name AS position_name, pp.code AS position_code, pp.level AS position_level,
           s.name AS state_name, l.name AS lga_name, w.name AS ward_name,
           pp.name AS office
    FROM office_holders oh
    LEFT JOIN political_positions pp ON oh.position_id = pp.id
    LEFT JOIN states s ON oh.state_id = s.id
    LEFT JOIN lgas l ON oh.lga_id = l.id
    LEFT JOIN wards w ON oh.ward_id = w.id
    WHERE oh.person_id = ${person.id}
    ORDER BY oh.status DESC, oh.created_at DESC
  `) as unknown as any[];

  // Fetch election candidates
  const candidates = (await sql`
    SELECT ec.*, pp.name AS position_name, pp.code AS position_code,
           s.name AS state_name, l.name AS lga_name, w.name AS ward_name,
           pp.name AS office, ec.party_acronym AS party
    FROM election_candidates ec
    LEFT JOIN political_positions pp ON ec.position_id = pp.id
    LEFT JOIN states s ON ec.state_id = s.id
    LEFT JOIN lgas l ON ec.lga_id = l.id
    LEFT JOIN wards w ON ec.ward_id = w.id
    WHERE ec.person_id = ${person.id}
    ORDER BY ec.created_at DESC
  `) as unknown as any[];

  // Combine into a unified profile
  const offices = [
    ...officeHolders.map((oh: any) => ({
      ...oh,
      recordType: "incumbent",
      party: oh.party_acronym,
    })),
    ...candidates.map((ec: any) => ({
      ...ec,
      recordType: ec.record_type || "candidate",
      party: ec.party_acronym,
    })),
  ];

  return Response.json({
    politician: {
      ...person,
      fullName: person.full_name,
      photoUrl: person.photo_url,
      stateOfOrigin: person.state_of_origin,
      localGovtOfOrigin: person.local_govt_of_origin,
      educationBackground: person.education_background,
      politicalBackground: person.political_background,
      previousPoliticalPositions: person.previous_political_positions,
      businessInterests: person.business_interests,
      netWorth: person.net_worth,
      assetsDeclared: person.assets_declared,
      healthStatus: person.health_status,
      healthDisclosureUrl: person.health_disclosure_url,
      sourceUrls: person.source_urls,
      verificationStatus: person.verification_status,
      dataConfidence: person.data_confidence,
    },
    offices,
    officeHolders,
    candidates,
  });
}

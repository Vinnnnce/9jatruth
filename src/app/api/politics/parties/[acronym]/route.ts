import { ensureDbInitialized, getDb } from "@/lib/db";
import { queryPoliticians } from "@/lib/politics";

/**
 * Party detail + all registered candidates for that party.
 * GET /api/politics/parties/[acronym]?year=&type=
 *
 * Powers the "click a political party → see all its registered candidates" UI.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ acronym: string }> }
) {
  await ensureDbInitialized();
  const { acronym } = await params;
  const upper = acronym.toUpperCase();
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const type = searchParams.get("type"); // incumbent | candidate | aspirant | nominee
  const sql = getDb();

  const partyRows = (await sql`SELECT * FROM political_parties WHERE acronym = ${upper} LIMIT 1`) as unknown as any[];
  if (partyRows.length === 0) {
    return Response.json({ message: "Party not found" }, { status: 404 });
  }
  const party = partyRows[0];

  // Registered candidates for this party across all offices.
  const candidates = await queryPoliticians({
    party: upper,
    electionYear: year ? parseInt(year, 10) : null,
    recordType: type ?? null,
    limit: 500,
  });

  // Group by office for the UI.
  const byOffice: Record<string, any[]> = {};
  for (const c of candidates) {
    const key = c.office ?? "other";
    (byOffice[key] ||= []).push(c);
  }

  return Response.json({ party, totalCandidates: candidates.length, candidates, byOffice });
}

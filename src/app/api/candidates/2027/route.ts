import { ensureDbInitialized } from "@/lib/db";
import { queryPoliticians } from "@/lib/politics";

/**
 * GET /api/candidates/2027?state_id=&position=&party=&search=&limit=&offset=
 * Lists candidates contesting the 2027 general elections.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id") ? parseInt(searchParams.get("state_id")!, 10) : null;
  const position = searchParams.get("position");
  const party = searchParams.get("party");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "100", 10) || 100;
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

  const candidates = await queryPoliticians({
    stateId, position, party, search, limit, offset,
    electionYear: 2027,
    recordType: "candidate",
  });
  return Response.json({ candidates, count: candidates.length, electionYear: 2027, filters: { stateId, position, party } });
}

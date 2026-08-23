import { ensureDbInitialized } from "@/lib/db";
import { queryPoliticians } from "@/lib/politics";

/**
 * GET /api/office-holders/current?state_id=&position=&limit=&offset=
 * Lists current office holders (incumbents), with term_start / term_end.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id") ? parseInt(searchParams.get("state_id")!, 10) : null;
  const position = searchParams.get("position");
  const limit = parseInt(searchParams.get("limit") || "100", 10) || 100;
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

  const holders = await queryPoliticians({
    stateId, position, limit, offset,
    recordType: "incumbent",
  });
  return Response.json({ officeHolders: holders, count: holders.length, filters: { stateId, position } });
}
